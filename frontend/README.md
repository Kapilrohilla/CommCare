# CommCare Frontend

Vue 3 operations console for the CommCare Cloud PBX platform.

## Run locally

```sh
pnpm install
cp .env-example .env
pnpm dev
```

The API base URL is configurable with `VITE_API_BASE_URL` and defaults to `http://3.109.68.132:3000`. `.env` is local-only and must never contain committed credentials.

## Screen inventory

The fixed desktop rail groups screens as Command center, Calling, Configuration, and Integrations & system. The mobile rail becomes a drawer. Each route has its own file under `src/views/`:

| Route | Product area | Current state |
| --- | --- | --- |
| `/` | Overview, live status, volume, recent activity | `OverviewView.vue`, wired to `GET /calls/dashboard` |
| `/setup` | First-run tenant setup checklist | `SetupChecklistView.vue`, explicit blockers |
| `/dialer` | Async click-to-call surface | `DialerView.vue`, backend adapter wired |
| `/calls`, `/calls/:id` | Calls list and detail | `CallsView.vue` (wired to `GET /calls/tenant`), `CallDetailView.vue` placeholder |
| `/people`, `/extensions` | People and extension inventory | `PeopleView.vue`, `ExtensionsView.vue` |
| `/inbound`, `/ivr` | Inbound routes and IVR menus | `InboundRoutesView.vue`, `IvrMenusView.vue` |
| `/recordings`, `/trunks` | Recording library and SIP trunks | `RecordingsView.vue`, `SipTrunksView.vue` |
| `/webhooks`, `/webhook-logs` | Webhook registry and delivery logs | `WebhooksView.vue`, `WebhookLogsView.vue` |
| `/health`, `/settings` | System health and workspace settings | `SystemHealthView.vue`, `SettingsView.vue` |

Visual motifs carried from the Stitch brief: a quiet operations rail, ink-and-amber status language, dense scan-friendly tables, compact monospace metadata, generous white surfaces, and a responsive mobile drawer. The current implementation uses a Vue-compatible icon library and product tokens rather than a pixel-perfect export.

## Backend map

The frontend must use backend REST resources as the source of truth and never call Asterisk directly. Confirmed routes currently include:

- `GET /calls/dashboard`, `GET /calls/tenant`, `GET /calls/:id`
- `POST /calls/click-to-call`, `POST /calls/dialer/session`
- `POST /pbx/trunks`, `GET /pbx/trunks/tenant`, `GET /pbx/trunks/:id`, `PATCH /pbx/trunks/:id`, `DELETE /pbx/trunks/:id`
- `POST /pbx/trunks/:id/sync-asterisk`
- `POST /pbx/extensions/sync-asterisk`
- `GET /system-recordings/tenant`

The client normalizes `{ data }` response envelopes and maps unauthorized/network failures through `src/lib/api.ts`. Feature adapters live under `src/lib/services/` and never call Asterisk directly.

### Gap assessment

- **Existing:** Call dashboard/list/detail reads, SIP trunk CRUD and Asterisk sync, tenant extensions read/list and assignment actions, IVR CRUD, inbound-route CRUD, click-to-call, system recording list, token refresh, logout, and current-user lookup.
- **Read-only fallback:** Setup checklist and some configuration tables still use fixtures until create/edit modals are wired.
- **Missing or unresolved:** A browser-facing password-login endpoint, call-recording playback URL for browsers (telephony playback is internal), webhook registry/log adapters where not yet wired in views, and a detailed health contract. Planned backend additions require existing JWT/tenant guards, Zod validation, `ResponseService`, and focused tests before production wiring.

The current sign-in screen is a visual/session-boundary preview and must be connected to the backend's real authentication flow before production deployment; it does not claim to authenticate against the API.

## Validation

```sh
pnpm typecheck
pnpm build
pnpm lint
pnpm test
pnpm test:e2e
```

The default tests are intended to use mocked responses and do not require the public backend. Live smoke checks should be opt-in and require backend availability, authentication, and browser CORS configuration.# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).
