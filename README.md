# Second Loop

A responsive clothing-exchange marketplace demo built with **HTML, CSS, browser JavaScript, Node.js, Express, and MongoDB**. It supports member registration/login, persistent clothing listings and images, one-for-one swap requests, negotiation chat, city/value matching, dashboards, and administrator moderation.

**Demo-data warning:** eight sample listings and corresponding sample profiles are included to make the interface understandable. All are labeled as illustrative, have no credentials, are not real member offers, cannot receive swap requests, and are excluded from KPI/matching activity. No actual users, exchanges, environmental benefits, payment, or delivery are claimed.

## What works

- Email/password registration and login; 12-character minimum; bcrypt hashing; server-side MongoDB sessions; session ID/CSRF rotation; HTTP-only, SameSite Strict cookies and Secure cookies in production.
- CSRF token and same-origin checks on state-changing requests, authentication/upload rate limits, bounded input, fixed enums, parameterized Mongo queries, HTML-escaped client rendering, administrator role gates.
- Listing create/edit/remove with JPEG/PNG/WebP only, MIME signature verification, up to four photos at 1.25 MB each. Member image bytes are stored in MongoDB, never in the application’s ephemeral local filesystem.
- Direct swap request state changes, private persistent chat, optional local/remote/flexible hand-off preference (not a booking), administrative dispute queue, and separate member confirmation before any item is counted completed.
- Search/category/city filters and deterministic matching from member-entered city plus a clearly explained estimate difference. No GPS or exact address.
- Administrator counts are record-based. Demo entries are excluded and a completion requires confirmation from both members.

## Run locally

Use **Node.js 20 or newer**. MongoDB is required for a normal application run; the server deliberately does not silently fall back to local files or process memory.

1. Create a MongoDB database (a local MongoDB server or Atlas free shared cluster).
2. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI`: connection URI to the database.
   - `SESSION_SECRET`: at least 32 random bytes. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`; place it in `.env` or the host’s secret environment configuration. **Do not commit it or share it in source code.**
3. Set `NODE_ENV=development`, `SEED_DEMOS=true`, and optionally `PORT=3000`.
4. Run `npm ci`, then `npm start`. Open `http://localhost:3000`.

`npm run dev` runs the server with Node’s file watcher. The app runs index creation before serving requests. In production, `createIndexes()` provisions declared indexes on first launch; allow that database permission and boot time.

## Tests

`npm test` launches an ephemeral MongoDB test server and drives the Express API with HTTP integration tests. The ephemeral database is **test-only** and is never used as a production persistence fallback. The tests cover registration/login/password hashing, CSRF and origin checks, listing create/edit/remove and photo validation/storage, city matching, private messaging, request withdraw/decline/accept, dual-confirmed completion, hand-off preference persistence, and administrator access/moderation.

The app package intentionally has no hard-coded demo logins or admin password. There is no user self-service admin bootstrap endpoint.

## Promote the first administrator securely

1. The authorized owner first registers a normal member account in the live app.
2. From a trusted command-line shell, set the **same** `MONGODB_URI` as the deployed service as a protected shell environment variable. Do not put its database password in terminal history or commit a `.env` file.
3. Run `npm run admin:promote -- member@example.com`. The script checks for a real registered account, prompts for that exact email, and only then grants the admin role. It creates no account and prints no secret.
4. Sign in as that existing member and open the Admin link. To remove access, update that user’s role back to `member` with an authorized database operation.

## Free-tier deployment handoff

The source is prepared for a free Render web service connected to a persistent MongoDB Atlas database. Use a Render **Free Web Service** and an Atlas **M0 Free cluster** only; do not enable a paid instance, paid add-on, or billing upgrade.

1. Put this project in a Git repository under the account you authorize for deployment. Do not include `.env`, database credentials, passwords, or admin keys. `public/images/demo-*.webp` are bundled static illustrations; member photos and marketplace data are in MongoDB. A free-service `render.yaml` Blueprint is included.
2. In Atlas, create an M0 Free cluster and a database-only user with a long unique password and the least privileges needed for this database. Configure the network access permitted by your deployment environment. Atlas free cluster limits and no-backup/idle behavior apply; do not use it as the sole store for irreplaceable data.
3. In Render, create a **Free Web Service** from the authorized repository, set Build Command `npm ci --omit=dev`, Start Command `npm start`, and supply the database URI when the Blueprint requests it. The Blueprint generates `SESSION_SECRET` as a protected environment variable; do not paste it into source code or Git. In the service’s environment settings set:
   - `NODE_ENV=production`
   - `MONGODB_URI` — Atlas URI, including the database name and URL-encoded password.
   - `SESSION_SECRET` — already generated by the Blueprint; if configuring manually, generate a fresh value of at least 32 bytes in the host’s secret field.
   - `SEED_DEMOS=true`
   - `TRUST_PROXY=1`
   - `APP_ORIGIN=https://<the-exact-render-hostname>` once Render assigns the service hostname.
4. Deploy and verify `/api/health` reports `{"ok":true,"database":"connected"}`; then verify registration, image upload, chat, and admin promotion with authorized real accounts.
5. A free Render service can sleep after inactivity and has an ephemeral filesystem, so its local disk is not used for accounts, images, or application state. The Atlas Free database is limited in size and durability; it can pause after inactivity and does not include backups. Never present the service as a continuously available production marketplace.

### Deployment is currently blocked

The available browser is stopped at the Render sign-in page. No authorized Git repository/remote, deployment connector/CLI, or MongoDB URI is configured. The Render Blueprint is configured to generate the session secret securely after an authorized deployment. This project has **not** been deployed and there is no verified public link yet. An owner must connect the source from an authorized private Git repository, sign into the free hosting account, and provide the persistent MongoDB URI through the coordinator’s secure secret form before deployment can proceed. Do not send credentials in chat.

## Project files

- `public/` — responsive frontend and clearly marked demo photos.
- `server/` — Express endpoints, MongoDB models, demo seeding, estimate calculator.
- `scripts/promote-admin.js` — secure owner-run admin provisioning.
- `tests/marketplace.test.js` — integration tests.
- `docs/PRD.md` — product requirements, scope, and acceptance criteria.
- `docs/TEST-PLAN.md` — tested outcomes and post-deployment checklist.
- `DEPLOYMENT-HANDOFF.md` and `render.yaml` — the precise hosting blocker and free-tier Blueprint.
- `.env.example` — variable names and non-secret placeholders.
