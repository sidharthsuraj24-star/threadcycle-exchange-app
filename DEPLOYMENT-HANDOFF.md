# Vercel deployment handoff

**Status: source preparation only. No Vercel project was created, no deployment was started, no account sign-in or secrets were requested, and there is no live URL.** The owner authorized Vercel only for a **noncommercial student demo** and explicitly required waiting for a courier-provider choice before deployment. Keep the project private and do not enable paid resources.

## Current source and host behavior

The source is the private GitHub repository `sidharthsuraj24-star/threadcycle-exchange-app`; the audited base was `main` at commit `2522c30`. This preparation is intended for the separately named `vercel-preparation` branch, without changing `main` or any other repository. Repository visibility was verified as private before preparation.

Vercel's documented [Express integration](https://vercel.com/docs/frameworks/backend/express) detects the root `index.js` and uses its default-exported Express app as a Function. There is no long-running `npm start` command in this deployment mode. `public/` contains the static frontend and sample imagery; Vercel serves it from its CDN as described in the [Express deployment guide](https://vercel.com/kb/guide/ship-a-express-app-on-vercel). The application skips Express's local static-file middleware and local `index.html` fallback when `VERCEL` is set. [`vercel.json`](https://vercel.com/docs/project-configuration/vercel-json) provides the static HTML page's CSP and related security headers; Express API responses retain Helmet. The selected Node.js runtime should follow Vercel's [supported Node.js runtime documentation](https://vercel.com/docs/functions/runtimes/node-js).

The Function request passes through the existing Express API router and security middleware. A shared initializer lazily connects Mongoose, creates declared indexes, and optionally seeds illustrative demo records; a module-level promise prevents duplicate initialization within one warm instance. Account/listing/swap/message/image data, sessions, and short-lived rate-limit counters stay in MongoDB. Rate-limit counters use HMAC-keyed client identifiers, are shared across Function instances, and expire after their windows; raw IPs are not stored. Secure cookies, CSRF, same-origin checks, authentication, rate limits, and role checks remain enabled. Production/Vercel startup refuses to proceed without `MONGODB_URI` and a session secret of at least 32 bytes.

## Release gates and remaining compatibility notes

1. **Courier-provider choice is a release gate.** The app currently has manual, participant-only shipment notes and self-reported status, not an external courier integration. The owner must choose the provider before any deployment. If the choice requires provider API work, credentials, booking, rates/labels, tracking, or other feature changes, authorize and implement that scope separately before treating the courier requirement as met. Do not add or contact a provider as part of this handoff.
2. **Persistent MongoDB is required.** Before setup, the owner must have an authorized MongoDB deployment reachable from Vercel and decide its network/access configuration. No database URI is currently supplied in this preparation, and this handoff does not provision a database or choose a paid tier.
3. **Vercel request/response payloads are limited to 4.5 MB** per the official [Function limitations](https://vercel.com/docs/functions/limitations). To stay below the request ceiling, listing uploads permit at most four photos, each up to 1,000,000 bytes (4,000,000 bytes of file data total); multipart fields are individually bounded. JSON is capped at 64 KB and URL-encoded bodies at 16 KB. This is a hosting compatibility limit, not a change to the four-photo listing feature.
4. No production database, deployed health check, live browser review, load test, database backup/restore, real courier behavior, physical exchange, or delivery has been verified.

## Exact Vercel setup after the release gate

Do not perform these steps while the courier-provider choice is unresolved. The existing Vercel authorization is limited to the noncommercial student demo; persistent database setup is also a prerequisite.

1. In Vercel, import **only** `sidharthsuraj24-star/threadcycle-exchange-app` from the owner's existing private GitHub account. Keep the repository private and choose the `vercel-preparation` branch for this source. Do not create a new or public repository.
2. Keep the project Root Directory as `.`. Allow Vercel to detect Express from the root `index.js` using the documented [Express behavior](https://vercel.com/docs/frameworks/backend/express); use the documented [`vercel.json` configuration](https://vercel.com/docs/project-configuration/vercel-json) without defining a custom rewrite or a persistent server process. If the setup form requests build settings, use:
   - Install Command: `npm ci`
   - Build Command: `npm run check`
   - Output Directory: unset
   - Start Command: unset
   - Node.js: use the repository's Node 22 pin (`.nvmrc`); the package requires Node.js 20 or newer.
3. In Vercel's protected Environment Variables settings, configure the values for the intended deployment environment (never commit them):
   - `MONGODB_URI` — the authorized persistent MongoDB connection URI, including the database name.
   - `SESSION_SECRET` — a fresh random value of at least 32 bytes.
   - `APP_ORIGIN` — the exact HTTPS origin assigned to the deployment (no path or trailing route); set it after the hostname is known.
   - `TRUST_PROXY` — `1`, for Vercel's single trusted proxy hop.
   - `SEED_DEMOS` — `true` if the eight labeled illustrative listings should be present.
   - `NODE_ENV` is supplied by Vercel for the deployment; do not set it to development in production.
4. After the courier choice is resolved and the persistent database prerequisites are configured, let Vercel build the selected private branch within the existing noncommercial-demo authorization. Do not upgrade or enable paid resources; stop if the dashboard requires a paid plan, payment, or billing action.
5. After Vercel assigns the URL, confirm the static page and assets load; then check `/api/health` returns `{"ok":true,"database":"connected"}`. Verify account registration/login, secure cookie attributes, CSRF and same-origin rejection, a listing upload within the four-photo/1-MB-per-file limit, private chat, and administrator access with owner-authorized accounts. Do not represent a health response alone as proof of all product acceptance criteria.
6. Set `APP_ORIGIN` to the exact assigned HTTPS origin in the applicable Vercel environment and redeploy if necessary; repeat the origin/CSRF checks. Provide a URL only after a reachable health check and all required verification.

## Current verification and boundaries

The source tests and Vercel configuration checks are local preparation checks only. They do not create a Vercel project or deployment, access a live database, select a courier, or establish a public URL. Manual shipment notes must continue to be described as manual, non-carrier-verified records. No admin password, database secret, session secret, provider credential, payment, or third-party resource is included in the repository.
