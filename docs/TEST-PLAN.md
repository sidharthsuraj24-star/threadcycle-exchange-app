# Test plan and latest result

## Automated coverage

`npm test` runs the Express API against a disposable MongoDB instance from `mongodb-memory-server`, using Supertest agents and real session cookies. The current suite covers:

- Eight clearly labeled illustrative seed listings/profiles, no demo password hashes, and non-interactive demo offers.
- Registration/login, password-length validation, bcrypt hashing, session rotation, public profile limits, duplicate email rejection, and failed login.
- CSRF and same-origin rejection, profile update persistence, and safe handling of markup in profile data.
- Listing create/edit/remove, photo MIME/signature checks, image bytes persisted in MongoDB, server-computed estimates despite a forged client estimate, and SVG rejection.
- Coarse city filtering/matching and proof that demo offers cannot be requested or returned as real match candidates.
- Swap creation, remote preference persistence (not courier integration), participant-only messaging, recipient accept, both listings reserved on acceptance, member confirmation, and completion only after the second confirmation.
- Request withdrawal, recipient decline, dispute reporting, admin authorization, member suspend/restore, listing hide/restore, dispute closure without an admin attesting to a real exchange, and record-based KPI output.
- Safe HTML output when a member-controlled name is rendered in the dashboard greeting; the test executes the frontend's actual dashboard template.
- The static HTML/CSP and the credential-free health endpoint.

## Latest local verification

Verified on **2026-10-06** in the project workspace:

- `npm run check` — **passed**; Node.js syntax checks passed for `server/app.js`, `server/models.js`, `public/app.js`, and `server/index.js`.
- `npm test` — **passed: 10 tests, 10 passed, 0 failed, 0 skipped**; the final recorded run took **5.091 seconds**. The suite used an ephemeral MongoDB test instance and stopped it after the run.
- `git diff --check` — **passed** for the reviewed changes.

The integration database is test-only. Passing these checks does not establish a durable production database or a deployed service. See [`TEST-EVIDENCE.md`](TEST-EVIDENCE.md) for the captured command output.

## Known gaps not covered by these tests

- No courier provider/API, booking, waybill, shipment status, or delivery tracking exists; tests only prove that `remote` is stored as a preference and reject an unsupported `courier-booked` enum.
- There is no distinct two-member confirmation record for negotiated terms after chat; acceptance accepts the proposed pair, while the two-member confirmation is a completion assertion.
- The admin screens show only the newest 30 users, listings, and swaps; the tests do not exercise pagination because none is implemented.
- Active-user, engagement, and request-conversion analytics are not implemented. There is no activity-event instrumentation or defined active-user window.
- There is no load/performance benchmark, automated browser/mobile viewport suite, live-provider integration test, production-database test, or deployment test.
- A member-confirmed completion is only an in-app assertion; it does not verify physical delivery or exchange.

## Manual verification after an authorized deployment

These checks are **not run** in this audit because deployment and release were explicitly prohibited:

1. Open the assigned HTTPS hostname at desktop and narrow/mobile widths; check the seven connected screen groups, menu, demo labels, and disabled sample-offer actions.
2. Register two authorized test members; verify sessions survive refresh and profile city/name updates persist.
3. Create and edit listings with JPEG/PNG/WebP photos; verify invalid, oversized, and excess images are rejected and valid images survive an app restart.
4. Check text/category/size/city filters, listing details, and member-only city/value suggestions.
5. Send, withdraw, accept, and decline requests; verify accepted items become reserved and disputed closure restores reserved items.
6. Verify both participants can negotiate and a third account cannot read or write the thread; confirm the completion counter changes only after both member confirmations.
7. Promote an authorized existing account through the trusted CLI process; verify admin-only member/listing/swap/dispute screens and controls.
8. Verify `/api/health` reports a connected persistent MongoDB through the public hostname, and inspect production HTTPS/session cookie flags.
9. Do not claim courier booking or tracking during deployment verification; no courier integration is present in this source.

## Deployment status

No deployment was performed or verified. No live URL is claimed. The project requires a configured persistent MongoDB URI and protected session secret, and a host/account authorization step; source configuration alone is not deployment evidence.
