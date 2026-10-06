# Final local test evidence

Executed in `/workspace/clothing-swap-marketplace` on **2026-10-06**, after all application and test-source changes and after drafting the audit and test-plan updates. These are local code checks, not deployment checks.

```text
=== npm run check ===
> second-life-clothing-swap@1.0.0 check
> node --check server/app.js && node --check server/models.js && node --check public/app.js && node --check server/index.js

=== npm test ===
> second-life-clothing-swap@1.0.0 test
> node --test --test-concurrency=1

▶ end-to-end marketplace flows use the MongoDB data models and persisted sessions
  ✔ server boots with explicitly labelled sample items, not demo accounts (63.744008ms)
  ✔ registration validates, hashes passwords, rotates session, and limits the public profile (1517.281699ms)
  ✔ same-site state changes reject requests without the session CSRF token (38.886845ms)
  ✔ listing creation validates photo type, estimates value server-side, and stores image bytes in MongoDB (99.851093ms)
  ✔ a real member can filter by coarse city, but demo samples are not match candidates (47.637277ms)
  ✔ a request starts a private thread; only its two participants can read and write (912.378375ms)
  ✔ only an already-registered member promoted from trusted server access gets admin controls (629.810889ms)
  ✔ public health check does not expose database credentials (6.068943ms)
✔ end-to-end marketplace flows use the MongoDB data models and persisted sessions (4412.524448ms)
✔ dashboard escapes a member-controlled name before rendering HTML (5.682877ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5090.766358
```

`npm run check` exited successfully before the test command ran. `npm test` exited successfully with **10/10 passing, zero failed or skipped**. The integration suite used `mongodb-memory-server` and an ephemeral database; it does not validate an external production MongoDB instance. `git diff --check` also exited successfully on the changes.
