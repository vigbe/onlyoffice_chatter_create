import logging
import re

from odoo import http
from odoo.exceptions import AccessError, MissingError, ValidationError
from odoo.http import request
from odoo.tools.translate import _

from odoo.addons.onlyoffice_odoo.utils import file_utils

_logger = logging.getLogger(__name__)

_UNSAFE_FILENAME_CHARS = re.compile(r'[\/\\:*?"<>|]')


class OnlyofficeChatterController(http.Controller):
    """
    Endpoint to create a blank OnlyOffice file and attach it natively to any
    Odoo record via ir.attachment (res_model + res_id).

    Works with Odoo Community Edition — does NOT require the Enterprise
    Documents app (documents.document). Compatible with any model that uses
    the Chatter (mail.thread).
    """

    _ALLOWED_FORMATS = ("docx", "xlsx", "pptx")

    @http.route(
        "/onlyoffice/chatter/file/create",
        auth="user",
        methods=["POST"],
        type="json",
    )
    def post_chatter_file_create(self, res_model, res_id, supported_format, title):
        """
        Create a blank OnlyOffice file as an ir.attachment linked to the given record.

        :param res_model:        Odoo model technical name (e.g. 'crm.lead')
        :param res_id:           ID of the target record
        :param supported_format: File format: 'docx', 'xlsx' or 'pptx'
        :param title:            File name without extension
        :return:                 Dict with attachment_id and editor url, or error
        """
        result = {"error": None, "attachment_id": None, "url": None}

        try:
            if supported_format not in self._ALLOWED_FORMATS:
                raise ValueError(
                    _(
                        "Unsupported format '%(fmt)s'. Allowed: %(allowed)s",
                        fmt=supported_format,
                        allowed=", ".join(self._ALLOWED_FORMATS),
                    )
                )

            if res_model not in request.env:
                raise ValueError(_("Model '%(model)s' not found.", model=res_model))

            if not hasattr(request.env[res_model], "message_post"):
                raise ValueError(
                    _(
                        "Model '%(model)s' does not support Chatter (mail.thread).",
                        model=res_model,
                    )
                )

            record = request.env[res_model].browse(int(res_id))
            record.ensure_one()
            record.check_access_rights("write")
            record.check_access_rule("write")

            # Validate and sanitize title
            title = title.strip()
            if not title:
                raise ValueError(_("Title cannot be empty."))
            if len(title) > 100:
                raise ValueError(_("Title must not exceed 100 characters."))
            title = _UNSAFE_FILENAME_CHARS.sub("_", title)

            lang = request.env.user.lang or "en_US"
            file_data = file_utils.get_default_file_template(lang, supported_format)

            if not file_data:
                raise ValueError(
                    _(
                        "Could not load template for format '%(fmt)s'.",
                        fmt=supported_format,
                    )
                )

            mimetype = file_utils.get_mime_by_ext(supported_format)
            filename = f"{title}.{supported_format}"

            attachment = request.env["ir.attachment"].create(
                {
                    "name": filename,
                    "mimetype": mimetype,
                    "raw": file_data,
                    "res_model": res_model,
                    "res_id": int(res_id),
                }
            )

            result["attachment_id"] = attachment.id
            result["url"] = f"/onlyoffice/editor/{attachment.id}"

            _logger.info(
                "OnlyOffice Chatter: created '%s' (id=%s) on %s#%s by %s",
                filename,
                attachment.id,
                res_model,
                res_id,
                request.env.user.login,
            )

        except (ValueError, AccessError, ValidationError, MissingError) as ex:
            _logger.warning(
                "OnlyOffice Chatter: failed to create document: %s", str(ex)
            )
            result["error"] = str(ex)
        except Exception:
            _logger.exception("OnlyOffice Chatter: unexpected error creating document")
            result["error"] = _("Unexpected error creating document. Please try again.")

        return result
