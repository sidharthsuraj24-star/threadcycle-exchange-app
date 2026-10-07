# Vercel deployment handoff

The noncommercial student demo is live at the [production site](https://threadcycle-exchange-app.vercel.app/). It uses the private GitHub repository `sidharthsuraj24-star/threadcycle-exchange-app` on branch `vercel-preparation`; `main` is not the deployment branch. Keep the repository and project private, and do not enable paid resources.

The city-normalization and Community update is scoped to the existing `vercel-preparation` branch, based on production commit `6e0e0988`. Keep `main` unchanged and do not change Vercel settings; verify each release against Vercel's deployed SHA and public HTTP routes. Courier integration remains deferred.

## Runtime and routing

Vercel detects the root `index.js` and runs the Express app as a Function. Vercel serves `public/` assets from its CDN; Express skips local static-file serving in Vercel, but now serves `public/index.html` for non-API GET routes so client-side pages work on direct load and refresh. Requests to `/api` and `/api/*` are not rewritten to the app shell. `vercel.json` continues to provide security headers for the CDN-served HTML, while Express API responses retain Helmet.

The deployed app uses MongoDB for listings, photos, swaps, messages, sessions, and rate-limit counters. Swap acceptance now uses a MongoDB transaction to reserve both listings and update conflicting requests atomically; the production database must support transactions. Accepted JPEG, PNG, and WebP uploads are re-encoded as WebP before storage, removing EXIF and other source metadata. The source upload limit remains four photos at 1 MB each.

## Product boundaries

This remains a noncommercial student demo. Participants may enter private manual hand-off or shipment notes and self-reported status, but there is no courier API, booking, rates or labels, payment, public tracking, or carrier-verified delivery. Preserve this manual workflow; a courier integration or paid resource requires separate authorization.

Illustrative sample listings and profiles are labeled, have no credentials, cannot receive swap requests, and are excluded from matching and KPI activity. A completed in-app swap is not proof of a physical exchange or delivery. Keep all database, session, and provider secrets in the existing protected deployment configuration; never commit or print them.

## Verification

Run `npm ci`, `npm run check`, and `npm test` before publishing changes. The integration suite uses a single-node MongoDB replica set so the concurrent-acceptance regression exercises transaction semantics; it also checks direct client routes, a missing-token CSRF request, and removal of location-like EXIF metadata.

For this fix, the original deployment was confirmed to return 404 on client-side page refreshes, while the homepage and API were reachable. After the branch update deploys, verify `/api/health`, direct loads of `/login`, `/dashboard`, and `/messages/<id>`, static assets, and a listing photo response. Do not add paid resources or courier integrations as part of this repair.
