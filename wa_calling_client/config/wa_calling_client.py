# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

from frappe import _


def get_data():
	return [
		{
			"label": _("Settings"),
			"items": [
				{
					"type": "doctype",
					"name": "Client Config",
					"label": _("Client Configuration"),
					"description": _("Configure connection to WhatsApp Calling Platform")
				}
			]
		}
	]
