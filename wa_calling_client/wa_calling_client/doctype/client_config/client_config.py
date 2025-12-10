# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _


class ClientConfig(Document):
	def validate(self):
		"""Validate platform URL format"""
		if self.platform_url:
			# Ensure URL doesn't have trailing slash
			self.platform_url = self.platform_url.rstrip('/')

			# Ensure URL starts with https
			if not self.platform_url.startswith('http'):
				self.platform_url = f"https://{self.platform_url}"

	def on_update(self):
		"""Test connection when config is saved"""
		if self.has_value_changed('api_key') or self.has_value_changed('platform_url'):
			self.test_connection()

	def test_connection(self):
		"""Test connection to central platform"""
		try:
			from wa_calling_client.wa_calling_client.api.platform_client import PlatformClient

			client = PlatformClient()
			result = client.authenticate()

			if result.get("success"):
				self.connection_status = "Connected"
				self.last_connected = frappe.utils.now()

				# Update customer info
				customer = result.get("customer", {})
				self.customer_id = customer.get("id")
				self.company_name = customer.get("company_name")
				self.customer_status = customer.get("status")

				# Update subscription info
				subscription = result.get("subscription", {})
				if subscription:
					self.subscription_plan = subscription.get("plan")

				# Update WABA info (first connection)
				connections = result.get("connections", [])
				if connections:
					conn = connections[0]
					self.waba_id = conn.get("waba_id")
					self.phone_number = conn.get("phone_number")
					self.phone_number_id = conn.get("phone_number_id")
					self.display_name = conn.get("display_name")

				self.save(ignore_permissions=True)
				return {"success": True, "message": _("Connection successful")}
			else:
				self.connection_status = "Error"
				self.save(ignore_permissions=True)
				return {"success": False, "message": result.get("message", "Connection failed")}

		except Exception as e:
			self.connection_status = "Error"
			self.save(ignore_permissions=True)
			frappe.log_error(f"Platform connection error: {str(e)}", "Client Config Connection")
			return {"success": False, "message": str(e)}

	def sync_usage(self):
		"""Sync usage data from platform"""
		try:
			from wa_calling_client.wa_calling_client.api.platform_client import PlatformClient

			client = PlatformClient()
			result = client.get_subscription()

			if result.get("success"):
				usage = result.get("usage", {})
				self.minutes_used_this_month = usage.get("minutes_this_month", 0)
				self.monthly_minutes_included = usage.get("minutes_included", 0)
				self.minutes_remaining = usage.get("minutes_remaining", 0)
				self.last_sync = frappe.utils.now()
				self.save(ignore_permissions=True)

				return {"success": True}

		except Exception as e:
			frappe.log_error(f"Usage sync error: {str(e)}", "Client Config Sync")
			return {"success": False, "message": str(e)}


@frappe.whitelist()
def test_platform_connection():
	"""Test connection to platform (called from UI)"""
	config = frappe.get_single("Client Config")
	result = config.test_connection()
	return result


@frappe.whitelist()
def sync_platform_usage():
	"""Sync usage data from platform (called from UI)"""
	config = frappe.get_single("Client Config")
	result = config.sync_usage()
	return result
