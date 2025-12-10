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
		# Skip connection test during initial install (no platform_url or api_key set yet)
		if not self.platform_url or not self.api_key:
			return

		# Only test connection when values actually change (not on initial save)
		if self.has_value_changed('api_key') or self.has_value_changed('platform_url'):
			# Use flags to prevent recursion
			if not getattr(self, '_testing_connection', False):
				self._testing_connection = True
				try:
					self.test_connection()
				finally:
					self._testing_connection = False

	def test_connection(self):
		"""Test connection to central platform"""
		try:
			from wa_platform_client.wa_platform_client.api.platform_client import PlatformClient

			client = PlatformClient()
			result = client.authenticate()

			if result.get("success"):
				update_values = {
					"connection_status": "Connected",
					"last_connected": frappe.utils.now()
				}

				# Update customer info
				customer = result.get("customer", {})
				if customer:
					update_values["customer_id"] = customer.get("id")
					update_values["company_name"] = customer.get("company_name")
					update_values["customer_status"] = customer.get("status")

				# Update subscription info
				subscription = result.get("subscription", {})
				if subscription:
					update_values["subscription_plan"] = subscription.get("plan")

				# Update WABA info (first connection)
				connections = result.get("connections", [])
				if connections:
					conn = connections[0]
					update_values["waba_id"] = conn.get("waba_id")
					update_values["phone_number"] = conn.get("phone_number")
					update_values["phone_number_id"] = conn.get("phone_number_id")
					update_values["display_name"] = conn.get("display_name")

				# Use db_set to avoid triggering on_update again
				for field, value in update_values.items():
					self.db_set(field, value, update_modified=False)

				return {"success": True, "message": _("Connection successful")}
			else:
				self.db_set("connection_status", "Error", update_modified=False)
				return {"success": False, "message": result.get("message", "Connection failed")}

		except Exception as e:
			self.db_set("connection_status", "Error", update_modified=False)
			frappe.log_error(f"Platform connection error: {str(e)}", "Client Config Connection")
			return {"success": False, "message": str(e)}

	def sync_usage(self):
		"""Sync usage data from platform"""
		try:
			from wa_platform_client.wa_platform_client.api.platform_client import PlatformClient

			client = PlatformClient()
			result = client.get_subscription()

			if result.get("success"):
				usage = result.get("usage", {})
				# Use db_set to avoid triggering on_update
				self.db_set("minutes_used_this_month", usage.get("minutes_this_month", 0), update_modified=False)
				self.db_set("monthly_minutes_included", usage.get("minutes_included", 0), update_modified=False)
				self.db_set("minutes_remaining", usage.get("minutes_remaining", 0), update_modified=False)
				self.db_set("last_sync", frappe.utils.now(), update_modified=False)

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
