const net = require('net');
require('dotenv').config();

const AMI_HOST = process.env.AMI_HOST || '127.0.0.1';
const AMI_PORT = Number(process.env.AMI_PORT || 5038);

const AMI_USERNAME = process.env.AMI_USERNAME;
const AMI_SECRET = process.env.AMI_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;

const RECONNECT_DELAY = 5000;
const WEBHOOK_TIMEOUT = 10000;
const WEBHOOK_RETRIES = 3;

/**
 * How long we wait after receiving CDR before
 * finalizing the call and sending the webhook.
 *
 * This gives late AMI events a chance to arrive.
 */
const CDR_FINALIZE_DELAY = 1000;

const requiredEnv = [
  'AMI_USERNAME',
  'AMI_SECRET',
  'WEBHOOK_URL',
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[APP] Missing required env: ${key}`);
    process.exit(1);
  }
}

/**
 * Map:
 *
 * LinkedID -> {
 *   events: [],
 *   cdrReceived: boolean,
 *   finalizeTimer: Timeout | null
 * }
 *
 * One logical call can contain multiple UniqueIDs.
 */
const calls = new Map();

let socket = null;
let buffer = '';
let reconnectTimer = null;
let shuttingDown = false;

/**
 * AMI events that are useful for reconstructing
 * the call lifecycle.
 *
 * You can add more events later.
 */
const CALL_EVENTS = new Set([
  'Newchannel',
  'Newstate',
  'NewConnectedLine',
  'NewCallerid',

  'DialBegin',
  'DialEnd',
  'DialState',

  'BridgeCreate',
  'BridgeEnter',
  'BridgeLeave',
  'BridgeDestroy',

  'ChannelTalkingStart',
  'ChannelTalkingStop',

  'HangupRequest',
  'SoftHangupRequest',
  'Hangup',

  'VarSet',

  'Cdr',
]);

function connect() {
  if (shuttingDown) {
    return;
  }

  console.log(
    `[AMI] Connecting to ${AMI_HOST}:${AMI_PORT}...`,
  );

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

    while (
      (separator = buffer.indexOf('\r\n\r\n')) !== -1
    ) {
      const rawMessage = buffer.substring(
        0,
        separator,
      );

      buffer = buffer.substring(
        separator + 4,
      );

      if (rawMessage.trim()) {
        handleMessage(rawMessage);
      }
    }
  });

  socket.on('error', (error) => {
    console.error(
      '[AMI] Error:',
      error.message,
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

function login() {
  if (!socket) {
    return;
  }

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

  /**
   * AMI login/action responses are not call events.
   */
  if (event.Response) {
    console.log(
      `[AMI] Response: ${event.Response} - ${
        event.Message || ''
      }`,
    );

    return;
  }

  /**
   * We only care about actual AMI events.
   */
  if (!event.Event) {
    return;
  }

  /**
   * Ignore events that aren't relevant to
   * call tracking.
   */
  if (!CALL_EVENTS.has(event.Event)) {
    return;
  }

  /**
   * LinkedID identifies the logical call.
   *
   * UniqueID identifies an individual channel.
   *
   * Prefer LinkedID for aggregation.
   */
  const callKey =
    event.LinkedID ||
    event.UniqueID;

  if (!callKey) {
    console.warn(
      `[AMI] Event ${event.Event} has no UniqueID/LinkedID`,
    );

    return;
  }

  let call = calls.get(callKey);

  if (!call) {
    call = {
      linkedId: event.LinkedID || null,

      events: [],

      uniqueIds: new Set(),

      cdrReceived: false,

      finalizeTimer: null,

      createdAt: new Date().toISOString(),
    };

    calls.set(callKey, call);
  }

  /**
   * Track every UniqueID associated with
   * this logical call.
   */
  if (event.UniqueID) {
    call.uniqueIds.add(event.UniqueID);
  }

  /**
   * Store the event.
   */
  call.events.push({
    ...event,

    receivedAt: new Date().toISOString(),
  });

  /**
   * CDR means Asterisk has produced the
   * final CDR for this channel.
   */
  if (event.Event === 'Cdr') {
    call.cdrReceived = true;

    console.log(
      `[AMI] CDR received for LinkedID=${callKey}`,
    );

    scheduleCallFinalization(callKey);
  }
}

function scheduleCallFinalization(callKey) {
  const call = calls.get(callKey);

  if (!call) {
    return;
  }

  /**
   * If another CDR arrives before the timer fires,
   * reset the timer.
   */
  if (call.finalizeTimer) {
    clearTimeout(call.finalizeTimer);
  }

  call.finalizeTimer = setTimeout(() => {
    finalizeCall(callKey);
  }, CDR_FINALIZE_DELAY);
}

function finalizeCall(callKey) {
  const call = calls.get(callKey);

  if (!call) {
    return;
  }

  /**
   * Prevent further modifications to this call
   * while we prepare the webhook.
   */
  calls.delete(callKey);

  if (call.finalizeTimer) {
    clearTimeout(call.finalizeTimer);

    call.finalizeTimer = null;
  }

  const cdrEvents = call.events.filter(
    (event) => event.Event === 'Cdr',
  );

  /**
   * There can be multiple CDRs for one logical call.
   */
  const payload = {
    event: 'call.completed',

    call: {
      linkedId: call.linkedId,

      uniqueIds: Array.from(
        call.uniqueIds,
      ),
    },

    /**
     * Every CDR belonging to this logical call.
     */
    cdrs: cdrEvents,

    /**
     * Complete AMI event history.
     */
    events: call.events,

    receivedAt: new Date().toISOString(),
  };

  sendWebhook(payload);
}

function parseMessage(rawMessage) {
  const event = {};

  const lines = rawMessage.split(/\r?\n/);

  for (const line of lines) {
    const index = line.indexOf(':');

    if (index === -1) {
      continue;
    }

    const key = line
      .substring(0, index)
      .trim();

    const value = line
      .substring(index + 1)
      .trim();

    event[key] = value;
  }

  return event;
}

async function sendWebhook(payload) {
  const linkedId =
    payload.call?.linkedId ||
    'unknown';

  console.log(
    `[WEBHOOK] Sending call ${linkedId}`,
  );

  for (
    let attempt = 1;
    attempt <= WEBHOOK_RETRIES;
    attempt++
  ) {
    try {
      const controller =
        new AbortController();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, WEBHOOK_TIMEOUT);

      try {
        const response = await fetch(
          WEBHOOK_URL,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'X-Asterisk-Linked-ID':
                linkedId,
            },

            body: JSON.stringify(payload),

            signal: controller.signal,
          },
        );

        if (!response.ok) {
          let responseData;

          try {
            responseData =
              await response.json();
          } catch {
            responseData =
              await response.text();
          }

          console.error(
            `[WEBHOOK] Attempt ${attempt} failed`,
          );

          console.error(
            'Status:',
            response.status,
          );

          console.error(
            'Response:',
            responseData,
          );
        } else {
          console.log(
            `[WEBHOOK] Success: ${response.status}`,
          );

          return;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error(
        `[WEBHOOK] Attempt ${attempt} failed:`,
        error.message,
      );
    }

    /**
     * Don't immediately hammer the API.
     */
    if (attempt < WEBHOOK_RETRIES) {
      const delay =
        attempt * 2000;

      console.log(
        `[WEBHOOK] Retrying in ${delay}ms...`,
      );

      await sleep(delay);
    }
  }

  console.error(
    `[WEBHOOK] Permanently failed for call ${linkedId}`,
  );

  /**
   * IMPORTANT:
   *
   * For production you should eventually
   * persist failed webhook payloads into a
   * durable queue/database.
   */
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function scheduleReconnect() {
  if (
    reconnectTimer ||
    shuttingDown
  ) {
    return;
  }

  console.log(
    `[AMI] Reconnecting in ${
      RECONNECT_DELAY / 1000
    } seconds...`,
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    connect();
  }, RECONNECT_DELAY);
}

function shutdown(signal) {
  console.log(
    `\n[APP] Received ${signal}`,
  );

  shuttingDown = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);

    reconnectTimer = null;
  }

  /**
   * Clear call finalization timers.
   */
  for (const call of calls.values()) {
    if (call.finalizeTimer) {
      clearTimeout(
        call.finalizeTimer,
      );
    }
  }

  calls.clear();

  if (socket) {
    socket.destroy();

    socket = null;
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

console.log(
  '========================================',
);

console.log(
  ' Asterisk CDR Webhook Worker',
);

console.log(
  '========================================',
);

console.log(
  `AMI: ${AMI_HOST}:${AMI_PORT}`,
);

console.log(
  `Webhook: ${WEBHOOK_URL}`,
);

console.log(
  '========================================',
);

connect();