# Inbound Queue Management

Tenant-scoped call-center hunt queues. Statsis owns the queue configuration,
membership, and agent-distribution logic; Asterisk (via ARI) only handles the
underlying telephony primitives (originate, bridge, hang up). See
`src/modules/calls/services/queue-call-workflow.service.ts` for the runtime
call-distribution engine and `services/asterisk-queue-adapter.service.ts` for
the Asterisk translation layer.

All endpoints require a JWT access token (`Authorization: Bearer <token>`) and
a tenant on the session (`403` otherwise).

## Queues

| Method | Path            | Description                     |
| ------ | --------------- | -------------------------------- |
| POST   | `/queues`       | Create a queue                   |
| GET    | `/queues`       | List queues for the tenant        |
| GET    | `/queues/:id`   | Get one queue                    |
| PATCH  | `/queues/:id`   | Update a queue                   |
| DELETE | `/queues/:id`   | Delete a queue                   |

`strategy` is one of `ring_all`, `round_robin`, `least_recent`,
`fewest_calls`, `random`.

### Create a queue

```http
POST /queues
Content-Type: application/json

{
  "name": "Sales",
  "description": "Inbound sales line",
  "strategy": "ring_all",
  "ringTimeoutSeconds": 15,
  "maxWaitTimeSeconds": 300,
  "maxCallers": 10,
  "musicOnHoldId": "6b1e2b8e-2f3e-4a86-9f9d-8f2e2f9c9a11"
}
```

```json
{
  "message": "Queue created",
  "data": {
    "id": "queue_sales",
    "tenantId": "tenant_1",
    "name": "Sales",
    "strategy": "ring_all",
    "ringTimeoutSeconds": 15,
    "maxWaitTimeSeconds": 300,
    "maxCallers": 10,
    "enabled": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Deleting a queue that is still targeted by an inbound route (see below) is
rejected with `409 Conflict` — reassign the route first.

## Queue members

| Method | Path                          | Description                  |
| ------ | ----------------------------- | ----------------------------- |
| POST   | `/queues/:id/members`         | Add an agent to the queue     |
| GET    | `/queues/:id/members`         | List a queue's members        |
| DELETE | `/queues/:id/members/:agentId`| Remove an agent from the queue|

`agentId` is a user id; the agent must belong to the same tenant as the
queue. An agent may belong to multiple queues.

```http
POST /queues/queue_sales/members
Content-Type: application/json

{ "agentId": "user_42", "priority": 0, "penalty": 0 }
```

## Inbound-route integration

Point an inbound route at a queue by setting `destinationType` to `queue`
and `destinationId` to the queue id:

```json
{
  "sourceType": "phone_number",
  "sourceValue": "+911140001234",
  "destinationType": "queue",
  "destinationId": "queue_sales"
}
```

Call flow: `SIP Trunk → Asterisk → Inbound Route → Statsis → Queue →
Eligible Queue Members → Agent`.

## Runtime events

Every business-level queue event is persisted (for analytics) as a row in
`queue_call_events`, keyed by the caller's `queue_calls` row:
`entered_queue`, `position_changed`, `agent_offered`, `agent_answered`,
`agent_rejected`, `agent_unavailable`, `caller_abandoned`, `queue_timeout`,
`queue_full`, `call_bridged`, `call_completed`.
