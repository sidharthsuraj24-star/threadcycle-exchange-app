# Deployment handoff

**Status: not deployed. No live URL has been created or verified.**

## Observed blockers

- No authorized Render account session or deployment connector/CLI is available for this task.
- The source is in the owner's existing private GitHub repository `sidharthsuraj24-star/threadcycle-exchange-app`; Render still needs the owner to authorize access to that repository and account.
- No MongoDB URI or related deployment environment variable is configured in this workspace. The included free-tier Render Blueprint is set to generate a fresh session secret as a protected host variable.
- The app intentionally refuses production startup without a real MongoDB URI and a 32-byte `SESSION_SECRET`; it does not use local uploads or an in-memory/file fallback.

Per the task instructions, no deployment was started. No credentials were entered, no cloud resources were created, and no public app URL was provisioned.

## What is ready

The source is under `/workspace/clothing-swap-marketplace`. It is prepared for a free Render Web Service and an Atlas M0 Free cluster, but those accounts and database connection are not authorized/configured here. Member photos and durable marketplace records are stored in MongoDB; local app disk is not used for user data. Seed photos are static illustrations in the source tree.

## What must be supplied or authorized

1. Sign in to the owner's Render account and authorize the existing **private** GitHub repository `sidharthsuraj24-star/threadcycle-exchange-app` for a **Render Free** Web Service. Do not create another repository or select a paid service.
2. Create/authorize a **MongoDB Atlas M0 Free** database, and provide its application connection URI through the coordinator’s secure secret form (`MONGODB_URI`; secret). The URI must point to a database-only user with the database name included and a URL-encoded password.
3. Keep the Blueprint-generated `SESSION_SECRET` in the host’s protected environment; do not put it in Git or source files. If deploying manually instead, generate and enter a fresh value of at least 32 random bytes in the host’s secret field.
4. Allow only free-tier resources. Do not accept any upgrade/payment/billing/identity/terms request without separate user authorization.
5. Once the service receives an assigned hostname, set `APP_ORIGIN` to that exact HTTPS origin and verify `/api/health` reports connected to MongoDB before providing any URL.

Free-tier caution: Render Free services can sleep and use ephemeral local filesystems; this app stores durable app data and photos in MongoDB. The provided Atlas Free option is limited (0.5 GB, no backups, and may pause after inactivity), so do not promise production-grade durability or uptime.

## Admin owner action

After first deploying, the authorized owner registers a normal account. From a trusted shell with the same database URI configured as a protected environment secret, run `npm run admin:promote -- owner@example.com` and type that exact registered email at the confirmation prompt. No default admin credentials or public admin bootstrap are included.
