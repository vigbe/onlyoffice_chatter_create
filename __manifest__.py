# pylint: disable=pointless-statement
{
    "name": "ONLYOFFICE Chatter Integration",
    "summary": "Create OnlyOffice documents directly from the Chatter of any record.",
    "description": (
        "Adds a 'Nuevo' button to the Chatter of any Odoo record to create a blank "
        "OnlyOffice document (docx, xlsx, pptx) as a native ir.attachment. "
        "Works with Odoo Community Edition. Does not require the Enterprise Documents app."
    ),
    "author": "Victor Bastías",
    "website": "https://vicbas./",
    "support": "contacto@vicbas.com",
    "category": "Productivity",
    "version": "19.0.1.0.0",
    "depends": ["mail", "onlyoffice_odoo"],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "onlyoffice_chatter/static/src/js/chatter_patch.js",
            "onlyoffice_chatter/static/src/xml/chatter_patch.xml",
        ],
    },
    "installable": True,
    "application": False,
    "license": "LGPL-3",
}
