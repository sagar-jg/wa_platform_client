/**
 * CRM Lead Call Button Integration
 *
 * Adds WhatsApp call functionality to CRM Lead doctype
 */

frappe.ui.form.on('CRM Lead', {
	refresh: function(frm) {
		// Only show call button if lead has mobile number
		if (frm.doc.mobile_no || frm.doc.phone) {
			add_call_button(frm);
		}
	}
});

function add_call_button(frm) {
	// Remove existing button if any
	frm.remove_custom_button(__('WhatsApp Call'));

	// Add WhatsApp Call button
	frm.add_custom_button(__('WhatsApp Call'), function() {
		const mobile = frm.doc.mobile_no || frm.doc.phone;

		if (!mobile) {
			frappe.msgprint(__('No mobile number found for this lead.'));
			return;
		}

		// Show call dialog
		show_call_dialog(frm, mobile);
	}, __('Actions'));

	// Also add request permission button
	frm.add_custom_button(__('Request Call Permission'), function() {
		const mobile = frm.doc.mobile_no || frm.doc.phone;

		if (!mobile) {
			frappe.msgprint(__('No mobile number found for this lead.'));
			return;
		}

		request_call_permission(frm, mobile);
	}, __('Actions'));
}

function show_call_dialog(frm, mobile) {
	// First check permission
	frappe.call({
		method: 'wa_calling_client.wa_calling_client.api.platform_client.check_permission',
		args: { to_number: mobile },
		callback: function(r) {
			if (r.message && r.message.can_call) {
				// Can call - show call widget
				initiate_call(frm, mobile);
			} else {
				// Need permission - show dialog
				const reason = r.message ? r.message.reason : 'Permission required';

				frappe.confirm(
					__('Call permission required: {0}<br><br>Would you like to request permission?', [reason]),
					function() {
						request_call_permission(frm, mobile);
					}
				);
			}
		},
		error: function(r) {
			frappe.msgprint({
				title: __('Error'),
				indicator: 'red',
				message: __('Could not check call permission. Please ensure Client Config is properly set up.')
			});
		}
	});
}

function request_call_permission(frm, mobile) {
	frappe.call({
		method: 'wa_calling_client.wa_calling_client.api.platform_client.request_permission',
		args: {
			to_number: mobile,
			lead_reference: frm.doc.name
		},
		freeze: true,
		freeze_message: __('Sending permission request...'),
		callback: function(r) {
			if (r.message && r.message.success) {
				frappe.msgprint({
					title: __('Permission Request Sent'),
					indicator: 'green',
					message: __('A call permission request has been sent to {0}. You will be able to call once they accept.', [mobile])
				});
			} else {
				const error = r.message ? r.message.reason : 'Failed to send request';
				frappe.msgprint({
					title: __('Request Failed'),
					indicator: 'red',
					message: error
				});
			}
		}
	});
}

function initiate_call(frm, mobile) {
	// Show call widget
	if (!window.waCallWidget) {
		window.waCallWidget = new WhatsAppCallWidget();
	}

	window.waCallWidget.show({
		mode: 'outbound',
		to_number: mobile,
		lead_reference: frm.doc.name,
		contact_name: frm.doc.lead_name || frm.doc.first_name || mobile
	});
}
