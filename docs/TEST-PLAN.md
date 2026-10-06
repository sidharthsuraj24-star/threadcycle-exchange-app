# Test plan and current result

## Automated integration coverage

`npm test` starts a temporary MongoDB test instance, invokes the Express API via Supertest agents with real session cookies, and checks:

- labeled, non-interactive demo seed data and no demo password hashes;
- password-length validation, register/login, bcrypt hashing, safe `/api/me` output, duplicate email handling, and failed-login behavior;
- required CSRF and same-origin checks, plus escaped handling of markup-containing profile text;
- listing create/edit/remove, MIME/signature validation, image bytes stored in MongoDB, photo URL removal after moderation, server-calculated value despite a forged client estimate, and SVG rejection;
- coarse city browsing/matching, and proof that demo offers cannot be requested or used as actual match opportunities;
- two-member request, withdraw/decline/accept transitions, non-binding local/remote preference, private chat visible only to participants, dual member confirmations, and items marked swapped only after the second confirmation;
- ordinary-member denial from admin routes; admin member suspend/restore, listing hide/restore, dispute resolution without fabricated completion, record-based KPI counts; static HTML/CSP and safe health endpoint output.

**Important:** the test database is ephemeral and test-only. Passing tests do not prove that the production Atlas database or a public deployment exists.

## Manual verification after deployment

1. Check the home page, mobile layout, and demo badges; confirm demo offer CTA is disabled.
2. Register two controlled member accounts; confirm registration works and sessions survive refresh.
3. Create listings with valid JPEG/PNG/WebP and confirm a disallowed or oversized file is rejected.
4. Verify category/city/text filters, detail pages, member-only matches, and profile city edits.
5. Submit, withdraw, accept, and decline separate requests; confirm reserved state after acceptance.
6. Send messages from both accounts and verify a third account cannot read the thread.
7. Confirm only the two separate participant confirmations mark a swap completed.
8. Promote an authorized owner with the trusted CLI command; verify admin can suspend/restore members, hide/restore a listing, and close a disputed request.
9. Verify `/api/health` reports MongoDB connected from the public hostname over HTTPS and inspect production cookie flags.

## Current outcome

Verified locally on 2026-10-06:

- `npm run check` — passed JavaScript parse checks.
- `npm test` — passed, **9 tests; 9 passed; 0 failed**, about 5 seconds. The suite exercised the API with MongoDB 7.0.24 running in a disposable in-memory test instance and then shut it down.
- No production Atlas connection was configured or used. The ephemeral test database is test-only and is not evidence of persisted production deployment.
- No app URL was deployed or verified. Visual/manual browser acceptance and all post-deployment checks above remain outstanding.
