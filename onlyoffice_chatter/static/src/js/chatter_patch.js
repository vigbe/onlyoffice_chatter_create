odoo.define("onlyoffice_chatter.chatter_patch", function (require) {
    "use strict";

    var core = require("web.core");
    var rpc = require("web.rpc");
    var Widget = require("web.Widget");
    var _t = core._t;

    // ─────────────────────────────────────────────────────────────────
    //  Dialog Widget — format selector and title
    //  Odoo 15: uses legacy Widget + QWeb rendering
    // ─────────────────────────────────────────────────────────────────
    var OnlyofficeChatterCreateDialog = Widget.extend({
        template: "onlyoffice_chatter.CreateDialog",
        events: {
            "click .o-oo-format-card": "_onFormatClick",
            "dblclick .o-oo-format-card": "_onCreateClick",
            "keydown .o-oo-format-card": "_onFormatKeydown",
            "click .btn-primary": "_onCreateClick",
            "click .btn-secondary": "_onCancel",
            "input #oo_chatter_title": "_onTitleInput",
        },

        init: function (parent, options) {
            this._super.apply(this, arguments);
            this.resModel = options.resModel;
            this.resId = options.resId;
            this.onCreated = options.onCreated;
            this.formats = [
                { ext: "docx", label: _t("Document"), icon: "fa-file-text-o" },
                { ext: "xlsx", label: _t("Spreadsheet"), icon: "fa-file-excel-o" },
                { ext: "pptx", label: _t("Presentation"), icon: "fa-file-powerpoint-o" },
            ];
            this.selectedFormat = "docx";
            this.isCreating = false;
        },

        start: function () {
            this.$input = this.$("#oo_chatter_title");
            this.$input.focus();
            this.$createBtn = this.$(".btn-primary");
            this._updateSelectedFormat();
            return this._super.apply(this, arguments);
        },

        _onTitleInput: function () {
            this.title = this.$input.val().trim();
        },

        _onFormatClick: function (ev) {
            var ext = $(ev.currentTarget).data("ext");
            this.selectedFormat = ext;
            this._updateSelectedFormat();
        },

        _onFormatKeydown: function (ev) {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                var ext = $(ev.currentTarget).data("ext");
                this.selectedFormat = ext;
                this._updateSelectedFormat();
            }
        },

        _updateSelectedFormat: function () {
            this.$(".o-oo-format-card").each(function () {
                var $card = $(this);
                var isSelected = $card.data("ext") === this.selectedFormat;
                $card.toggleClass("o-oo-format-selected border-primary", isSelected);
                $card.toggleClass("border-transparent", !isSelected);
            }.bind(this));
        },

        _onCreateClick: function () {
            if (this.isCreating) return;

            this.title = this.$input.val().trim();
            if (!this.title || !this.selectedFormat) return;

            this.isCreating = true;
            this.$createBtn.prop("disabled", true);
            this.$createBtn.find(".o-oo-btn-text").text(_t("Creating..."));
            this.$createBtn.find(".spinner-border").removeClass("d-none");

            var self = this;
            rpc.query({
                route: "/onlyoffice/chatter/file/create",
                params: {
                    res_model: this.resModel,
                    res_id: this.resId,
                    supported_format: this.selectedFormat,
                    title: this.title,
                },
            }).then(function (result) {
                if (result.error) {
                    self.displayNotification({ message: result.error, type: "danger" });
                    self._resetButton();
                    return;
                }
                self.displayNotification({
                    message: _t("Document created successfully"),
                    type: "success",
                });
                if (self.onCreated) {
                    self.onCreated();
                }
                if (result.url) {
                    window.open(result.url, "_blank");
                }
                self.destroy();
            }).catch(function (e) {
                console.error("OnlyOffice Chatter: createFile failed", e);
                self.displayNotification({
                    message: _t("Error creating document"),
                    type: "danger",
                });
                self._resetButton();
            });
        },

        _resetButton: function () {
            this.isCreating = false;
            this.$createBtn.prop("disabled", false);
            this.$createBtn.find(".o-oo-btn-text").text(_t("Create"));
            this.$createBtn.find(".spinner-border").addClass("d-none");
        },

        _onCancel: function () {
            this.destroy();
        },
    });

    // ─────────────────────────────────────────────────────────────────
    //  Patch the Chatter to inject the "New" button
    //  Odoo 15: Chatter is a legacy widget in the mail module
    //  We use form_renderer to hook into the chatter area
    // ─────────────────────────────────────────────────────────────────
    var FormRenderer = require("web.FormRenderer");

    FormRenderer.include({
        start: function () {
            var res = this._super.apply(this, arguments);
            this._ooBindChatterButton();
            return res;
        },

        _ooBindChatterButton: function () {
            var self = this;
            // The chatter area in Odoo 15 is rendered inside .o_Chatter
            this.$(".o_mail_chatter_button_oo_new").on("click", function () {
                var state = self.state;
                if (!state || !state.model || !state.res_id) return;

                var dialog = new OnlyofficeChatterCreateDialog(self, {
                    resModel: state.model,
                    resId: state.res_id,
                    onCreated: function () {
                        // Trigger chatter reload
                        self.trigger_up("reload", { keepChanges: true });
                    },
                });
                dialog.appendTo($("body"));
            });
        },
    });
});
