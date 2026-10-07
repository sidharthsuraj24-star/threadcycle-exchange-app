# Second Loop

A responsive clothing-exchange marketplace demo built with **HTML, CSS, browser JavaScript, Node.js, Express, and MongoDB**. It supports member registration/login, persistent clothing listings and images, one-for-one swap requests, negotiation chat, city/value matching, a separate sustainable-fashion community feed, dashboards, and administrator moderation.

**Demo-data warning:** eight sample listings and corresponding sample profiles are included to make the interface understandable. All are labeled as illustrative, have no credentials, are not real member offers, cannot receive swap requests, and are excluded from KPI/matching activity. No actual users, exchanges, environmental benefits, payment, or delivery are claimed.

## What works

- Email/password registration and login; 12-character minimum; bcrypt hashing; server-side MongoDB sessions; session ID/CSRF rotation; HTTP-only, SameSite Strict cookies and Secure cookies on production/Vercel HTTPS deployments.
- CSRF token and same-origin checks on state-changing requests, authentication/upload rate limits, bounded input, fixed enums, parameterized Mongo queries, HTML-escaped client rendering, administrator role gates.
- Listing create/edit/remove with JPEG/PNG/WebP input, MIME signature verification, and up to four photos at **1 MB each**. Uploads are re-encoded as WebP with EXIF and other source metadata removed, then stored in MongoDB—not in the application’s ephemeral local filesystem.
- Direct swap request state changes with actor/time history, private persistent chat, numbered negotiated-terms revisions confirmed by both participants, and a separate two-member completion confirmation.
- Same-city opportunities are ranked first; different-city alternatives are labeled. Profile city input is Unicode-normalized and whitespace-collapsed; matching ignores case and repeated spaces, but does not resolve city aliases or use GPS, radius, coordinates, or geographic distance.
- The public **Community** feed supports sustainable-fashion topics, member posts, comments, likes, reports, soft-deletion by the post author, and role-gated admin hide/restore controls. Community discussions are separate from private swap threads. Posts are text-only; they are member-written, unverified content.
- After mutual terms confirmation, the two participants may enter private manual hand-off/shipment notes (service label, reference, preference, and self-reported status). No public tracking page, courier API, booking, label/rate, payment, or carrier-verified delivery exists; provider integration remains **Partial**.
- First-party rolling 30-day active/engaged-member and swap-request acceptance analytics use documented counts and denominators. Event documents store member ID/action/timestamp only, use no third-party tracker, and expire after 35 days.
- Administrator counts are record-based and demo entries are excluded. Completion requires both members' in-app confirmations and is not proof of a physical exchange or delivery. Admin overview omits participant-only shipment fields.

## Run locally

Use **Node.js 20.9 or newer** (the repository pins Node.js 22). MongoDB is required for a normal application run; the server deliberately does not silently fall back to local files or an in-memory/file database.

1. Create a MongoDB database (a local MongoDB server or a MongoDB deployment).
2. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI`: connection URI to the database.
   - `SESSION_SECRET`: at least 32 random bytes. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; place it in `.env` or the host’s secret environment configuration. **Do not commit it or share it in source code.**
3. Set `NODE_ENV=development`, `SEED_DEMOS=true`, and optionally `PORT=3000`.
4. Run `npm ci`, then `npm start`. Open `http://localhost:3000`.

`npm run dev` runs the server with Node’s file watcher. Local startup and the Vercel handler use the same cached MongoDB initializer; declared indexes are created before data routes proceed. Vercel instances reuse a Mongoose connection when warm, but all durable application records, photos, and sessions remain in MongoDB.

## Tests

`npm test` launches a single-node MongoDB replica set and drives the Express API with HTTP integration tests. This **test-only** database is never used as a production persistence fallback. The tests cover direct page refreshes, registration/login/password hashing, CSRF and origin checks (including missing tokens), photo validation and EXIF removal, simultaneous attempts to accept overlapping swaps, normalized same-/different-city matching, community posting/commenting/likes/reporting and admin moderation, private messaging and shipment-note authorization, terms and completion gates, analytics, and administrator moderation.

The app package intentionally has no hard-coded demo logins or admin password. There is no user self-service admin bootstrap endpoint.

## Production deployment

The noncommercial student demo is live at the [production site](https://threadcycle-exchange-app.vercel.app/). It runs from the private GitHub repository `sidharthsuraj24-star/threadcycle-exchange-app`, branch `vercel-preparation`; keep `main` unchanged and the project private. Do not enable paid resources. Participant-entered shipment notes remain manual; the app has no courier integration, payment, booking, or carrier-verified delivery.

Vercel detects the root [`index.js`](index.js) as the Express Function entry point. Vercel serves files in `public/` from its CDN; Express's local static-file middleware is skipped on Vercel, but its GET fallback serves `public/index.html` for client-side routes and does not rewrite `/api` endpoints. This lets links such as `/login`, `/dashboard`, and `/messages/<id>` load directly or refresh. [`vercel.json`](vercel.json) provides security headers for CDN-served HTML, while Express responses retain Helmet.

Vercel Functions cap each request and response body at **4.5 MB**. The app accepts up to four source photos at 1 MB each and converts valid JPEG/PNG/WebP uploads to metadata-free WebP before storage. JSON remains capped at 64 KB and URL-encoded bodies at 16 KB. Listings, photos, sessions, and short-lived rate-limit counters stay in MongoDB; counters use HMAC-keyed client identifiers rather than raw IPs. There is no production disk or in-memory persistence fallback.

Run `npm run check` and `npm test` before publishing branch changes. See [`DEPLOYMENT-HANDOFF.md`](DEPLOYMENT-HANDOFF.md) for current deployment constraints and verification notes; keep updates within the existing noncommercial demo and do not add paid resources or a courier provider without separate authorization.

The city-normalization and Community update builds on production commit `6e0e0988`; publication uses the existing `vercel-preparation` branch and leaves `main` unchanged. Confirm each release against the Vercel deployment SHA and public HTTP checks.

## Promote the first administrator securely

1. The authorized owner first registers a normal member account in the live app.
2. From a trusted command-line shell, set the **same** `MONGODB_URI` as the deployed service as a protected shell environment variable. Do not put its database password in terminal history or commit a `.env` file.
3. Run `npm run admin:promote -- member@example.com`. The script checks for a real registered account, prompts for that exact email, and only then grants the admin role. It creates no account and prints no secret.
4. Sign in as that existing member and open the Admin link. To remove access, update that user’s role back to `member` with an authorized database operation.

## Project files

- `index.js` — Vercel-recognized Express Function entrypoint.
- `vercel.json` — Vercel schema reference and security headers for CDN-served HTML.
- `public/` — responsive frontend and clearly marked demo photos, served by Vercel's CDN or Express locally.
- `server/` — Express endpoints, MongoDB models and cached connection initialization, demo seeding, estimate calculator.
- `scripts/promote-admin.js` — secure owner-run admin provisioning.
- `tests/marketplace.test.js` — integration tests.
- `docs/PRD.md` — product requirements, scope, and acceptance criteria.
- `docs/REQUIREMENT-AUDIT.md` — current scorecard against both original briefs, including partial provider and deployment items.
- `docs/TEST-PLAN.md` and `docs/TEST-EVIDENCE.md` — covered behaviors, local results, remaining verification, and deployment checklist.
- `DEPLOYMENT-HANDOFF.md` — current Vercel deployment behavior, constraints, and verification notes.
- `render.yaml` remains a legacy, unselected configuration; it is not the intended deployment target for this preparation.
- `.env.example` — variable names and non-secret placeholders.
