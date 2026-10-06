# Test plan and latest result

## Automated coverage

`npm test` runs the Express API against disposable MongoDB from `mongodb-memory-server`, using Supertest agents and persisted test sessions. The suite covers:

- Eight labeled illustrative seed listings/profiles, no demo password hashes, safe HTML/CSP, and a credential-free health endpoint.
- Registration/login, password validation/hashing, session rotation, duplicate/failed login, CSRF/same-origin rejection, profile update, and member-name escaping.
- Listing create/edit/remove, computed values rather than forged client values, JPEG/PNG/WebP signature validation, MongoDB image bytes, and SVG rejection.
- A real same-city listing and a real different-city alternative, same-city-first ordering, explicit city-level/non-geospatial disclosure, broad city filtering, and exclusion of demo items from matches/requests.
- Swap creation, initial actor/time history, participant-only private messages, outsider 404s, recipient-only acceptance, item reservation, and rejection of completion before bilateral terms agreement.
- Separate terms agreement after chat: proposal/revision persistence, both member confirmations, revision-reset behavior, server-side authorization and state checks, and final two-member completion confirmations as a separate actor/timestamped action.
- Provider-neutral manual shipment fields and self-reported status; shipment eligibility only after both members confirm terms; member-only access; status actor/time; admin exclusion of tracking reference. No courier endpoint or external provider is exercised because none is integrated.
- Actor-and-time history for request, acceptance, completion, withdrawal, decline, dispute, admin closure, and automatic decline of competing requests.
- Controlled rolling-window analytics fixtures: active and engaged distinct-member counts, engagement-rate numerator/denominator, request-acceptance numerator/denominator, zero-denominator behavior in the implementation, and exclusion of a 31-day-old request/event from a 30-day measure.
- Admin role enforcement, suspend/restore, hide/restore, dispute closure without admin attestation, and demo-data exclusion.

## Latest local verification

Verified in `/workspace/clothing-swap-marketplace` on **2026-10-06** after the latest source and test changes:

- `npm run check` — **passed**; Node.js syntax checks passed for `server/app.js`, `server/models.js`, `public/app.js`, and `server/index.js`.
- `npm test` — **passed: 11 tests, 11 passed, 0 failed, 0 skipped**; final run completed in **5.412 seconds**. The integration suite used and stopped an ephemeral MongoDB instance.
- `git diff --check` — **passed**; no whitespace errors were reported.

Exact command output is recorded in [`TEST-EVIDENCE.md`](TEST-EVIDENCE.md). These checks validate source behavior only; they do not establish a production database, deployed service, actual courier behavior, physical exchange, or environmental impact.

## Remaining verification and acceptance gaps

- Real courier integration (provider selection, authorized API, booking/rates/labels and carrier status) is **Partial**. The implemented carrier label, reference, preference, and status are manual participant notes only.
- Matching intentionally uses city-name equality and value gap, not geographic coordinates or distance; the original “nearby” requirement is therefore **Partial**.
- Earlier persisted swap records may have missing transition history. Their original actor and transition timestamp cannot be safely reconstructed; no values are invented.
- Admin lists are limited to the newest 30 entries without search/pagination; performance, load, restore/backup, durable production DB, and production security review remain untested.
- Manual browser/viewport testing, real email/auth providers, live courier provider tests, production MongoDB tests, and public deployment/health checks were not run. Completion remains member-reported, not verified delivery or physical exchange.

## Manual verification after separately authorized deployment

These checks were **not run**; deployment/release was explicitly prohibited for this audit:

1. Open the authorized HTTPS hostname at desktop and narrow/mobile widths; review the seven connected screen groups, navigation, illustrative-data labels, and hidden demo request actions.
2. With two authorized member accounts, create listings, start a request, exchange messages, propose terms, verify each member confirms the same revision, and confirm that changing terms resets both confirmations.
3. Verify an outsider cannot read or write the conversation, terms, status history, or manually entered shipment notes; verify admin screens omit shipment references.
4. Verify the completion button is unavailable to the API until both members confirm current terms, and that each later completion confirmation remains a separate action.
5. Verify same-city offers appear before different-city alternatives, and that the UI never describes city-level matching as measured distance.
6. Review 30-day analytics in the admin panel against controlled records and the documented exact denominators; check that activity events expire under the configured TTL index.
7. Verify `/api/health` reports a connected persistent MongoDB and inspect production session-cookie/proxy settings.
8. Do not claim courier booking, provider tracking, physical exchange, or delivery verification unless those capabilities are separately authorized, implemented, and tested.

## Deployment status

No deployment was performed or verified. There is no verified live URL. The source requires a configured persistent MongoDB URI and protected session secret, and the original briefs require a live deployed link. Real provider-based courier integration also remains Partial. No release should be represented as passing all original criteria until the authorized provider/deployment gaps are resolved and verified.
