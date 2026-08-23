const net = require('net');
require('dotenv').config();
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'asterisk-cdr-webhook' },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

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
    logger.fatal({ component: 'app', env: key }, 'Missing required env');
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

  logger.info(
    { component: 'ami', host: AMI_HOST, port: AMI_PORT },
    'Connecting to AMI',
  );

  socket = net.createConnection({
    host: AMI_HOST,
    port: AMI_PORT,
  });

  socket.setEncoding('utf8');

  socket.on('connect', () => {
    logger.info({ component: 'ami' }, 'Connected to AMI');

    login();
  });

  socket.on('data', (data) => {
    logger.debug(
      { component: 'ami', bytes: data.length },
      'AMI data received',
    );

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
    logger.error(
      { component: 'ami', err: error },
      'AMI connection error',
    );
  });

  socket.on('close', () => {
    logger.info({ component: 'ami' }, 'AMI connection closed');

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

  logger.info({ component: 'ami' }, 'AMI login sent');
}

function handleMessage(rawMessage) {
  logger.debug(
    { component: 'ami', rawMessage },
    'AMI raw message received',
  );

  const event = parseMessage(rawMessage);

  logger.debug(
    { component: 'ami', event },
    'AMI event parsed',
  );

  /**
   * AMI login/action responses are not call events.
   */
  if (event.Response) {
    logger.info(
      {
        component: 'ami',
        response: event.Response,
        message: event.Message || '',
      },
      'AMI action response',
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
    logger.warn(
      { component: 'ami', eventName: event.Event },
      'AMI event missing UniqueID/LinkedID',
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

    logger.info(
      { component: 'ami', linkedId: callKey },
      'CDR received',
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

  // Normalize Asterisk field names
  if (event.Uniqueid && !event.UniqueID) {
    event.UniqueID = event.Uniqueid;
  }

  if (event.Linkedid && !event.LinkedID) {
    event.LinkedID = event.Linkedid;
  }

  return event;
}

async function sendWebhook(payload) {
  const linkedId =
    payload.call?.linkedId ||
    'unknown';

  logger.info(
    { component: 'webhook', linkedId },
    'Sending webhook',
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

          logger.error(
            {
              component: 'webhook',
              linkedId,
              attempt,
              status: response.status,
              response: responseData,
            },
            'Webhook attempt failed',
          );
        } else {
          logger.info(
            {
              component: 'webhook',
              linkedId,
              status: response.status,
            },
            'Webhook delivered',
          );

          return;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      logger.error(
        {
          component: 'webhook',
          linkedId,
          attempt,
          err: error,
        },
        'Webhook attempt failed',
      );
    }

    /**
     * Don't immediately hammer the API.
     */
    if (attempt < WEBHOOK_RETRIES) {
      const delay =
        attempt * 2000;

      logger.info(
        { component: 'webhook', linkedId, attempt, delayMs: delay },
        'Retrying webhook',
      );

      await sleep(delay);
    }
  }

  logger.error(
    { component: 'webhook', linkedId },
    'Webhook permanently failed',
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

  logger.info(
    { component: 'ami', delayMs: RECONNECT_DELAY },
    'Scheduling AMI reconnect',
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    connect();
  }, RECONNECT_DELAY);
}

function shutdown(signal) {
  logger.info(
    { component: 'app', signal },
    'Shutdown requested',
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

logger.info(
  {
    component: 'app',
    amiHost: AMI_HOST,
    amiPort: AMI_PORT,
    webhookUrl: WEBHOOK_URL,
  },
  'Asterisk CDR Webhook Worker started',
);

connect();
