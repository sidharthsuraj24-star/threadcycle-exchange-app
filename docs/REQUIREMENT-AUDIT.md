# Requirement audit against both supplied briefs

**Status labels:** **Pass** means the code implements the requirement and the listed tests exercise it; **Partial** means only a narrower version exists or evidence is incomplete; **Missing** means no implementation exists; **Not testable** means live-service or real-world evidence is required. This audit covers `/home/ubuntu/upload/pasted_content.txt`, `/home/ubuntu/upload/pasted_content_2.txt`, and the user-directed follow-up scope. Source and evidence paths are relative to the repository root. The existing noncommercial student demo is live at the production site from commit `6e0e0988`; this update targets the existing `vercel-preparation` branch, leaves `main` unchanged, and does not change Vercel settings. Courier integration is intentionally deferred.

## Product scope and original deliverables

| Requirement | Status | Current evidence and limits |
|---|---|---|
| Dedicated one-for-one clothing exchange without monetary transactions | **Pass** | Listing, request, and private conversation flows support direct swaps. No checkout/payment integration or sale flow is present. |
| Encourage reuse without claiming measured impact | **Pass** | Product copy describes reuse, but reports no textile-waste, emissions, adoption, or verified exchange figures. |
| Six to eight connected screens | **Pass** | Eight connected screen groups: Discover/city matches, login/register, listing detail, swap request, messages/thread, member dashboard/profile, admin, and the new separate Community route. |
| Realistic clothing sample data instead of generic placeholders | **Partial** | Seed data has realistic clothing attributes and imagery for demonstration, but is synthetic, clearly labeled, cannot receive requests, and is not real member supply. No real member data was invented to fill the marketplace. |
| Complete product requirements document | **Pass** | `docs/PRD.md` now defines lifecycle, status/audit fields, agreement gating, analytics denominators, privacy, manual shipment notes, and all remaining partials. |
| Live deployed application link | **Pass for existing service; verify each release** | The existing site is live at [threadcycle-exchange-app.vercel.app](https://threadcycle-exchange-app.vercel.app/). This update builds on production commit `6e0e0988` and targets the same production branch; confirm the deployed SHA and public HTTP checks for each release. |

## User, listing, matching, and swap requirements

| Requirement | Status | Current evidence and limits |
|---|---|---|
| Register/login, profile, password/session security | **Pass** | Express/MongoDB accounts, bcrypt, MongoDB-backed sessions and shared short-lived rate-limit counters, CSRF/origin checks, profile editing, role gates, and outsider denials are exercised by `tests/marketplace.test.js`. |
| Clothing listings, details, availability, edit/remove, persistent safe photos | **Pass** | Authenticated ownership, server-calculated estimates, bounded fields, JPEG/PNG/WebP signature checks, MongoDB image bytes, and edit/remove are covered by integration tests. |
| Browse and filter by category/location/text/size | **Pass** | Server-side bounded filters exist; city filtering is broad member-entered text. It is not geospatial search. |
| Swap request, incoming response, withdrawal, reservation, and current status | **Pass** | Recipient-only accept/decline, requester withdrawal, and item reservation are enforced and tested. |
| Durable actor-and-time status transition history | **Partial** | New requests and subsequent accept/decline/withdraw/dispute/complete/admin-close transitions record `from`, `to`, actor ObjectId, and timestamp. Conflicting requests are transitioned and logged individually. No actor name/email is copied into the history. Pre-existing records from before this implementation may have empty history; their unknown actors and transition times cannot be reconstructed without inventing facts. |
| Participant-only negotiation chat | **Pass** | Messages persist on a swap; both participants can read/write, while an outsider receives 404. |
| Distinct negotiated-terms agreement after chat | **Pass** | The server requires an accepted swap and at least one message from each member before proposing terms. Revisions are stored with proposer ID/time; each participant confirms the current revision independently. A changed proposal makes a new revision and clears earlier confirmations. Tests check outsider denial, pre-accept denial, revision reset, and exact transition gating. |
| Keep terms agreement separate from final completion confirmations | **Pass** | The server rejects either completion confirmation until both participants confirm the current terms; each later completion action is separately stored with member ID/time, and the swap becomes completed only after both act. UI labels and API tests distinguish them. Completion remains an unverified member claim. |
| Estimate from category, condition, and brand | **Partial** | A disclosed deterministic formula uses category guide, condition, and **brand tier**, rounded to ₹50. The typed brand label is not used by the estimator and is not matched to a brand catalog. |
| Compare item values and suggest fair matches | **Pass** | Deterministic value-gap ordering and comparison exist. UI disclaims any fairness guarantee; demo offers do not enter member matches. |
| Nearby/city opportunities and location filtering | **Partial (city-level by choice)** | The endpoint returns real same-city opportunities first, labels other-city alternatives, trims/collapses whitespace, applies Unicode normalization on input, and matches case/spacing-insensitively; tests cover those cases. It does not resolve aliases or provide actual nearby distance, radius, GPS, coordinates, or street-address matching. |

## Courier, private shipment notes, and privacy

| Requirement | Status | Current evidence and limits |
|---|---|---|
| Safe secondary-objective coverage of courier-related hand-off | **Partial** | After mutual terms confirmation, the two participants can manually enter a service/carrier label, tracking reference, local/remote/flexible preference, and self-reported status. Status changes have actor/time history. Server tests verify participant access and that admin output omits tracking references. Provider selection is deferred with courier integration. |
| Real courier integration for remote swaps | **Partial — intentionally deferred** | No provider/API, authorized credentials or consent, capability lookup, booking, rates, labels/waybills, cancellation, carrier status, or verified delivery is implemented. Manual notes are not integration. Courier integration is outside this release and needs separately authorized scoped work. This audit does not claim the requirement passes. |
| Protect shipment references and avoid a public tracking link | **Pass** | Shipment metadata is returned only by participant-authorized swap/dashboard routes, is not in public listing or admin-overview responses, and is never rendered as a public tracking URL. Outsider access tests return 404. |
| PII minimization in transition/activity histories | **Pass** | Histories refer to member ObjectIds rather than duplicating names or emails. UI cautions against placing payment/contact/exact-address details in negotiated terms; free-form user content is still user-controlled. |

## Admin, analytics, and non-functional requirements

| Requirement | Status | Current evidence and limits |
|---|---|---|
| Admin member/listing/swap/dispute moderation | **Partial** | Role-gated suspension, listing hide/restore, dispute review and closure are implemented and tested. Admin views show only the newest 30 members/listings/swaps; no search or pagination is available. Admin cannot mark a swap completed on behalf of participants. |
| Record-based admin counts, excluding demo seed accounts/listings | **Pass** | Counts derive from MongoDB. Completion count requires both in-app confirmations and is not represented as proof of a real exchange. |
| KPI: clothing listings | **Partial** | Current KPI counts available non-demo listings, not all listings in every state. |
| KPI: successful swaps | **Partial** | The app counts two-member completion confirmations, not independently verified physical delivery/exchange. The admin label and PRD disclose this. |
| KPI: active users | **Pass, defined scope** | Distinct eligible non-demo, non-suspended members with at least one tracked successful action in the rolling prior 30×24 hours. Read-only visits, login, and search are not counted; the definition appears in `docs/PRD.md` and admin UI. |
| KPI: engagement count/rate | **Pass, defined scope** | Engaged = at least two tracked successful action events. Rate = engaged / eligible member count × 100; zero denominator returns unavailable. Tests assert exact counts and 50% fixture result. |
| KPI: swap request acceptance conversion | **Pass, defined scope** | Denominator = requests created in the same rolling 30-day window; numerator = those cohort records with a recorded `to: accepted` transition. The rate is null if no requests were created. Requests can convert after creation, and events before instrumentation are not inferred. Tests verify current-window and 31-day-old fixtures. |
| First-party activity privacy/retention | **Pass** | MongoDB event documents store account ID, allow-listed action, timestamp only; no external trackers or message/listing/tracking text. TTL index expires events after 35 days (database TTL cleanup can be asynchronous). No pre-instrumentation activity is backfilled. |
| Secure authentication, input validation, and safe rendering | **Pass** | Integration coverage includes password hashing, CSRF/origin, safe user-data rendering, role and participant denial, image-signature validation, constrained fields/enums, and shared MongoDB rate-limit counters using HMAC client identifiers rather than stored raw IP keys. |
| Mobile-responsive design | **Pass in source; partial verification** | Responsive breakpoints and reduced-motion styling are present. No automated viewport/browser review was run for these changes. |
| Search performance and scale | **Partial** | Listing reads are bounded and indexes exist; regex free-text search and absent load/latency benchmarks, including for the current branch on production, limit scale conclusions. |
| Secure persistent storage and production resilience | **Partial** | Production startup requires MongoDB and a strong session secret; sessions, listings, swaps, images, audit/events persist in MongoDB. Tests use an ephemeral database. No production connection, backup, restore, scale, or security review was conducted. |
| Vercel Functions source compatibility | **Partial; source checks plus release smoke** | Root `index.js` exports the Express app, Vercel serves `public/` from its CDN, MongoDB initialization is cached per warm instance, sessions and shared rate-limit counters use MongoDB, `/api/health` waits for database readiness, and photo limits fit below the documented 4.5 MB request cap. This update uses the existing production branch and project settings; check its deployed SHA and public HTTP behavior for the release. Source/API checks do not establish database backup, restore, or load performance. |
| Suggested frontend frameworks | **Partial / suggestion only** | Delivered frontend uses HTML/CSS/vanilla JavaScript; the brief marks React/Bootstrap/Tailwind as suggestions, not mandatory acceptance criteria. Backend uses Node.js/Express and MongoDB. |
| Accuracy/fairness of member listings and physical swaps | **Not testable** | Code validates formats but cannot verify garment identity/condition, exchange fairness, delivery, or real-world behavior. No such claim is made. |
| Community groups/discussions beyond swap threads | **Partial (text-first community MVP)** | A separate public sustainable-fashion feed supports categorized text posts, comments, toggleable likes, reports, author removal, and admin report review/hide/dismiss/restore. It is not a groups/follow system, accepts no community images, and is not a private swap thread. |

## Out-of-scope items, impact, and evidence

| Requirement or boundary | Status | Current evidence and limits |
|---|---|---|
| No payments/cash checkout | **Pass** | No payment routes/provider or cash-sale flow. |
| No AI fashion recommendations | **Pass** | Matching is deterministic city/value sorting, not AI. |
| No AR/virtual try-on | **Pass** | No AR feature exists. |
| No native mobile app | **Pass** | Deliverable is a responsive web app only. |
| Impact outcomes (waste, environmental impact, cost access, real adoption) | **Not testable** | No baseline, verified exchanges, deployed population, or impact measurement exists; no outcome is claimed. |
| Future items (AI, native app, verification, impact tracker, social groups) | **Pass as exclusions** | These are not presented as completed features. |
| Fully tested before submission | **Partial** | Latest local syntax/integration run passes (15 tests); manual browser/viewport behavior, database durability/backup, load, and courier integration (deferred) remain outside the automated suite. Local test results and release smoke results are separate. Exact local command output is in `docs/TEST-EVIDENCE.md`. |
| Live-only final evaluation/deployment | **Pass for the existing service; verify current release SHA** | The production URL is live. Treat an update as live only after Vercel reports the exact `vercel-preparation` commit as production and the public HTTP checks pass. |

The source audit therefore **does not pass every original acceptance criterion**: real provider-based courier integration and nearby geographic distance matching remain intentionally out of scope. Manual tracking notes remain separate from courier integration. Local test results alone do not establish production behavior; verify the deployed SHA and public HTTP routes for each release.
