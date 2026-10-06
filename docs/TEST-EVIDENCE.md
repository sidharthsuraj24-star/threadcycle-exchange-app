# Final local test evidence

Executed in `/workspace/clothing-swap-marketplace` on **2026-10-06**, after all application/test-source changes and after updating the PRD, requirement audit, and test plan. These are local source checks, not deployment checks.

```text
=== npm run check ===
> npm run check
> node --check server/app.js && node --check server/models.js && node --check public/app.js && node --check server/index.js

=== npm test ===
> npm test
> node --test --test-concurrency=1

▶ end-to-end marketplace flows use the MongoDB data models and persisted sessions
  ✔ server boots with explicitly labelled sample items, not demo accounts (67.585942ms)
  ✔ registration validates, hashes passwords, rotates session, and limits the public profile (1516.580745ms)
  ✔ same-site state changes reject requests without the session CSRF token (31.456851ms)
  ✔ listing creation validates photo type, estimates value server-side, and stores image bytes in MongoDB (91.65855ms)
  ✔ analytics report an unavailable request-conversion rate when there are no requests (28.395484ms)
  ✔ a real member can filter by coarse city, but demo samples are not match candidates (806.733018ms)
  ✔ a request starts a private thread; only its two participants can read and write (753.593383ms)
  ✔ only an already-registered member promoted from trusted server access gets admin controls (662.57257ms)
  ✔ public health check does not expose database credentials (4.253449ms)
✔ end-to-end marketplace flows use the MongoDB data models and persisted sessions (4868.847846ms)
✔ dashboard escapes a member-controlled name before rendering HTML (4.207964ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5412.43876

=== git diff --check ===
(exit 0; no output)
```

`npm run check`, `npm test`, and `git diff --check` all exited successfully. The API integration suite used `mongodb-memory-server` and an ephemeral test database. It does not validate a durable production database, public deployment, external courier, physical exchange/delivery, or environmental impact. No deployment or paid resources were used.
