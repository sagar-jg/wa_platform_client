# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

"""
Platform Client - API client for communicating with central WhatsApp Calling Platform

This module handles all communication between the client app and the central platform.
"""

import frappe
from frappe import _
import requests
import json


class PlatformClient:
	"""Client for communicating with the central WhatsApp Calling Platform"""

	def __init__(self):
		"""Initialize client with config from Client Config doctype"""
		self.config = frappe.get_single("Client Config")

		if not self.config.platform_url:
			frappe.throw(_("Platform URL not configured. Please set up Client Config."))

		if not self.config.api_key:
			frappe.throw(_("API Key not configured. Please set up Client Config."))

		self.base_url = self.config.platform_url.rstrip('/')
		self.api_key = self.config.get_password('api_key')
		self.timeout = 30

	def _get_headers(self):
		"""Get standard headers for API requests"""
		return {
			"Content-Type": "application/json",
			"X-API-Key": self.api_key
		}

	def _make_request(self, method, endpoint, data=None, params=None):
		"""
		Make HTTP request to platform API.

		Args:
			method: HTTP method (GET, POST, etc.)
			endpoint: API endpoint path
			data: Request body data
			params: Query parameters

		Returns:
			dict: API response
		"""
		url = f"{self.base_url}/api/method/whatsapp_calling.whatsapp_calling.api.client_api.{endpoint}"

		try:
			response = requests.request(
				method=method,
				url=url,
				headers=self._get_headers(),
				json=data,
				params=params,
				timeout=self.timeout
			)

			if response.status_code == 200:
				result = response.json()
				# Frappe wraps responses in {"message": ...}
				if "message" in result:
					return result["message"]
				return result
			elif response.status_code == 403:
				frappe.throw(_("Authentication failed. Please check your API key."))
			else:
				error_msg = f"API Error: {response.status_code}"
				try:
					error_data = response.json()
					if "exc_type" in error_data:
						error_msg = error_data.get("_server_messages", error_msg)
				except:
					pass
				frappe.log_error(f"Platform API Error: {error_msg}", "Platform Client")
				return {"success": False, "error": error_msg}

		except requests.exceptions.ConnectionError:
			frappe.throw(_("Could not connect to platform. Please check the URL and network."))
		except requests.exceptions.Timeout:
			frappe.throw(_("Request timed out. Please try again."))
		except Exception as e:
			frappe.log_error(f"Platform client error: {str(e)}", "Platform Client")
			frappe.throw(_("An error occurred while communicating with the platform."))

	# =========================================================================
	# AUTHENTICATION
	# =========================================================================

	def authenticate(self):
		"""
		Authenticate with the platform and get customer info.

		Returns:
			dict: Customer info, connections, and subscription details
		"""
		return self._make_request("POST", "authenticate", {"api_key": self.api_key})

	# =========================================================================
	# WABA & CONNECTIONS
	# =========================================================================

	def get_waba_details(self):
		"""Get WABA and phone number details"""
		return self._make_request("GET", "get_waba_details")

	def get_phone_numbers(self):
		"""Get list of registered phone numbers"""
		return self._make_request("GET", "get_phone_numbers")

	# =========================================================================
	# SUBSCRIPTION
	# =========================================================================

	def get_subscription(self):
		"""Get subscription details including usage"""
		return self._make_request("GET", "get_subscription")

	# =========================================================================
	# CALL OPERATIONS
	# =========================================================================

	def make_call(self, to_number, lead_reference=None, connection_name=None):
		"""
		Initiate an outbound call.

		Args:
			to_number: Phone number to call (E.164 format)
			lead_reference: CRM Lead name (optional)
			connection_name: Specific WABA connection to use (optional)

		Returns:
			dict: Call details and Janus connection info
		"""
		return self._make_request("POST", "make_call", {
			"to_number": to_number,
			"lead_reference": lead_reference,
			"connection_name": connection_name
		})

	def answer_call(self, call_id):
		"""
		Answer an incoming call.

		Args:
			call_id: WhatsApp call ID

		Returns:
			dict: Call details and Janus connection info
		"""
		return self._make_request("POST", "answer_call", {"call_id": call_id})

	def end_call(self, call_id):
		"""
		End an active call.

		Args:
			call_id: WhatsApp call ID

		Returns:
			dict: Result
		"""
		return self._make_request("POST", "end_call", {"call_id": call_id})

	def get_call_logs(self, limit=20, offset=0, status=None, direction=None,
					  start_date=None, end_date=None):
		"""
		Get call logs.

		Args:
			limit: Number of records to return
			offset: Number of records to skip
			status: Filter by status
			direction: Filter by direction
			start_date: Filter from date
			end_date: Filter to date

		Returns:
			dict: Call logs with pagination
		"""
		params = {
			"limit": limit,
			"offset": offset
		}
		if status:
			params["status"] = status
		if direction:
			params["direction"] = direction
		if start_date:
			params["start_date"] = start_date
		if end_date:
			params["end_date"] = end_date

		return self._make_request("GET", "get_call_logs", params=params)

	def get_call_details(self, call_id):
		"""
		Get detailed information about a specific call.

		Args:
			call_id: WhatsApp call ID or document name

		Returns:
			dict: Full call details
		"""
		return self._make_request("GET", "get_call_details", params={"call_id": call_id})

	# =========================================================================
	# PERMISSIONS
	# =========================================================================

	def request_permission(self, to_number, lead_reference=None, connection_name=None):
		"""
		Request call permission from a phone number.

		Args:
			to_number: Phone number to request permission from
			lead_reference: CRM Lead name (optional)
			connection_name: Specific connection to use (optional)

		Returns:
			dict: Permission request result
		"""
		return self._make_request("POST", "request_permission", {
			"to_number": to_number,
			"lead_reference": lead_reference,
			"connection_name": connection_name
		})

	def check_permission(self, to_number, connection_name=None):
		"""
		Check if can call a phone number.

		Args:
			to_number: Phone number to check
			connection_name: Specific connection (optional)

		Returns:
			dict: Permission status
		"""
		params = {"to_number": to_number}
		if connection_name:
			params["connection_name"] = connection_name
		return self._make_request("GET", "check_permission", params=params)

	def get_permissions(self, limit=20, offset=0, status=None):
		"""
		Get permission records.

		Args:
			limit: Number of records
			offset: Number to skip
			status: Filter by status

		Returns:
			dict: Permission records
		"""
		params = {"limit": limit, "offset": offset}
		if status:
			params["status"] = status
		return self._make_request("GET", "get_permissions", params=params)

	# =========================================================================
	# JANUS / WEBRTC
	# =========================================================================

	def get_ice_servers(self):
		"""Get ICE server configuration for WebRTC"""
		return self._make_request("GET", "get_ice_servers")

	def join_janus_room(self, call_id, sdp_offer):
		"""
		Join Janus audio room for a call.

		Args:
			call_id: WhatsApp call ID
			sdp_offer: Browser's SDP offer

		Returns:
			dict: SDP answer and room details
		"""
		return self._make_request("POST", "join_janus_room", {
			"call_id": call_id,
			"sdp_offer": sdp_offer
		})


# =============================================================================
# FRAPPE WHITELISTED METHODS (for frontend JS)
# =============================================================================

@frappe.whitelist()
def make_call(to_number, lead_reference=None):
	"""Make an outbound call"""
	client = PlatformClient()
	return client.make_call(to_number, lead_reference)


@frappe.whitelist()
def answer_call(call_id):
	"""Answer an incoming call"""
	client = PlatformClient()
	return client.answer_call(call_id)


@frappe.whitelist()
def end_call(call_id):
	"""End an active call"""
	client = PlatformClient()
	return client.end_call(call_id)


@frappe.whitelist()
def check_permission(to_number):
	"""Check call permission for a number"""
	client = PlatformClient()
	return client.check_permission(to_number)


@frappe.whitelist()
def request_permission(to_number, lead_reference=None):
	"""Request call permission"""
	client = PlatformClient()
	return client.request_permission(to_number, lead_reference)


@frappe.whitelist()
def get_call_logs(limit=20, offset=0):
	"""Get call logs"""
	client = PlatformClient()
	return client.get_call_logs(limit=int(limit), offset=int(offset))


@frappe.whitelist()
def get_ice_servers():
	"""Get ICE servers for WebRTC"""
	client = PlatformClient()
	return client.get_ice_servers()


@frappe.whitelist()
def join_janus_room(call_id, sdp_offer):
	"""Join Janus room for call"""
	client = PlatformClient()
	return client.join_janus_room(call_id, sdp_offer)


@frappe.whitelist()
def get_subscription_info():
	"""Get subscription and usage info"""
	client = PlatformClient()
	return client.get_subscription()
