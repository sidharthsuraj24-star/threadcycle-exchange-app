# Local verification evidence

The demo-courier changes were implemented in `/workspace/threadcycle-production-review`, branch `demo-courier-sandbox`, based on verified production commit `5a800b0`. Final source and test checks were run on **2026-10-07** before the owner-approved publication; deployment and public HTTP checks are separate.

```text
=== npm run check ===
PASS — configured Node syntax checks for index.js, server/app.js, server/city.js,
server/database.js, server/rate-limit-store.js, server/models.js, public/app.js,
server/index.js, and tests/marketplace.test.js.

=== node --check server/courier/service.js ===
=== node --check server/courier/mock-provider.js ===
PASS — both new courier modules parse successfully.

=== npm test ===
ℹ tests 18
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8454.032811
PASS — disposable single-node MongoDB replica set stopped after the test run.

=== git diff --check ===
PASS — no whitespace errors.
```

The suite covers existing marketplace security, listing/photo handling, swaps, agreements, community, analytics, and admin behavior, plus demo-courier gates and validation, participant ownership/privacy, idempotent swap-linked tracking, deterministic mock rates and tracking reference, admin-minimal metadata, disabled live booking, locality-only form fields, the simulated shipped status, and responsive CSS rules. The added courier flow makes no external API calls and uses no credentials.

These command results validate local code behavior only; the npm checks did not themselves exercise Vercel deployment or public HTTP. No manual browser/viewport review, production database durability/backup, load test, or carrier behavior was tested. A separate publication check supplements these results. No physical shipment was created.
