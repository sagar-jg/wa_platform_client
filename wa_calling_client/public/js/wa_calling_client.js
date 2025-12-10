/**
 * WhatsApp Calling Client Bundle
 *
 * Main JavaScript bundle for WhatsApp calling functionality
 */

// =============================================================================
// CALL WIDGET CLASS
// =============================================================================

class WhatsAppCallWidget {
	constructor() {
		this.dialog = null;
		this.callState = null; // null, 'connecting', 'ringing', 'active', 'ended'
		this.currentCall = null;
		this.peerConnection = null;
		this.localStream = null;
		this.janusWsUrl = null;
		this.iceServers = [];

		// Bind methods
		this.show = this.show.bind(this);
		this.hide = this.hide.bind(this);
		this.makeCall = this.makeCall.bind(this);
		this.answerCall = this.answerCall.bind(this);
		this.endCall = this.endCall.bind(this);

		// Listen for incoming calls (from platform webhook forward)
		this.setupIncomingCallListener();
	}

	setupIncomingCallListener() {
		// Listen for real-time events from Frappe
		frappe.realtime.on('incoming_whatsapp_call', (data) => {
			this.showIncomingCall(data);
		});

		frappe.realtime.on('call_status_update', (data) => {
			this.handleCallStatusUpdate(data);
		});
	}

	show(options = {}) {
		/*
		 * Show the call widget
		 *
		 * options:
		 *   mode: 'outbound' or 'inbound'
		 *   to_number: Phone number (for outbound)
		 *   call_id: Call ID (for inbound)
		 *   lead_reference: CRM Lead name
		 *   contact_name: Display name
		 */

		if (this.dialog) {
			this.hide();
		}

		this.callOptions = options;
		this.callState = null;

		const fields = this.buildDialogFields(options);

		this.dialog = new frappe.ui.Dialog({
			title: options.mode === 'inbound' ? __('Incoming Call') : __('WhatsApp Call'),
			fields: fields,
			primary_action_label: options.mode === 'inbound' ? __('Answer') : __('Call'),
			primary_action: () => {
				if (options.mode === 'inbound') {
					this.answerCall(options.call_id);
				} else {
					this.makeCall(options.to_number, options.lead_reference);
				}
			},
			secondary_action_label: options.mode === 'inbound' ? __('Decline') : __('Cancel'),
			secondary_action: () => {
				if (this.callState === 'active' || this.callState === 'connecting') {
					this.endCall();
				} else {
					this.hide();
				}
			}
		});

		// Custom styling for call widget
		this.dialog.$wrapper.find('.modal-dialog').addClass('wa-call-widget');

		this.dialog.show();
	}

	hide() {
		if (this.dialog) {
			this.dialog.hide();
			this.dialog = null;
		}
		this.cleanup();
	}

	buildDialogFields(options) {
		const contactName = options.contact_name || options.to_number || 'Unknown';

		return [
			{
				fieldtype: 'HTML',
				fieldname: 'call_ui',
				options: `
					<div class="wa-call-container text-center">
						<div class="wa-call-avatar">
							<i class="fa fa-user-circle fa-5x text-muted"></i>
						</div>
						<div class="wa-call-name mt-3">
							<h4>${contactName}</h4>
							<p class="text-muted">${options.to_number || ''}</p>
						</div>
						<div class="wa-call-status mt-3">
							<span class="wa-status-text">${options.mode === 'inbound' ? __('Incoming call...') : __('Ready to call')}</span>
						</div>
						<div class="wa-call-timer mt-2" style="display: none;">
							<span class="wa-timer">00:00</span>
						</div>
						<div class="wa-call-actions mt-4" style="display: none;">
							<button class="btn btn-danger btn-lg wa-end-call-btn">
								<i class="fa fa-phone"></i> ${__('End Call')}
							</button>
						</div>
					</div>
				`
			}
		];
	}

	updateUI(state, message) {
		this.callState = state;

		const $container = this.dialog.$wrapper.find('.wa-call-container');
		const $status = $container.find('.wa-status-text');
		const $timer = $container.find('.wa-call-timer');
		const $actions = $container.find('.wa-call-actions');

		$status.text(message);

		if (state === 'active') {
			$timer.show();
			$actions.show();
			this.startTimer();

			// Hide dialog buttons
			this.dialog.set_primary_action_label(null);

			// Add end call handler
			$container.find('.wa-end-call-btn').off('click').on('click', () => {
				this.endCall();
			});
		} else if (state === 'ended') {
			$timer.hide();
			$actions.hide();
			this.stopTimer();

			// Auto-close after 2 seconds
			setTimeout(() => this.hide(), 2000);
		}
	}

	startTimer() {
		this.callStartTime = Date.now();
		this.timerInterval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
			const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
			const seconds = (elapsed % 60).toString().padStart(2, '0');
			this.dialog.$wrapper.find('.wa-timer').text(`${minutes}:${seconds}`);
		}, 1000);
	}

	stopTimer() {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	async makeCall(toNumber, leadReference) {
		try {
			this.updateUI('connecting', __('Connecting...'));

			// Make call via platform
			const response = await frappe.call({
				method: 'wa_calling_client.wa_calling_client.api.platform_client.make_call',
				args: {
					to_number: toNumber,
					lead_reference: leadReference
				}
			});

			if (response.message && response.message.success) {
				this.currentCall = response.message.call;
				this.janusWsUrl = response.message.janus?.ws_url;
				this.iceServers = response.message.janus?.ice_servers || [];

				this.updateUI('ringing', __('Ringing...'));

				// Setup WebRTC connection
				await this.setupWebRTC();
			} else {
				const error = response.message?.message || __('Failed to initiate call');
				this.updateUI('ended', error);
				frappe.msgprint({
					title: __('Call Failed'),
					indicator: 'red',
					message: error
				});
			}
		} catch (error) {
			console.error('Call error:', error);
			this.updateUI('ended', __('Call failed'));
			frappe.msgprint({
				title: __('Error'),
				indicator: 'red',
				message: __('Failed to make call. Please try again.')
			});
		}
	}

	async answerCall(callId) {
		try {
			this.updateUI('connecting', __('Connecting...'));

			const response = await frappe.call({
				method: 'wa_calling_client.wa_calling_client.api.platform_client.answer_call',
				args: { call_id: callId }
			});

			if (response.message && response.message.success) {
				this.currentCall = response.message.call;
				this.janusWsUrl = response.message.janus?.ws_url;
				this.iceServers = response.message.janus?.ice_servers || [];

				await this.setupWebRTC();
				this.updateUI('active', __('Connected'));
			} else {
				this.updateUI('ended', __('Failed to answer'));
			}
		} catch (error) {
			console.error('Answer error:', error);
			this.updateUI('ended', __('Failed to answer'));
		}
	}

	async endCall() {
		try {
			if (this.currentCall) {
				await frappe.call({
					method: 'wa_calling_client.wa_calling_client.api.platform_client.end_call',
					args: { call_id: this.currentCall.call_id }
				});
			}
		} catch (error) {
			console.error('End call error:', error);
		} finally {
			this.updateUI('ended', __('Call ended'));
			this.cleanup();
		}
	}

	async setupWebRTC() {
		try {
			// Get user media (audio only)
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});

			// Create peer connection
			this.peerConnection = new RTCPeerConnection({
				iceServers: this.iceServers
			});

			// Add local stream
			this.localStream.getTracks().forEach(track => {
				this.peerConnection.addTrack(track, this.localStream);
			});

			// Handle remote stream
			this.peerConnection.ontrack = (event) => {
				const remoteAudio = document.createElement('audio');
				remoteAudio.srcObject = event.streams[0];
				remoteAudio.autoplay = true;
				remoteAudio.id = 'wa-remote-audio';
				document.body.appendChild(remoteAudio);
			};

			// Create offer
			const offer = await this.peerConnection.createOffer();
			await this.peerConnection.setLocalDescription(offer);

			// Wait for ICE gathering
			await this.waitForIceGathering();

			// Send offer to Janus via platform
			const response = await frappe.call({
				method: 'wa_calling_client.wa_calling_client.api.platform_client.join_janus_room',
				args: {
					call_id: this.currentCall.call_id,
					sdp_offer: this.peerConnection.localDescription.sdp
				}
			});

			if (response.message && response.message.success) {
				// Set remote description (answer)
				const answer = response.message.result?.sdp_answer;
				if (answer) {
					await this.peerConnection.setRemoteDescription({
						type: 'answer',
						sdp: answer
					});
					this.updateUI('active', __('Connected'));
				}
			}
		} catch (error) {
			console.error('WebRTC setup error:', error);
			throw error;
		}
	}

	waitForIceGathering() {
		return new Promise((resolve) => {
			if (this.peerConnection.iceGatheringState === 'complete') {
				resolve();
			} else {
				const checkState = () => {
					if (this.peerConnection.iceGatheringState === 'complete') {
						this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
						resolve();
					}
				};
				this.peerConnection.addEventListener('icegatheringstatechange', checkState);

				// Timeout after 5 seconds
				setTimeout(resolve, 5000);
			}
		});
	}

	cleanup() {
		// Stop local stream
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
		}

		// Close peer connection
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}

		// Remove remote audio
		const remoteAudio = document.getElementById('wa-remote-audio');
		if (remoteAudio) {
			remoteAudio.remove();
		}

		// Stop timer
		this.stopTimer();

		// Reset state
		this.currentCall = null;
		this.callState = null;
	}

	showIncomingCall(data) {
		this.show({
			mode: 'inbound',
			call_id: data.call_id,
			to_number: data.from_number,
			contact_name: data.contact_name || data.from_number
		});

		// Play ringtone (optional)
		// this.playRingtone();
	}

	handleCallStatusUpdate(data) {
		if (!this.currentCall || this.currentCall.call_id !== data.call_id) {
			return;
		}

		switch (data.status) {
			case 'Answered':
				this.updateUI('active', __('Connected'));
				break;
			case 'Ended':
			case 'Failed':
			case 'No Answer':
			case 'Declined':
				this.updateUI('ended', __(data.status));
				break;
		}
	}
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Create global instance
window.waCallWidget = new WhatsAppCallWidget();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
	module.exports = WhatsAppCallWidget;
}
