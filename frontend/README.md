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

The current product shell maps the Cloud PBX handoff and Stitch direction to these routes:

| Route | Product area | Current state |
| --- | --- | --- |
| `/` | Overview, live status, volume, recent activity | Implemented with deterministic preview data |
| `/calls` | Calling surface and call activity | Implemented with local interaction state; API adapter ready |
| `/people` | People and extensions | Shell and empty module state; backend mapping pending |
| `/inbound` | Inbound routes and IVR | Shell and empty module state; backend mapping pending |
| `/trunks` | SIP trunk configuration | Shell and empty module state; backend mapping pending |
| `/webhooks` | Webhook configuration and delivery logs | Shell and empty module state; backend mapping pending |
| `/health` | Service and telephony health | Shell and empty module state; backend mapping pending |

Visual motifs carried from the Stitch brief: a quiet operations rail, ink-and-amber status language, dense scan-friendly tables, compact monospace metadata, generous white surfaces, and a responsive mobile drawer. The current implementation uses a Vue-compatible icon library and product tokens rather than a pixel-perfect export.

## Backend map

The frontend must use backend REST resources as the source of truth and never call Asterisk directly. Confirmed routes currently include:

- `POST /pbx/trunks`, `GET /pbx/trunks/tenant`, `GET /pbx/trunks/:id`, `PATCH /pbx/trunks/:id`, `DELETE /pbx/trunks/:id`
- `POST /pbx/trunks/:id/sync-asterisk`
- `POST /pbx/extensions/sync-asterisk`

Authentication, login/refresh, call activity, recordings, users/extensions, inbound/IVR, webhooks, and health routes must be confirmed from backend controllers before wiring their views. The client normalizes `{ data }` response envelopes and maps unauthorized/network failures through `src/lib/api.ts`.

### Gap assessment

- **Existing:** SIP trunk CRUD and Asterisk sync, tenant extensions read/list and assignment actions, IVR CRUD, inbound-route CRUD, click-to-call, token refresh, logout, and current-user lookup.
- **Read-only fallback:** The current overview and call activity preview can render deterministic data while call-history and recording read endpoints are confirmed.
- **Missing or unresolved:** A browser-facing password-login endpoint, canonical call-history/recording list endpoints, webhook resource endpoints, and a health endpoint contract. These must be confirmed or added as small backend contracts before the corresponding production views submit data.

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
