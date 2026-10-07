# Test plan and latest result

## Automated coverage

`npm test` runs the Express API against a disposable single-node MongoDB replica set through Supertest agents and persisted test sessions. The current suite covers:

- **Entrypoint and security:** labeled illustrative seed listings, root Express export, direct-load page routes (including `/community`), safe HTML/CSP configuration and health endpoint, registration/login, password hashing, session rotation, CSRF/origin checks, profile updates, and HTML-escaped member content.
- **Listings, values, and matching:** create/edit/remove, server-calculated value from category × condition × brand tier, separation of optional unverified comparable retail price, photo validation and EXIF removal, same-city-first ordering, different-city alternatives, whitespace/case-insensitive city matching, and exclusion of demo offers.
- **Community:** public/category-filtered feed, login requirement for posting/interactions, comments, toggleable likes, duplicate open-report rejection, self-report prevention, admin-only report review, hide/restore behavior, and HTML escaping of member-authored post/comment content.
- **Swap lifecycle and privacy:** participant-only messages, actor/time history, negotiated-term revisions and bilateral confirmation before completion, participant-only shipment notes, admin omission of shipment references, and concurrent overlapping-request protection.
- **Persistence and analytics:** MongoDB-backed rate limits using HMAC-keyed identifiers, rolling 30-day active/engaged and acceptance-rate definitions, zero-denominator behavior, admin gates/actions, and demo-data exclusion.

Courier-provider integration is intentionally deferred; the manual participant-only hand-off notes remain separate and unchanged.

## Latest local verification

Run from `/workspace/threadcycle-production-review`, branch `cue-city-community-work`, based on production commit `6e0e0988`; latest requested rerun: **2026-10-07**.

- `npm ci` — completed; installed the locked dependency set; npm reported zero vulnerabilities.
- `npm run check` — **passed**; syntax checks include the new `server/city.js` helper.
- `npm test` — **passed: 15 tests, 15 passed, 0 failed, 0 skipped**; the suite used and stopped an ephemeral MongoDB replica set.
- `git diff --check` — recorded in `docs/TEST-EVIDENCE.md` after the final source/documentation edits.

These validate local source behavior only. The release workflow separately verifies Vercel and public HTTP against the exact release SHA; those checks do not prove database durability, backup/restore, or physical exchange outcomes.

## Remaining limitations and manual review

- City matching deliberately stays city-level. Input whitespace and Unicode compatibility are normalized and comparisons ignore case/spacing; aliases, distance, radius, coordinates, GPS, and street addresses are not used.
- The community feature is text-only and has no nested groups, follows, community-image upload, or per-comment report action. Member content is not verified.
- Estimate values remain transparent deterministic guides based on category, condition, and brand tier, rounded to ₹50. Comparable retail price is separate, member-entered, unverified, and does not affect estimates or matches.
- Manual browser/viewport testing, performance/load testing, production MongoDB behavior, backup/restore, and real courier behavior were not run. Courier integration is deferred by product choice.
- Publication uses the existing `vercel-preparation` branch, leaves `main` unchanged, and does not change Vercel settings. Confirm the current deployed SHA and public HTTP behavior for every release.

For visual and keyboard acceptance beyond the HTTP smoke check, manually review at desktop and narrow/mobile widths: navigation/direct route loads; public community reading; sign-in, post, comment, like, report, and author removal; admin dismiss/hide/restore actions; keyboard focus and small-screen layout; city input cleanup and same-city labels; and the comparable retail-price disclaimer remaining separate from swap estimates.
