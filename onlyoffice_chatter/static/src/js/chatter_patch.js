/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { useService, useAutofocus } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import { Chatter } from "@mail/chatter/web_portal_project/chatter";
import { Component, signal, useState, t, useProps } from "@odoo/owl";

/** Rutas relativas internas del mismo origen; "//host" y esquemas absolutos quedan excluidos. */
function isInternalUrl(url) {
    return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

// ─────────────────────────────────────────────────────────────────
//  Diálogo OWL2 — selector de formato y título (Odoo 20)
// ─────────────────────────────────────────────────────────────────
class OnlyofficeChatterCreateDialog extends Component {
    static components = { Dialog };
    static template = "onlyoffice_chatter.CreateDialog";

    setup() {
        super.setup();
        // El servicio de diálogos inyecta `close` en los props.
        this.props = useProps({
            close: t.function(),
            resModel: t.string(),
            resId: t.number(),
            onCreated: t.function().optional(),
        });
        this.notification = useService("notification");
        this.titleInputRef = signal.ref();
        useAutofocus({ ref: this.titleInputRef });

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
        if (this.isButtonDisabled()) {
            return;
        }

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

            // Abrir el editor antes de cualquier await adicional: mantiene la
            // llamada cerca del gesto del usuario y evita bloqueadores de popups.
            // Solo rutas internas del mismo origen (el controller devuelve
            // "/onlyoffice/editor/<id>"): una respuesta manipulada con un
            // origen externo se descarta.
            if (isInternalUrl(result.url)) {
                // Ancla programática con noopener: equivalente a window.open,
                // pero sin exponer window.opener a la pestaña del editor.
                const anchor = document.createElement("a");
                anchor.href = result.url;
                anchor.target = "_blank";
                anchor.rel = "noopener";
                anchor.click();
            }

            this.notification.add(_t("Document created successfully"), {
                type: "success",
                sticky: false,
            });

            if (this.props.onCreated) {
                await this.props.onCreated();
            }

            this.props.close();
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
//  Patch del Chatter (Odoo 20: el componente vive en
//  @mail/chatter/web_portal_project y el registro actual es
//  this.state.thread, con .model / .id)
// ─────────────────────────────────────────────────────────────────
patch(Chatter.prototype, {
    setup() {
        super.setup(...arguments);
        this.dialog = useService("dialog");

        this.ooLabels = {
            buttonTitle: _t("Create OnlyOffice Document"),
            buttonText: _t("New"),
        };
    },

    openOnlyofficeDialog() {
        const thread = this.state.thread;
        // En registros sin guardar el thread no tiene id: no hay destino
        // válido para el ir.attachment.
        if (!thread?.id) {
            return;
        }
        this.dialog.add(OnlyofficeChatterCreateDialog, {
            resModel: thread.model,
            resId: thread.id,
            onCreated: () => {
                // Refresco canónico de Odoo 20 para datos creados del lado
                // servidor (p. ej. un attachment nuevo): el Chatter escucha
                // MAIL:RELOAD-THREAD en this.env.bus.
                this.env.bus.trigger("MAIL:RELOAD-THREAD", {
                    model: thread.model,
                    id: thread.id,
                });
            },
        });
    },
});
