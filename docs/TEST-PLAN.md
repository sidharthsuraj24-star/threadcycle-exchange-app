# Test plan and latest result

## Automated coverage

`npm test` runs the Express API against disposable MongoDB from `mongodb-memory-server`, using Supertest agents and persisted test sessions. The suite covers:

- **Entrypoint and security:** eight labeled illustrative seed listings/profiles with no demo password hashes; root Vercel Express export; safe HTML/CSP configuration and credential-free health endpoint; registration/login, password hashing, session rotation, CSRF/same-origin checks, profile updates, and safe member-name rendering.
- **Listings and matching:** create/edit/remove; server-calculated values; JPEG/PNG/WebP signature checks and MongoDB image bytes; SVG and over-1-MB photo rejection; same-city-first ordering, different-city alternatives, bounded city filtering, and exclusion of demos from requests/matches.
- **Swap lifecycle and privacy:** private participant-only messages; actor/time history for requests, responses, withdrawals, disputes, completion and admin closure; negotiated-term proposals/revisions and bilateral confirmation before separately recorded completion; participant-only manual shipment notes and status, with shipment references omitted from admin output. No courier endpoint or provider is integrated.
- **Persistence and analytics:** MongoDB-backed rate limits shared across store instances using HMAC-keyed identifiers (no raw client key stored, TTL expiry); controlled rolling 30-day active/engaged and acceptance-rate numerators/denominators, zero-denominator behavior and old-record exclusion; admin role enforcement, suspend/restore, hide/restore, dispute closure, and demo-data exclusion.

## Latest local verification

Verified in the isolated preparation checkout `/workspace/threadcycle-vercel-prep`, cloned from the private repository's `main` base commit `2522c30`, on **2026-10-06**. No files in the original workspace were used as the edit target.

- `npm run check` — **passed**; Node.js syntax checks cover the root Vercel handler, Express app, database initializer, MongoDB rate-limit store, models, frontend, local server entrypoint, and integration test file.
- `npm test` — **passed: 12 tests, 12 passed, 0 failed, 0 skipped**; final complete run took **6.203 seconds**. The integration suite used and stopped an ephemeral MongoDB instance.
- `vercel.json` — **passed** validation against the official Vercel project configuration schema (Draft 4): [`https://openapi.vercel.sh/vercel.json`](https://openapi.vercel.sh/vercel.json).
- `git diff --check` — **passed**; no whitespace errors were reported.

Exact local output and scope are recorded in [`TEST-EVIDENCE.md`](TEST-EVIDENCE.md). These checks validate source and config behavior only; they do not establish a production database, Vercel project/deployment, live service, actual courier behavior, physical exchange, or environmental impact.

## Remaining verification and acceptance gaps

- Real courier integration (provider selection, authorized API, booking/rates/labels and carrier status) is **Partial**. The implemented carrier label, reference, preference, and status are manual participant notes only. Deployment must wait until the owner chooses a courier provider.
- Matching intentionally uses city-name equality and value gap, not geographic coordinates or distance; the original “nearby” requirement is therefore **Partial**.
- Earlier persisted swap records may have missing transition history. Their original actor and transition timestamp cannot be safely reconstructed; no values are invented.
- Admin lists are limited to the newest 30 entries without search/pagination; performance, load, production database backup/restore and production security review remain untested.
- Manual browser/viewport testing, real email/auth providers, live courier-provider tests, production MongoDB tests, and public deployment/health checks were not run. Completion remains member-reported, not verified delivery or physical exchange.

## Manual verification after separately authorized deployment

These checks were **not run**. Perform only after the owner has chosen the courier provider and separately instructed that a Vercel project/deployment may be created. Keep the project private and the host use limited to the authorized noncommercial student demo.

1. Open the authorized HTTPS hostname at desktop and narrow/mobile widths; review the seven connected screen groups, navigation, illustrative-data labels, and hidden demo request actions.
2. With two authorized member accounts, create listings, start a request, exchange messages, propose terms, verify each member confirms the same revision, and confirm that changing terms resets both confirmations.
3. Verify an outsider cannot read or write the conversation, terms, status history, or manually entered shipment notes; verify admin screens omit shipment references.
4. Verify the completion button is unavailable to the API until both members confirm current terms, and that each later completion confirmation remains a separate action.
5. Verify same-city offers appear before different-city alternatives, and that the UI never describes city-level matching as measured distance.
6. Review 30-day analytics in the admin panel against controlled records and the documented exact denominators; check that activity events expire under the configured TTL index.
7. Verify `/api/health` reports a connected persistent MongoDB and inspect production session-cookie/proxy settings; verify listing uploads at and below the documented limits.
8. Do not claim courier booking, provider tracking, physical exchange, or delivery verification unless those capabilities are separately authorized, implemented, and tested.

## Deployment status

No Vercel project or deployment was created or verified; there is no live URL. This is source preparation only. A protected persistent MongoDB URI and session secret are prerequisites for future hosting, but none was requested or entered. Deployment and live acceptance remain blocked on the owner's courier-provider choice and a subsequent explicit go-ahead.
