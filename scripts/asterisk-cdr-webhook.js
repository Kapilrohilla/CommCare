const net = require('net');
const dotenv = require('dotenv');

dotenv.config();

const AMI_HOST = process.env.AMI_HOST || '127.0.0.1';
const AMI_PORT = Number(process.env.AMI_PORT || 5038);

const AMI_USERNAME = process.env.AMI_USERNAME;
const AMI_SECRET = process.env.AMI_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_TIMEOUT = Number(process.env.WEBHOOK_TIMEOUT || 10000);
const WEBHOOK_RETRIES = Number(process.env.WEBHOOK_RETRIES || 3);

if (!AMI_USERNAME || !AMI_SECRET || !WEBHOOK_URL) {
	console.error('Missing required environment variables.');
	process.exit(1);
}

let socket = null;
let buffer = '';
let reconnectTimer = null;
let shuttingDown = false;

/**
 * Parse an AMI message:
 *
 * Event: Cdr
 * Privilege: cdr,all
 * Source: 102
 * Destination: 101
 *
 * into:
 *
 * {
 *   Event: "Cdr",
 *   Privilege: "cdr,all",
 *   Source: "102",
 *   Destination: "101"
 * }
 */
function parseAmiMessage(message) {
	const lines = message.split(/\r?\n/);

	const event = {};

	for (const line of lines) {
		if (!line.trim()) {
			continue;
		}

		const separatorIndex = line.indexOf(':');

		if (separatorIndex === -1) {
			continue;
		}

		const key = line.substring(0, separatorIndex).trim();

		const value = line
			.substring(separatorIndex + 1)
			.trim();

		event[key] = value;
	}

	return event;
}

/**
 * Convert Asterisk CDR event to our application's payload.
 */
function normalizeCdr(event) {
	return {
		event: 'call.completed',

		pbx: {
			provider: 'asterisk'
		},

		cdr: {
			accountCode: event.AccountCode || null,

			source: event.Source || null,
			destination: event.Destination || null,
			destinationContext: event.DestinationContext || null,

			callerId: event.CallerID || null,

			channel: event.Channel || null,
			destinationChannel: event.DestinationChannel || null,

			lastApplication: event.LastApplication || null,
			lastData: event.LastData || null,

			startTime: event.StartTime || null,
			answerTime: event.AnswerTime || null,
			endTime: event.EndTime || null,

			duration: toNumber(event.Duration),
			billableSeconds: toNumber(event.BillableSeconds),

			disposition: event.Disposition || null,
			amaFlags: event.AMAFlags || null,

			uniqueId: event.UniqueID || null,
			linkedId: event.LinkedID || null,

			userField: event.UserField || null
		},

		// Keep the original Asterisk event too.
		raw: event,

		receivedAt: new Date().toISOString()
	};
}

function toNumber(value) {
	if (value === undefined || value === null || value === '') {
		return 0;
	}

	const number = Number(value);

	return Number.isNaN(number) ? 0 : number;
}

/**
 * Send CDR to NestJS.
 */
async function sendWebhook(payload) {
	let lastError;

	for (let attempt = 1; attempt <= WEBHOOK_RETRIES; attempt++) {
		try {
			console.log(
				`[WEBHOOK] Sending CDR ${payload.cdr.uniqueId} ` +
				`(attempt ${attempt}/${WEBHOOK_RETRIES})`
			);

			//   const response = await axios.post(
			//     WEBHOOK_URL,
			//     payload,
			//     {
			//       timeout: WEBHOOK_TIMEOUT,

			//       headers: {
			//         'Content-Type': 'application/json'
			//       }
			//     }
			//   );
			const response = await fetch(WEBHOOK_URL, {
				method: 'POST',
				body: JSON.stringify(payload),
				headers: {
					'Content-Type': 'application/json',
				}
			})
			const isOk = response.ok;
			if (isOk) {
				console.log(
					`[WEBHOOK] Success ${response.status} ` +
					`for CDR ${payload.cdr.uniqueId}`
				);

				return true;
			} else {
				console.error(
					`[WEBHOOK] Failed attempt ${attempt}:`,
					response.status
				);
				return false;
			}
		} catch (error) {
			lastError = error;

			const status = error.response?.status;
			const message = error.message;

			console.error(
				`[WEBHOOK] Failed attempt ${attempt}:`,
				status || message
			);

			if (attempt < WEBHOOK_RETRIES) {
				const delay = attempt * 2000;

				console.log(
					`[WEBHOOK] Retrying in ${delay}ms...`
				);

				await sleep(delay);
			}
		}
	}

	console.error(
		`[WEBHOOK] Giving up for CDR ${payload.cdr.uniqueId}`,
		lastError?.message
	);

	return false;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle a complete AMI message.
 */
async function handleAmiMessage(message) {
	const event = parseAmiMessage(message);

	if (!event.Event && !event.Response) {
		return;
	}

	/**
	 * Login response
	 */
	if (event.Response === 'Success') {
		console.log(
			`[AMI] ${event.Message || 'AMI response success'}`
		);
	}

	/**
	 * Login failure
	 */
	if (event.Response === 'Error') {
		console.error(
			`[AMI] Error: ${event.Message || 'Unknown AMI error'}`
		);
	}

	/**
	 * We only care about CDR events for the webhook.
	 */
	if (event.Event === 'Cdr') {
		console.log('');
		console.log('========================================');
		console.log('[AMI] CDR EVENT RECEIVED');
		console.log('========================================');

		console.log({
			uniqueId: event.UniqueID,
			linkedId: event.LinkedID,
			source: event.Source,
			destination: event.Destination,
			duration: event.Duration,
			billableSeconds: event.BillableSeconds,
			disposition: event.Disposition
		});

		console.log('========================================');
		console.log('');

		const payload = normalizeCdr(event);

		await sendWebhook(payload);
	}
}

/**
 * Send AMI login request.
 */
function login() {
	const loginRequest =
		'Action: Login\r\n' +
		`Username: ${AMI_USERNAME}\r\n` +
		`Secret: ${AMI_SECRET}\r\n` +
		'Events: on\r\n' +
		'ActionID: cdr-webhook-login\r\n' +
		'\r\n';

	socket.write(loginRequest);

	console.log('[AMI] Login request sent');
}

/**
 * Connect to Asterisk AMI.
 */
function connect() {
	if (shuttingDown) {
		return;
	}

	console.log(
		`[AMI] Connecting to ${AMI_HOST}:${AMI_PORT}...`
	);

	socket = new net.Socket();

	socket.setEncoding('utf8');

	socket.on('connect', () => {
		console.log('[AMI] TCP connection established');

		login();
	});

	socket.on('data', async (data) => {
		buffer += data;

		/**
		 * AMI messages are separated by a blank line.
		 */
		let separatorIndex;

		while (
			(separatorIndex = buffer.indexOf('\r\n\r\n')) !== -1
		) {
			const message = buffer.substring(
				0,
				separatorIndex
			);

			buffer = buffer.substring(
				separatorIndex + 4
			);

			if (!message.trim()) {
				continue;
			}

			try {
				await handleAmiMessage(message);
			} catch (error) {
				console.error(
					'[AMI] Error handling event:',
					error
				);
			}
		}
	});

	socket.on('error', (error) => {
		console.error(
			'[AMI] Socket error:',
			error.message
		);
	});

	socket.on('close', () => {
		console.log('[AMI] Connection closed');

		socket = null;

		if (!shuttingDown) {
			scheduleReconnect();
		}
	});
}

/**
 * Reconnect after connection loss.
 */
function scheduleReconnect() {
	if (reconnectTimer || shuttingDown) {
		return;
	}

	console.log('[AMI] Reconnecting in 5 seconds...');

	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;

		connect();
	}, 5000);
}

/**
 * Graceful shutdown.
 */
function shutdown() {
	console.log('[APP] Shutting down...');

	shuttingDown = true;

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	if (socket) {
		socket.destroy();
		socket = null;
	}

	process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('========================================');
console.log(' Asterisk CDR Webhook Worker');
console.log('========================================');
console.log(`AMI: ${AMI_HOST}:${AMI_PORT}`);
console.log(`Webhook: ${WEBHOOK_URL}`);
console.log('========================================');

connect();