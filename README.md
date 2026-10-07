# Second Loop

A responsive clothing-exchange marketplace demo built with HTML, CSS, browser JavaScript, Node.js, Express, and MongoDB. Members can register, list clothing, request direct swaps, negotiate in private, browse city/value matches, use a separate sustainable-fashion community, and access dashboards and admin moderation.

**Demo-data warning:** The twelve sample listings and profiles are synthetic, clearly labeled, have no credentials, cannot receive swap requests, and do not count toward member matching or KPI activity. The app does not claim actual users, exchanges, environmental benefits, payments, or deliveries. Demo-courier rates and tracking are synthetic; they do not mean a parcel exists or moved.

## What works

Authentication uses bcrypt, MongoDB-backed sessions, CSRF/same-origin checks, role gates, request limits, bounded input, fixed enums, parameterized Mongo queries, and escaped user content. HTTP-only, SameSite Strict cookies are Secure on production/Vercel HTTPS deployments.

Members can create, edit, and remove persistent listings with up to four JPEG/PNG/WebP photos, each capped at 1 MB. Uploads are signature-checked, re-encoded as WebP to remove EXIF/source metadata, and stored in MongoDB. Swap requests include actor/time status history, private chat, revisioned negotiated terms confirmed by both participants, and separate two-member completion confirmations.

Matching ranks exact city-text matches first and labels other-city alternatives; it normalizes whitespace and Unicode and ignores case, but does not resolve aliases or use GPS, radius, coordinates, or geographic distance. A separate public, text-only sustainable-fashion Community feed supports posts, comments, likes, reports, author removal, and role-gated admin moderation.

After both participants confirm the current terms, they retain the existing **private manual hand-off notes** and can optionally use **Arrange Delivery**. The demo shows deterministic synthetic INR rates, lets a participant select a mock courier, and creates one private `DemoShipment` per swap with locality/package inputs, a generated `DEMO-SL-…` tracking number, and **“Shipped · simulated”** status. Both participants can see those private details; admin sees only demo/tracking ID, swap ID, provider, mode, status, and creation time. Later tracking stages are explicitly illustrative.

The courier flow uses a local mock only: it makes no external courier/API call, creates no booking or label, moves no parcel, and takes no payment. `COURIER_MODE` defaults to `demo`, `LIVE_SHIPMENTS` defaults to `false`, and no live provider is configured. The Shiprocket estimate link in the separate manual notes is an external calculator; its PIN/package inputs are entered there, not sent from this app.

First-party rolling 30-day analytics use documented member/action counts and denominators, store member ID/action/timestamp only, use no third-party tracker, and expire after 35 days. Admin counts exclude demo seed data; the admin panel also shows minimal simulated-shipment activity. A completion is still only a two-member in-app confirmation, not proof of physical exchange or delivery.

## Run locally

Use Node.js 20.9 or newer (the repository pins Node.js 22). MongoDB is required for a normal application run; the server does not fall back to local files or an in-memory/file database.

1. Create a MongoDB database (a local MongoDB server or a MongoDB deployment).
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and `SESSION_SECRET`. The session secret must be at least 32 random bytes; generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Keep secrets in `.env` or the host’s protected environment configuration; never commit them.
3. Keep `COURIER_MODE=demo` and `LIVE_SHIPMENTS=false`; no courier credentials are needed. Set `NODE_ENV=development`, `SEED_DEMOS=true`, and optionally `PORT=3000`.
4. Run `npm ci`, then `npm start`; open `http://localhost:3000`. `npm run dev` starts the server with Node’s file watcher.

Local startup and the Vercel handler use the same cached MongoDB initializer. Declared indexes are created before data routes proceed. Vercel instances reuse a Mongoose connection when warm, while application records, photos, and sessions remain in MongoDB.

## Tests

`npm test` launches a single-node MongoDB replica set and drives the Express API with HTTP integration tests; this test-only database is never a production persistence fallback. The 18-test suite covers authentication/security, listing and photo validation, swaps and agreements, community moderation, manual shipment notes, courier acceptance/agreement gates, locality/weight validation, participant privacy and outsider denials, idempotent demo creation, admin-minimal views, disabled live booking, deterministic rates/tracking, and responsive courier markup. Automated markup/CSS checks are not a full visual browser/viewport review; local tests also do not establish Vercel behavior, production database durability, performance, or physical exchange outcomes.

The app has no hard-coded demo logins or admin password and no user self-service admin bootstrap endpoint.

## Production deployment

The noncommercial student demo is live at the [production site](https://threadcycle-exchange-app.vercel.app/) from the existing `vercel-preparation` branch. This owner-approved demo-courier release was based on deployed commit `5a800b0` and published only to `vercel-preparation`; `main` and Vercel settings remain unchanged. The courier flow is simulated only and does not contact a real provider or process a payment.

Vercel uses the root `index.js` as the Express Function entry point and serves `public/` from its CDN. Express skips local static serving on Vercel but serves `public/index.html` for client-side routes; `/api` endpoints are not rewritten. `vercel.json` sets security headers for CDN-served HTML, and Express responses retain Helmet.

Vercel Functions cap each request and response body at 4.5 MB. Four source photos at 1 MB each are re-encoded to metadata-free WebP before MongoDB storage; JSON remains capped at 64 KB and URL-encoded bodies at 16 KB. There is no production disk or in-memory persistence fallback. For each release, run `npm run check` and `npm test`, keep `main` unchanged and the project private, do not enable paid resources, and do not add a real courier provider without separate authorization. See [`DEPLOYMENT-HANDOFF.md`](DEPLOYMENT-HANDOFF.md).

## Promote the first administrator securely

1. The authorized owner first registers a normal member account in the live app.
2. From a trusted command-line shell, set the same `MONGODB_URI` as the deployed service as a protected shell environment variable. Do not put its database password in terminal history or commit a `.env` file.
3. Run `npm run admin:promote -- member@example.com`. The script checks for a real registered account, prompts for that exact email, then grants the admin role. It creates no account and prints no secret.
4. Sign in as that existing member and open the Admin link. To remove access, change that user’s role back to `member` with an authorized database operation.

## Project files

- `index.js` and `vercel.json` — Vercel Express entry point and CDN security headers.
- `public/` and `server/` — responsive frontend; Express APIs, MongoDB models, cached connection, local courier mock/service, seeding, and estimate calculator.
- `scripts/promote-admin.js` and `tests/marketplace.test.js` — secure owner-run admin provisioning and integration/frontend-markup tests.
- `docs/PRD.md`, `docs/REQUIREMENT-AUDIT.md`, `docs/TEST-PLAN.md`, and `docs/TEST-EVIDENCE.md` — product scope, requirement status, and local verification.
- `docs/COURIER-DEMO-DECISION.md` and `DEPLOYMENT-HANDOFF.md` — mock-provider decision and deployment constraints/publication gate.
- `.env.example` — variable names with non-secret placeholders. `render.yaml` is a legacy, unselected configuration.
