# Remove BullMQ DLQ Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the BullMQ `-DLQ` queue setup so jobs that exhaust their attempts stay in their own queue's BullMQ "failed" set (visible in Bull Board's Failed tab).

**Architecture:** BullMQ already keeps exhausted jobs in the failed set (`removeOnFail: false`). The `-DLQ` queues are a second copy that nothing in the BullMQ path ever writes to: `BullMQProducerService.publishEventToDLQ` has no callers. So the work is deleting the dead DLQ code, dropping the `-DLQ` queues from Bull Board monitoring, and pinning the "failed jobs are retained" behavior with a test.

**Tech Stack:** NestJS, BullMQ, ioredis, Jest (ts-jest, specs under `src/**/*.spec.ts`)

**Spec:** None. The requirement is the user request: "remove DLQ setup as bullMQ keep the failed jobs in bullMQ failed section".

## Global Constraints

- Scope is BullMQ only. Do NOT touch `src/infra/kafka/**` (Kafka has its own `publishEventToDLQ` to an `<event>-DLQ` topic, called from `kafka-consumer.service.ts`; it is a separate system).
- `removeOnFail` stays `false` (JOB_CONFIG.REMOVE_ON_FAIL) so failed jobs are never auto-deleted.
- Tests live next to the source as `*.spec.ts`; run with `npx jest <path>`.
- Existing queue naming `{${queueName}}` (hash-tag braces) must not change.

## Review Focus

- Bull Board must still list every event queue plus `scheduler` after the change (only `-DLQ` entries disappear).
- `getFailedJobs(eventName)` and `getQueueJobCounts(eventName)` must keep working on the main queue, because that is now the only place failed jobs live.
- Jobs that exhaust attempts must retain `removeOnFail: false` on enqueue, or failures would silently vanish.
- Existing `-DLQ` queues/keys already in Redis are left orphaned. They are not deleted by this change (see Task 2 note).
- `SubscriberConfig.maxAttempts` doc comment must no longer promise a DLQ move.

---

### Task 1: Remove DLQ code from the BullMQ producer, with tests

**Files:**
- Create: `src/infra/bullmq/services/bullmq-producer.service.spec.ts`
- Modify: `src/infra/bullmq/services/bullmq-producer.service.ts` (lines 17, 88-96, 222-226)

**Interfaces:**
- Consumes: existing `BullMQProducerService.prepareMonitoringQueues(eventNames: string[]): Queue[]`, `publishEvent(eventName, message)`, `getFailedJobs(queueName, start?, end?)`.
- Produces: same public API minus `publishEventToDLQ`. `prepareMonitoringQueues` returns queues for `eventNames` + `'scheduler'` only.

- [ ] **Step 1: Write the failing test**

Create `src/infra/bullmq/services/bullmq-producer.service.spec.ts`:

```ts
const queueAdd = jest.fn();
const queueGetFailed = jest.fn();
const createdQueueNames: string[] = [];

jest.mock('bullmq', () => ({
	Queue: jest.fn().mockImplementation((name: string) => {
		createdQueueNames.push(name);
		return { name, add: queueAdd, getFailed: queueGetFailed, close: jest.fn() };
	}),
	Job: class {},
}));

jest.mock('ioredis', () =>
	jest.fn().mockImplementation(() => ({ on: jest.fn(), status: 'wait' })),
);

jest.mock('../../../config/env.config', () => ({ env: {} }));
jest.mock('../../redis/redis.config', () => ({ buildRedisOptions: jest.fn(() => ({})) }));

import { BullMQProducerService } from './bullmq-producer.service';

describe('BullMQProducerService (no DLQ)', () => {
	let service: BullMQProducerService;

	beforeEach(() => {
		jest.clearAllMocks();
		createdQueueNames.length = 0;
		queueAdd.mockResolvedValue({ id: 'job-1' });
		service = new BullMQProducerService();
	});

	it('prepareMonitoringQueues creates only event queues and scheduler, no -DLQ queues', () => {
		const queues = service.prepareMonitoringQueues(['evt.a', 'evt.b']);

		expect(queues).toHaveLength(3);
		expect(createdQueueNames).toEqual(['{evt.a}', '{evt.b}', '{scheduler}']);
		expect(createdQueueNames.some((n) => n.includes('-DLQ'))).toBe(false);
	});

	it('does not expose publishEventToDLQ', () => {
		expect((service as unknown as Record<string, unknown>).publishEventToDLQ).toBeUndefined();
	});

	it('enqueues jobs with removeOnFail=false so exhausted jobs stay in the failed set', async () => {
		await service.publishEvent('evt.a', { foo: 1 });

		expect(queueAdd).toHaveBeenCalledTimes(1);
		const opts = queueAdd.mock.calls[0][2];
		expect(opts.removeOnFail).toBe(false);
	});

	it('getFailedJobs reads from the main event queue', async () => {
		queueGetFailed.mockResolvedValue([
			{ id: '1', name: 'evt.a', data: {}, failedReason: 'boom', attemptsMade: 10, timestamp: 1, finishedOn: 2 },
		]);

		const failed = await service.getFailedJobs('evt.a');

		expect(createdQueueNames).toEqual(['{evt.a}']);
		expect(failed).toEqual([
			{ id: '1', name: 'evt.a', data: {}, failedReason: 'boom', attemptsMade: 10, timestamp: 1, finishedOn: 2 },
		]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/infra/bullmq/services/bullmq-producer.service.spec.ts`
Expected: FAIL. `prepareMonitoringQueues` test sees 5 queues including `{evt.a-DLQ}`, and `publishEventToDLQ` is still defined. (The `removeOnFail` and `getFailedJobs` tests already pass; they pin existing behavior.)

- [ ] **Step 3: Write minimal implementation**

In `src/infra/bullmq/services/bullmq-producer.service.ts`:

1. Delete the line `  DLQ_SUFFIX: '-DLQ',` from `JOB_CONFIG`.
2. Replace `prepareMonitoringQueues` body:

```ts
  /** Register all known queues so Bull Board can monitor them. Failed jobs appear in each queue's Failed tab. Call after connect(). */
  prepareMonitoringQueues(eventNames: string[]): Queue[] {
    const queueKeys = [...eventNames, 'scheduler'];

    return queueKeys.map((name) => this.getQueue(name));
  }
```

3. Delete the whole `publishEventToDLQ` method (the 5 lines starting `async publishEventToDLQ(`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/infra/bullmq/services/bullmq-producer.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (Confirms nothing else referenced `DLQ_SUFFIX` or `BullMQProducerService.publishEventToDLQ`; Kafka's own method of the same name is on a different class and is untouched.)

- [ ] **Step 6: Commit**

```bash
git add src/infra/bullmq/services/bullmq-producer.service.ts src/infra/bullmq/services/bullmq-producer.service.spec.ts
git commit -m "refactor(bullmq): remove DLQ queues, keep failed jobs in BullMQ failed set"
```

---

### Task 2: Fix stale DLQ documentation

**Files:**
- Modify: `src/infra/queue/subscriber-config.ts:43`

**Interfaces:**
- Consumes: nothing.
- Produces: no code change; comment only.

- [ ] **Step 1: Update the comment**

Change line 43 from:

```ts
  /** Max BullMQ job attempts before moving to DLQ (default: 10) */
```

to:

```ts
  /** Max BullMQ job attempts before the job is left in the queue's failed set (default: 10) */
```

- [ ] **Step 2: Verify no BullMQ DLQ references remain**

Run: `grep -rniE "dlq|dead.?letter" src --include=*.ts | grep -v "src/infra/kafka"`
Expected: no output.

- [ ] **Step 3: Run the full suite**

Run: `npx jest`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add src/infra/queue/subscriber-config.ts
git commit -m "docs(queue): update maxAttempts comment now that BullMQ has no DLQ"
```

**Note (not a task):** any `{<event>-DLQ}` keys already in Redis stay orphaned and invisible in Bull Board. They were never written by this code path, so they should be empty. If you want them gone, run `redis-cli --scan --pattern 'bull:{*-DLQ}:*'` in each environment and review before deleting.

---

## Self-Review

- **Coverage:** DLQ constant, monitoring queues, producer method, stale comment are all handled. Failed-job retention is pinned by a test. Kafka DLQ is deliberately out of scope.
- **Placeholders:** none.
- **Consistency:** `prepareMonitoringQueues`, `publishEventToDLQ`, `getFailedJobs` names match the source.
