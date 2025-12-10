# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

app_name = "wa_platform_client"
app_title = "WhatsApp Calling Client"
app_publisher = "Your Company"
app_description = "Lightweight client app for WhatsApp calling integration with central platform"
app_email = "info@yourcompany.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/wa_platform_client/css/wa_platform_client.css"
app_include_js = "/assets/wa_platform_client/js/wa_platform_client.js"

# include js, css files in header of web template
# web_include_css = "/assets/wa_platform_client/css/wa_platform_client.css"
# web_include_js = "/assets/wa_platform_client/js/wa_platform_client.js"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "wa_platform_client.install.before_install"
# after_install = "wa_platform_client.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "wa_platform_client.uninstall.before_uninstall"
# after_uninstall = "wa_platform_client.uninstall.after_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "wa_platform_client.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}
# }

# Doctype JS
# ----------
# Add custom JS to doctypes
doctype_js = {
    "CRM Lead": "public/js/crm_lead_call.js"
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"wa_platform_client.tasks.all"
# 	],
# 	"daily": [
# 		"wa_platform_client.tasks.daily"
# 	],
# 	"hourly": [
# 		"wa_platform_client.tasks.hourly"
# 	],
# 	"weekly": [
# 		"wa_platform_client.tasks.weekly"
# 	],
# 	"monthly": [
# 		"wa_platform_client.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "wa_platform_client.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "wa_platform_client.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "wa_platform_client.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Add all simple doctypes to WEBSITE://website.dev/api/resource/{doctype}
# website_route_rules = [
# 	{"from_route": "/api/<doctype>", "to_route": "api"}
# ]
