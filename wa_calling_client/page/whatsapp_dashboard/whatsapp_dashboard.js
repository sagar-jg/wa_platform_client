frappe.pages['whatsapp-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'WhatsApp Calling Dashboard',
		single_column: true
	});

	page.set_primary_action(__('Refresh'), () => load_dashboard_data(page), 'octicon octicon-sync');
	page.add_menu_item(__('Client Config'), () => frappe.set_route('Form', 'Client Config'));

	$(page.body).html(`
		<div class="wa-dashboard">
			<div class="wa-loading text-center p-5">
				<div class="spinner-border text-primary" role="status"></div>
				<p class="mt-3 text-muted">Connecting to platform...</p>
			</div>
			<div class="wa-content" style="display: none;">
				<div class="wa-section wa-connection-status mb-4"></div>
				<div class="wa-section wa-stats mb-4"><div class="row"></div></div>
				<div class="wa-section wa-waba mb-4">
					<h5 class="wa-section-title">Subscription & Plan</h5>
					<div class="wa-waba-content"></div>
				</div>
				<div class="wa-section wa-calls mb-4">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h5 class="wa-section-title mb-0">Recent Calls</h5>
						<button class="btn btn-sm btn-outline-primary wa-view-all-calls">View All</button>
					</div>
					<div class="wa-calls-content"></div>
				</div>
				<div class="wa-section wa-permissions mb-4">
					<div class="d-flex justify-content-between align-items-center mb-3">
						<h5 class="wa-section-title mb-0">Call Permissions</h5>
						<button class="btn btn-sm btn-outline-primary wa-view-all-permissions">View All</button>
					</div>
					<div class="wa-permissions-content"></div>
				</div>
			</div>
			<div class="wa-error" style="display: none;">
				<div class="text-center p-5">
					<i class="fa fa-exclamation-triangle fa-3x text-warning mb-3"></i>
					<h4>Connection Error</h4>
					<p class="text-muted wa-error-message"></p>
					<a href="/app/client-config" class="btn btn-primary">Configure Connection</a>
				</div>
			</div>
		</div>
		<style>
			.wa-dashboard { padding: 15px; }
			.wa-section { background: var(--card-bg); border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
			.wa-section-title { color: var(--heading-color); font-weight: 600; margin-bottom: 15px; }
			.wa-stat-card { text-align: center; padding: 20px; background: var(--bg-color); border-radius: 8px; }
			.wa-stat-value { font-size: 2rem; font-weight: 700; color: var(--primary); }
			.wa-stat-label { color: var(--text-muted); font-size: 0.85rem; }
			.wa-connection-status { padding: 15px 20px; }
			.wa-status-connected { background: linear-gradient(135deg, #d4edda, #c3e6cb); border-left: 4px solid #28a745; }
			.wa-status-error { background: linear-gradient(135deg, #f8d7da, #f5c6cb); border-left: 4px solid #dc3545; }
			.wa-call-row, .wa-permission-row { padding: 12px 0; border-bottom: 1px solid var(--border-color); }
			.wa-call-row:last-child, .wa-permission-row:last-child { border-bottom: none; }
			.wa-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
			.wa-badge-success { background: #d4edda; color: #155724; }
			.wa-badge-warning { background: #fff3cd; color: #856404; }
			.wa-badge-danger { background: #f8d7da; color: #721c24; }
			.wa-badge-info { background: #d1ecf1; color: #0c5460; }
			.wa-badge-secondary { background: #e2e3e5; color: #383d41; }
		</style>
	`);

	load_dashboard_data(page);
};

function load_dashboard_data(page) {
	const $loading = $(page.body).find('.wa-loading');
	const $content = $(page.body).find('.wa-content');
	const $error = $(page.body).find('.wa-error');

	$loading.show(); $content.hide(); $error.hide();

	frappe.call({
		method: 'frappe.client.get_single_value',
		args: { doctype: 'Client Config', field: 'platform_url' },
		callback: function(r) {
			if (!r.message) {
				$loading.hide();
				$error.find('.wa-error-message').text('Client Config not set up. Please configure your platform connection.');
				$error.show();
				return;
			}

			Promise.all([
				call_api('get_subscription_info'),
				call_api('get_call_logs', { limit: 10 }),
				call_api('get_permissions', { limit: 10 })
			]).then(([subscription, calls, permissions]) => {
				$loading.hide();
				render_dashboard(page, { subscription, calls, permissions });
				$content.show();
			}).catch(err => {
				$loading.hide();
				$error.find('.wa-error-message').text(err.message || 'Failed to load data');
				$error.show();
			});
		}
	});
}

function call_api(method, args = {}) {
	return new Promise((resolve, reject) => {
		frappe.call({
			method: `wa_calling_client.wa_calling_client.api.platform_client.${method}`,
			args: args,
			callback: r => resolve(r.message || {}),
			error: reject
		});
	});
}

function render_dashboard(page, data) {
	const { subscription, calls, permissions } = data;
	const usage = subscription?.usage || {};
	const plan = subscription?.plan || {};

	// Connection Status
	$(page.body).find('.wa-connection-status').addClass('wa-status-connected').html(`
		<div class="d-flex align-items-center">
			<i class="fa fa-check-circle text-success mr-2"></i>
			<div><strong>Connected to Platform</strong>
				<small class="d-block text-muted">${plan.name || 'Plan'} - ${subscription?.subscription?.status || 'Active'}</small>
			</div>
		</div>
	`);

	// Stats
	$(page.body).find('.wa-stats .row').html(`
		<div class="col-md-3 col-6 mb-3"><div class="wa-stat-card"><div class="wa-stat-value">${usage.calls_this_month || 0}</div><div class="wa-stat-label">Calls This Month</div></div></div>
		<div class="col-md-3 col-6 mb-3"><div class="wa-stat-card"><div class="wa-stat-value">${(usage.minutes_this_month || 0).toFixed(1)}</div><div class="wa-stat-label">Minutes Used</div></div></div>
		<div class="col-md-3 col-6 mb-3"><div class="wa-stat-card"><div class="wa-stat-value">${usage.minutes_remaining || 0}</div><div class="wa-stat-label">Minutes Left</div></div></div>
		<div class="col-md-3 col-6 mb-3"><div class="wa-stat-card"><div class="wa-stat-value">${usage.minutes_included || 0}</div><div class="wa-stat-label">Monthly Quota</div></div></div>
	`);

	// Plan Details
	$(page.body).find('.wa-waba-content').html(`
		<div class="row">
			<div class="col-md-6">
				<p><strong>Plan:</strong> ${plan.name || 'N/A'}</p>
				<p><strong>Max Concurrent Calls:</strong> ${plan.max_concurrent_calls || 'N/A'}</p>
				<p><strong>Recording:</strong> ${plan.call_recording_enabled ? 'Enabled' : 'Disabled'}</p>
			</div>
			<div class="col-md-6">
				<p><strong>Billing:</strong> ${subscription?.subscription?.billing_cycle || 'Monthly'}</p>
				<p><strong>Next Billing:</strong> ${subscription?.subscription?.next_billing_date || 'N/A'}</p>
				<p><strong>Status:</strong> <span class="wa-badge wa-badge-success">${subscription?.subscription?.status || 'Active'}</span></p>
			</div>
		</div>
	`);

	// Calls
	const $calls = $(page.body).find('.wa-calls-content');
	if (calls.calls?.length) {
		$calls.html(calls.calls.map(c => `
			<div class="wa-call-row d-flex justify-content-between align-items-center">
				<div><i class="fa ${c.direction === 'Inbound' ? 'fa-arrow-down text-success' : 'fa-arrow-up text-primary'} mr-2"></i>
					<strong>${c.contact_name || c.customer_number}</strong></div>
				<div class="text-right">
					<span class="wa-badge ${get_badge(c.status)}">${c.status}</span>
					<small class="d-block text-muted">${c.duration_seconds ? format_dur(c.duration_seconds) : '-'} | ${frappe.datetime.prettyDate(c.initiated_at)}</small>
				</div>
			</div>
		`).join(''));
	} else {
		$calls.html('<p class="text-muted text-center">No calls yet</p>');
	}

	// Permissions
	const $perms = $(page.body).find('.wa-permissions-content');
	if (permissions.permissions?.length) {
		$perms.html(permissions.permissions.map(p => `
			<div class="wa-permission-row d-flex justify-content-between align-items-center">
				<div><strong>${p.customer_number}</strong> <small class="text-muted ml-2">Calls: ${p.calls_in_24h || 0}/5</small></div>
				<div class="text-right">
					<span class="wa-badge ${get_perm_badge(p.permission_status)}">${p.permission_status}</span>
					<small class="d-block text-muted">${p.expires_at ? 'Exp: ' + frappe.datetime.prettyDate(p.expires_at) : ''}</small>
				</div>
			</div>
		`).join(''));
	} else {
		$perms.html('<p class="text-muted text-center">No permissions yet</p>');
	}

	// Dialogs
	$(page.body).find('.wa-view-all-calls').click(() => show_dialog('Call Logs', 'get_call_logs', render_calls_table));
	$(page.body).find('.wa-view-all-permissions').click(() => show_dialog('Permissions', 'get_permissions', render_perms_table));
}

function get_badge(s) { return { Ended: 'wa-badge-success', Answered: 'wa-badge-success', Initiated: 'wa-badge-info', Ringing: 'wa-badge-info', Failed: 'wa-badge-danger', 'No Answer': 'wa-badge-warning', Declined: 'wa-badge-danger' }[s] || 'wa-badge-secondary'; }
function get_perm_badge(s) { return { Granted: 'wa-badge-success', Requested: 'wa-badge-info', Denied: 'wa-badge-danger', Expired: 'wa-badge-warning' }[s] || 'wa-badge-secondary'; }
function format_dur(s) { return Math.floor(s/60) + ':' + (s%60).toString().padStart(2,'0'); }

function show_dialog(title, method, renderer) {
	const d = new frappe.ui.Dialog({ title: __(title), size: 'large', fields: [{ fieldtype: 'HTML', fieldname: 'content' }] });
	d.fields_dict.content.$wrapper.html('<div class="text-center p-4"><div class="spinner-border"></div></div>');
	d.show();
	call_api(method, { limit: 50 }).then(data => d.fields_dict.content.$wrapper.html(renderer(data)));
}

function render_calls_table(data) {
	if (!data.calls?.length) return '<p class="text-muted">No calls</p>';
	return `<table class="table table-sm"><thead><tr><th>Contact</th><th>Number</th><th>Dir</th><th>Status</th><th>Duration</th><th>Date</th></tr></thead><tbody>
		${data.calls.map(c => `<tr><td>${c.contact_name||'-'}</td><td>${c.customer_number}</td><td>${c.direction}</td><td><span class="wa-badge ${get_badge(c.status)}">${c.status}</span></td><td>${c.duration_seconds ? format_dur(c.duration_seconds) : '-'}</td><td>${frappe.datetime.str_to_user(c.initiated_at)}</td></tr>`).join('')}
	</tbody></table>`;
}

function render_perms_table(data) {
	if (!data.permissions?.length) return '<p class="text-muted">No permissions</p>';
	return `<table class="table table-sm"><thead><tr><th>Number</th><th>Status</th><th>Calls</th><th>Granted</th><th>Expires</th></tr></thead><tbody>
		${data.permissions.map(p => `<tr><td>${p.customer_number}</td><td><span class="wa-badge ${get_perm_badge(p.permission_status)}">${p.permission_status}</span></td><td>${p.calls_in_24h||0}/5</td><td>${p.granted_at ? frappe.datetime.str_to_user(p.granted_at) : '-'}</td><td>${p.expires_at ? frappe.datetime.str_to_user(p.expires_at) : '-'}</td></tr>`).join('')}
	</tbody></table>`;
}
