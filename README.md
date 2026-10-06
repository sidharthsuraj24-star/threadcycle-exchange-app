# Second Loop

A responsive clothing-exchange marketplace demo built with **HTML, CSS, browser JavaScript, Node.js, Express, and MongoDB**. It supports member registration/login, persistent clothing listings and images, one-for-one swap requests, negotiation chat, city/value matching, dashboards, and administrator moderation.

**Demo-data warning:** eight sample listings and corresponding sample profiles are included to make the interface understandable. All are labeled as illustrative, have no credentials, are not real member offers, cannot receive swap requests, and are excluded from KPI/matching activity. No actual users, exchanges, environmental benefits, payment, or delivery are claimed.

## What works

- Email/password registration and login; 12-character minimum; bcrypt hashing; server-side MongoDB sessions; session ID/CSRF rotation; HTTP-only, SameSite Strict cookies and Secure cookies on production/Vercel HTTPS deployments.
- CSRF token and same-origin checks on state-changing requests, authentication/upload rate limits, bounded input, fixed enums, parameterized Mongo queries, HTML-escaped client rendering, administrator role gates.
- Listing create/edit/remove with JPEG/PNG/WebP only, MIME signature verification, up to four photos at **1 MB each**. Member image bytes are stored in MongoDB, never in the application’s ephemeral local filesystem.
- Direct swap request state changes with actor/time history, private persistent chat, numbered negotiated-terms revisions confirmed by both participants, and a separate two-member completion confirmation.
- Same-city opportunities are ranked first; different-city alternatives are labeled. Matching uses member-entered city text and a clearly explained value gap, not GPS, radius, or geographic distance.
- After mutual terms confirmation, the two participants may enter private manual hand-off/shipment notes (service label, reference, preference, and self-reported status). No public tracking page, courier API, booking, label/rate, payment, or carrier-verified delivery exists; provider integration remains **Partial**.
- First-party rolling 30-day active/engaged-member and swap-request acceptance analytics use documented counts and denominators. Event documents store member ID/action/timestamp only, use no third-party tracker, and expire after 35 days.
- Administrator counts are record-based and demo entries are excluded. Completion requires both members' in-app confirmations and is not proof of a physical exchange or delivery. Admin overview omits participant-only shipment fields.

## Run locally

Use **Node.js 20 or newer**. MongoDB is required for a normal application run; the server deliberately does not silently fall back to local files or an in-memory/file database.

1. Create a MongoDB database (a local MongoDB server or a MongoDB deployment).
2. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI`: connection URI to the database.
   - `SESSION_SECRET`: at least 32 random bytes. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; place it in `.env` or the host’s secret environment configuration. **Do not commit it or share it in source code.**
3. Set `NODE_ENV=development`, `SEED_DEMOS=true`, and optionally `PORT=3000`.
4. Run `npm ci`, then `npm start`. Open `http://localhost:3000`.

`npm run dev` runs the server with Node’s file watcher. Local startup and the Vercel handler use the same cached MongoDB initializer; declared indexes are created before data routes proceed. Vercel instances reuse a Mongoose connection when warm, but all durable application records, photos, and sessions remain in MongoDB.

## Tests

`npm test` launches an ephemeral MongoDB test server and drives the Express API with HTTP integration tests. The ephemeral database is **test-only** and is never used as a production persistence fallback. The tests cover registration/login/password hashing, CSRF and origin checks, listing create/edit/remove and photo validation/storage, same-/different-city matching, participant-only messaging and shipment-note authorization, terms revision and completion gates, actor/time transition history, controlled 30-day analytics calculations, and administrator moderation.

The app package intentionally has no hard-coded demo logins or admin password. There is no user self-service admin bootstrap endpoint.

## Vercel preparation and deployment handoff

Vercel is the intended host **only for the authorized noncommercial student demo**. Preparation is complete in source; **no Vercel project or deployment has been created, there is no live URL, and no environment secret was requested or entered**. Deployment remains on hold until the owner chooses the courier provider, as required. The app currently offers participant-entered shipment notes only; it has no courier integration. See [`DEPLOYMENT-HANDOFF.md`](DEPLOYMENT-HANDOFF.md) for the exact future handoff and release gates.

Vercel detects the root [`index.js`](index.js) as the Express app entrypoint and runs it as a Function; no long-running `npm start` server is used in the deployment. Vercel serves files in `public/` from its CDN, so the Express `express.static()` middleware and local HTML fallback are kept for local development but skipped on Vercel. [`vercel.json`](vercel.json) applies the page security headers to the CDN-served HTML; API and Express responses continue to use Helmet.

Vercel Functions cap each request and response body at **4.5 MB**. The app accepts up to four JPEG/PNG/WebP photos at 1 MB each (4 MB file bytes total, plus bounded multipart fields), while JSON remains capped at 64 KB and URL-encoded bodies at 16 KB. Photo bytes, server-side sessions, and short-lived request/auth rate-limit counters stay in MongoDB; counters are shared across Function instances and store only HMAC-keyed client identifiers, not raw IPs. There is no production disk or in-memory persistence fallback.

For the handoff after the courier gate is resolved, use the **same private** repository `sidharthsuraj24-star/threadcycle-exchange-app` and the `vercel-preparation` branch. In Vercel project settings, leave the root directory at `.`, keep Express autodetection, use `npm ci` for installation, `npm run check` as the build command, leave the output directory and start command unset, and add the deployment environment variables listed in the handoff. Do not upgrade or enable paid resources under this demo authorization.

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
- `DEPLOYMENT-HANDOFF.md` — exact Vercel preparation status, future setup steps, and release gates.
- `render.yaml` remains a legacy, unselected configuration; it is not the intended deployment target for this preparation.
- `.env.example` — variable names and non-secret placeholders.
