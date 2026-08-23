const net = require('net');
require('dotenv').config();

const AMI_HOST = process.env.AMI_HOST || '127.0.0.1';
const AMI_PORT = Number(process.env.AMI_PORT || 5038);

const AMI_USERNAME = process.env.AMI_USERNAME;
const AMI_SECRET = process.env.AMI_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;

const requiredEnv = ['AMI_USERNAME', 'AMI_SECRET', 'WEBHOOK_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[APP] Missing required env: ${key}`);
    process.exit(1);
  }
}

let socket;
let buffer = '';
let reconnectTimer;

function connect() {
  console.log(`[AMI] Connecting to ${AMI_HOST}:${AMI_PORT}...`);

  socket = net.createConnection({
    host: AMI_HOST,
    port: AMI_PORT,
  });

  socket.setEncoding('utf8');

  socket.on('connect', () => {
    console.log('[AMI] Connected');

    login();
  });

  socket.on('data', (data) => {
    buffer += data;

    let separator;

    while ((separator = buffer.indexOf('\r\n\r\n')) !== -1) {
      const rawMessage = buffer.substring(0, separator);

      buffer = buffer.substring(separator + 4);

      if (rawMessage.trim()) {
        handleMessage(rawMessage);
      }
    }
  });

  socket.on('error', (error) => {
    console.error('[AMI] Error:', error.message);
  });

  socket.on('close', () => {
    console.log('[AMI] Connection closed');

    scheduleReconnect();
  });
}

function login() {
  const request =
    'Action: Login\r\n' +
    `Username: ${AMI_USERNAME}\r\n` +
    `Secret: ${AMI_SECRET}\r\n` +
    'Events: on\r\n' +
    '\r\n';

  socket.write(request);

  console.log('[AMI] Login sent');
}

function handleMessage(rawMessage) {
  const event = parseMessage(rawMessage);

  if (event.Response) {
    console.log(
      `[AMI] Response: ${event.Response} - ${event.Message || ''}`
    );
  }

  if (event.Event === 'Cdr') {
    console.log('');
    console.log('================================');
    console.log('CDR EVENT RECEIVED');
    console.log('================================');

    console.log(event);

    console.log('================================');
    console.log('');

    sendWebhook(event);
  }
}

function parseMessage(rawMessage) {
  const event = {};

  const lines = rawMessage.split(/\r?\n/);

  for (const line of lines) {
    const index = line.indexOf(':');

    if (index === -1) {
      continue;
    }

    const key = line.substring(0, index).trim();

    const value = line
      .substring(index + 1)
      .trim();

    event[key] = value;
  }

  return event;
}

async function sendWebhook(cdr) {
  const payload = {
    event: 'call.completed',

    cdr: {
      accountCode: cdr.AccountCode || null,

      source: cdr.Source || null,
      destination: cdr.Destination || null,

      destinationContext:
        cdr.DestinationContext || null,

      callerId: cdr.CallerID || null,

      channel: cdr.Channel || null,

      destinationChannel:
        cdr.DestinationChannel || null,

      lastApplication:
        cdr.LastApplication || null,

      lastData:
        cdr.LastData || null,

      startTime:
        cdr.StartTime || null,

      answerTime:
        cdr.AnswerTime || null,

      endTime:
        cdr.EndTime || null,

      duration:
        Number(cdr.Duration || 0),

      billableSeconds:
        Number(cdr.BillableSeconds || 0),

      disposition:
        cdr.Disposition || null,

      amaFlags:
        cdr.AMAFlags || null,

      uniqueId:
        cdr.UniqueID || null,

      linkedId:
        cdr.LinkedID || null,

      userField:
        cdr.UserField || null,
    },

    raw: cdr,

    receivedAt: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    console.log(
      `[WEBHOOK] Sending ${cdr.UniqueID}`
    );

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      let responseData;

      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }

      console.error('[WEBHOOK] Failed:', response.statusText);
      console.error('Status:', response.status);
      console.error('Response:', responseData);
      return;
    }

    console.log(
      `[WEBHOOK] Success: ${response.status}`
    );
  } catch (error) {
    console.error(
      '[WEBHOOK] Failed:',
      error.message
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  console.log(
    '[AMI] Reconnecting in 5 seconds...'
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    connect();
  }, 5000);
}

process.on('SIGINT', () => {
  console.log('\n[APP] Shutting down...');

  if (socket) {
    socket.destroy();
  }

  process.exit(0);
});

process.on('SIGTERM', () => {
  if (socket) {
    socket.destroy();
  }

  process.exit(0);
});

console.log('========================================');
console.log(' Asterisk CDR Webhook Worker');
console.log('========================================');
console.log(`AMI: ${AMI_HOST}:${AMI_PORT}`);
console.log(`Webhook: ${WEBHOOK_URL}`);
console.log('========================================');

connect();