/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

// ─────────────────────────────────────────────────────────────────
//  OWL Dialog — format selector and title
//  Odoo 16: OWL components available, but Chatter is still legacy
// ─────────────────────────────────────────────────────────────────
class OnlyofficeChatterCreateDialog extends Component {
    static components = { Dialog };
    static template = "onlyoffice_chatter.CreateDialog";

    setup() {
        this.data = this.env.dialogData;
        this.notification = useService("notification");

        this.formats = [
            { ext: "docx", label: _t("Document") },
            { ext: "xlsx", label: _t("Spreadsheet") },
            { ext: "pptx", label: _t("Presentation") },
        ];

        this.dialogTitle = _t("Create with ONLYOFFICE");

        this.labels = {
            title: _t("Title"),
            placeholder: _t("New Document"),
            creating: _t("Creating..."),
            create: _t("Create"),
            cancel: _t("Cancel"),
        };

        this.state = useState({
            isCreating: false,
            selectedFormat: "docx",
            title: _t("New Document"),
        });
    }

    selectFormat(ext) {
        this.state.selectedFormat = ext;
    }

    handleFormatKeydown(ext, ev) {
        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this.selectFormat(ext);
        }
    }

    isButtonDisabled() {
        return this.state.isCreating || !this.state.selectedFormat || !this.state.title;
    }

    async createFile() {
        if (this.isButtonDisabled()) return;

        this.state.isCreating = true;
        try {
            const result = await rpc("/onlyoffice/chatter/file/create", {
                res_model: this.props.resModel,
                res_id: this.props.resId,
                supported_format: this.state.selectedFormat,
                title: this.state.title,
            });

            if (result.error) {
                this.notification.add(result.error, { type: "danger", sticky: false });
                return;
            }

            this.notification.add(_t("Document created successfully"), {
                type: "success",
                sticky: false,
            });

            if (this.props.onCreated) {
                await this.props.onCreated();
            }

            if (result.url) {
                window.open(result.url, "_blank");
            }

            this.data.close();
        } catch (e) {
            console.error("OnlyOffice Chatter: createFile failed", e);
            this.notification.add(_t("Error creating document"), {
                type: "danger",
                sticky: false,
            });
        } finally {
            this.state.isCreating = false;
        }
    }
}

// ─────────────────────────────────────────────────────────────────
//  Odoo 16: Chatter is still legacy widget
//  Use FormRenderer patch to inject the button
//  The dialog is OWL (mounted via dialog service)
// ─────────────────────────────────────────────────────────────────
import { FormRenderer } from "@web/views/form/form_renderer";
import { patch } from "@web/core/utils/patch";

patch(FormRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.dialog = useService("dialog");
    },

    openOnlyofficeDialog() {
        const record = this.props.record;
        if (!record || !record.resModel || !record.resId) return;

        this.dialog.add(OnlyofficeChatterCreateDialog, {
            resModel: record.resModel,
            resId: record.resId,
            onCreated: async () => {
                try {
                    if (record.model && typeof record.model.load === "function") {
                        await record.model.load();
                    }
                } catch (err) {
                    console.warn("OnlyOffice Chatter: could not refresh record", err);
                }
            },
        });
    },
});
