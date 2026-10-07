# Vercel deployment handoff

The noncommercial student demo is served at the [production site](https://threadcycle-exchange-app.vercel.app/) from the existing `vercel-preparation` branch. This owner-approved demo-courier release is based on deployed production commit `5a800b0` and was published only to `vercel-preparation`. `main` and Vercel project settings were not changed.

Vercel uses the root `index.js` as the Express Function entry point and serves `public/` assets from its CDN. Express skips local static serving on Vercel but serves `public/index.html` for client-side routes such as `/login`, `/dashboard`, and `/messages/<id>`; `/api` and `/api/*` remain API routes. `vercel.json` supplies security headers for CDN-served HTML, while Express responses retain Helmet.

The app uses MongoDB for listings, photos, swaps, messages, sessions, rate-limit counters, community content, and demo shipments. Database initialization creates declared indexes, including the unique swap index for demo shipments. Production requires MongoDB and a strong `SESSION_SECRET`; there is no production disk or in-memory persistence fallback. Image upload remains capped at four files, 1 MB each, and accepted images are re-encoded before MongoDB storage.

## Product boundaries

The existing manual hand-off notes remain private and unchanged. The new **Arrange Delivery** flow is a local deterministic simulation: synthetic INR rates, a generated demo tracking number, a visible **“Shipped · simulated”** state, and illustrative future tracking stages. It makes no external courier/API call, does not create a real booking or label, does not move a parcel, and processes no payment. Shipment details are participant-private; the admin overview exposes only demo/tracking ID, swap ID, provider, mode, status, and creation time.

`COURIER_MODE` defaults to `demo` and `LIVE_SHIPMENTS` defaults to `false`. No live provider or credentials are configured. Do not add a provider, create a ShipAny account, or contact the provider as part of this task. Any real-provider integration would need separate owner authorization, verified access and eligibility, and independently reviewed credential handling.

## Verification and release

For this implementation, `npm run check`, `npm test`, and `git diff --check` pass. The integration suite uses an ephemeral single-node MongoDB replica set and exercises courier agreement/ownership gates, validation, idempotent creation, private tracking, admin minimization, and live-booking refusal. These local checks do not establish production database durability, backup/restore, performance, or real-world delivery. Responsive markup/CSS is asserted in tests, but no manual desktop/mobile browser review is included in that test evidence.

Release verification requires Vercel to report the exact pushed source SHA as `READY` and public HTTP checks to pass, including `/api/health`, direct client-route loads, and the courier UI/API gates. Keep `main` unchanged and the project private. Do not enable paid resources, change Vercel settings, or add a real courier provider without separate authorization.
