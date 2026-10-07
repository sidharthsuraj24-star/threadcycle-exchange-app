# Local verification evidence

The city-normalization and community changes were implemented in `/workspace/threadcycle-production-review`, branch `cue-city-community-work`, based on production commit `6e0e0988`, on **2026-10-06**. Final checks were rerun on **2026-10-07**. These commands document local automated verification; release/deployment checks are separate.

```text
=== npm ci ===
PASS — installed 172 locked packages; npm reported 0 vulnerabilities.

=== npm run check ===
PASS — Node syntax checks for index.js, server/app.js, server/city.js,
server/database.js, server/rate-limit-store.js, server/models.js,
public/app.js, server/index.js, and tests/marketplace.test.js.

=== npm test ===
ℹ tests 15
ℹ pass 15
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 9475.790592
The suite used a disposable single-node MongoDB replica set and stopped it.

=== git diff --check ===
PASS — no whitespace errors.
```

The integration coverage includes normalized city input and case/spacing-insensitive match and browse filters; separation of the existing comparable retail-price reference from server-calculated swap estimates; public/category-filtered community browsing; authenticated posting, comments, toggleable likes, and reports; duplicate open-report rejection; self-report prevention; author-only soft deletion; admin report review and hide/restore behavior; and HTML escaping of community content. Existing production security, photo privacy, swap, analytics, and rate-limit tests also pass.

The tests demonstrate local code behavior only. They do not verify Vercel build/deployment, production database durability/backups, browser/viewport experience, load, courier-provider behavior, real exchanges, or environmental impact. Public HTTP and Vercel release checks are separate from this local test evidence; courier integration remains deferred by product choice.
