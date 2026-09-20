## 1. Baseline and shell decomposition

- [x] 1.1 Confirm the moved repository baseline in `frontend/`, run install/typecheck/build/unit/browser commands, and record the current green baseline before edits.
- [x] 1.2 Split the current application shell into `AppShell.vue`, `Sidebar.vue`, `ScreenHeader.vue`, and shared state/action primitives; verify each component has an isolated render or unit test.
- [x] 1.3 Implement the fixed desktop rail and independently scrolling main content container, including focus behavior and reduced-width breakpoints; verify desktop scroll leaves the rail stationary and `scrollWidth` does not exceed the viewport.
- [x] 1.4 Group sidebar navigation into Command center, Calling, Configuration, and Integrations & system with permission metadata and tenant/account context; verify active links and mobile drawer behavior in desktop/mobile Playwright tests.
- [ ] 1.5 Create one route-level file for every planned screen and update route metadata/page titles; verify the route map resolves each view without falling back to a monolithic workspace component.
- [x] 1.6 Commit the shell/navigation phase after typecheck, unit tests, browser tests, and responsive screenshot checks pass.

## 2. Shared screen infrastructure

- [x] 2.1 Add shared `ResourceState`, `StatusBadge`, `DataTable`, `ConfirmDialog`, `DetailDrawer`, and `SensitiveValue` components; verify loading, empty, error, forbidden, stale, pending, and redacted states with component tests.
- [x] 2.2 Add typed feature service modules for auth/session, calls, tenancy/extensions, inbound routes, IVR, trunks, recordings, webhooks/logs, and health using the existing API envelope and access-token adapter; verify request/response contract fixtures for each existing controller.
- [x] 2.3 Define screen-level fixtures and route permission metadata for administrator, operator, integration owner, and platform administrator states; verify unauthorized actions are hidden or disabled without hiding the tenant context.

## 3. Authentication, setup, and command center screens

- [ ] 3.1 Implement dedicated sign-in and OTP views with request, verify, resend, expiry, invalid, locked, loading, success, and logout states using the confirmed backend auth contract; verify token/session tests do not request tenant data before authentication.
- [ ] 3.2 Implement the first-run tenant setup checklist for profile, users, extensions, trunk, route, IVR/recording, test call, and webhook steps; verify progress reflects backend-confirmed completion and shows blockers instead of optimistic completion.
- [ ] 3.3 Implement the overview screen with tenant-scoped operational metrics, recent calls, extension availability, inbound/trunk status, webhook attention, and place-call action; verify unavailable metrics render honest unknown states without invented analytics.

## 4. Calling screens

- [x] 4.1 Implement `DialerView.vue` with assigned-extension selection, internal/external mode, destination validation, suggestions, caller-ID preview, duplicate-submit prevention, and asynchronous call states; verify accepted and rejected click-to-call flows against fixtures.
- [x] 4.2 Implement `CallsView.vue` with date, direction, workflow, status, agent/extension, and phone filters plus responsive table-to-row behavior; verify populated, partial, empty, stale, failed, and permission-denied states.
- [ ] 4.3 Implement `CallDetailView.vue` with participant summary, lifecycle timestamps, leg summary, event timeline, progressive diagnostics, recording availability, and related webhook events; verify partial/in-progress call data does not break rendering.
- [ ] 4.4 Implement recording playback/download actions and safe missing-recording states using backend-provided URLs only; verify passwords, tokens, and private payload fields are absent from rendered output and snapshots.
- [x] 4.5 Commit the calling phase after focused API fixtures, unit tests, desktop/mobile browser flows, and responsive checks pass.

## 5. People and inbound configuration screens

- [ ] 5.1 Implement `PeopleView.vue` with tenant users, statuses, assigned extensions, edit, assign, and unassign workflows using backend validation and confirmation dialogs; verify failed mutations preserve retryable form values.
- [ ] 5.2 Implement `ExtensionsView.vue` with inventory status, assignment, caller ID, type, provisioning state, bulk registration, unassign, unregister, and sync actions supported by the backend; verify destructive actions execute only after confirmation.
- [ ] 5.3 Implement `InboundRoutesView.vue` with route list, source-to-destination editor, enabled state, validation summary, duplicate/disabled warnings, and backend-confirmed save/delete behavior; verify unsupported destination fields are excluded from payloads.
- [ ] 5.4 Implement `IvrMenusView.vue` with supported announcement and keypad option fields, destination selection, add/edit/remove/reorder, and preview/test state without introducing an unsupported visual flow editor; verify DTO validation errors map back to the form.
- [ ] 5.5 Commit the people/inbound phase after endpoint contract tests, CRUD tests, confirmation tests, and mobile form checks pass.

## 6. Trunks, integrations, and health screens

- [ ] 6.1 Implement `SipTrunksView.vue` with IP/credentials modes, identify IPs, enabled state, masked write-only credentials, sync-to-PBX result, and delete warning; verify saved passwords never render or log.
- [ ] 6.2 Implement `RecordingsView.vue` as a tenant-scoped recording library with processing states, metadata, play/download, replace/delete where supported, and safe failure/retry states; verify unsupported upload/TTS actions remain unavailable rather than simulated.
- [ ] 6.3 Implement `WebhooksView.vue` with registry CRUD, event labels, active/paused state, masked headers, and supported test/pause actions; verify sensitive header values are redacted in UI and fixtures.
- [ ] 6.4 Implement `WebhookLogsView.vue` with filters, status/latency/response metadata, retry state where supported, and sanitized detail drawer; verify payload/header redaction tests pass.
- [ ] 6.5 Implement `SystemHealthView.vue` with API-provided dependency states, timestamps, refresh, investigation guidance, and degraded/unavailable/unknown states without direct Asterisk calls; verify health failures remain recoverable.
- [ ] 6.6 Implement `SettingsView.vue` and account/tenant context actions using confirmed backend contracts; verify tenant switching cannot display data before context is established.
- [ ] 6.7 Commit the configuration/integrations phase after focused endpoint tests, redaction tests, and desktop/mobile browser checks pass.

## 7. Backend gap assessment and additions

- [ ] 7.1 Compare every screen action with current backend controllers, DTOs, guards, entities, and response envelopes; record each action as existing, read-only fallback, or confirmed gap before changing backend code.
- [ ] 7.2 Add only confirmed minimal APIs for production authentication, call history/detail, recordings, webhook registry/logs, health detail, or other required gaps, reusing existing tenant guards, validation pipes, response service, and entity services; verify focused backend success, validation, unauthorized, and tenant-isolation tests.
- [ ] 7.3 Wire approved backend additions into frontend services and replace only the corresponding fixtures; verify no frontend module calls Asterisk or duplicates provisioning/orchestration logic.
- [ ] 7.4 Commit each approved backend-gap phase separately with its frontend contract tests and backend tests green.

## 8. Final verification and delivery

- [ ] 8.1 Add unit coverage for route permissions, session expiry, screen resource states, form payload mapping, asynchronous call states, confirmations, and secret redaction; verify the unit suite passes.
- [ ] 8.2 Add browser coverage for fixed-sidebar scrolling, grouped navigation, every screen route, mobile drawer, call lifecycle, CRUD confirmation, retry/error states, and responsive non-overlap; verify desktop/tablet/mobile projects pass.
- [ ] 8.3 Add an opt-in live smoke command using `VITE_API_BASE_URL` and document authentication, CORS, backend availability, and unsupported capabilities; verify default CI tests remain offline-safe.
- [ ] 8.4 Run frontend typecheck, lint, build, unit, browser, and screenshot checks plus affected backend tests; update the frontend README with the final screen map and backend contract map, then verify all required commands pass before release.