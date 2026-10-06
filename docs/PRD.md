# Product requirements: Second Loop clothing swap marketplace

## Product purpose and scope

Second Loop is a responsive web marketplace for direct, one-for-one clothing exchanges. Members list wearable items, browse real member offers, request swaps, discuss them in a private thread, and record a separate agreement before they record completion. The product does not sell clothing, collect payments, use AI or AR, or provide a native mobile app.

Eight seeded cards are **illustrative demo content**. Names, items, images, cities, and values are synthetic, clearly labeled, non-contactable, and excluded from live member matching and analytics. No user, physical swap, delivery, environmental benefit, or community outcome is fabricated.

## Users and permissions

- **Visitor:** browse/filter available offers and inspect item details; cannot message or request a demo listing.
- **Registered member:** manage their profile and listings; request and respond to swaps; message the other participant; propose and confirm negotiated terms; record their own completion confirmation; and, after both participants confirm terms, enter private hand-off/shipment notes.
- **Administrator:** review record-based KPIs and swap-state history, suspend/restore members, hide/restore listings, and close a disputed request with a moderation note. Admins cannot attest to a real-world swap or access shipment references through the admin overview. Admin access is never self-assigned.

## Connected experience: seven top-level screen groups

1. **Discover / city-match view:** public browsing and filters, with a signed-in member’s city-level match view embedded in Discover.
2. **Login / registration.**
3. **Listing detail.**
4. **Swap request.**
5. **Messages:** inbox and participant-only thread.
6. **Member dashboard / profile.**
7. **Admin panel.**

These groups connect through browser routes. The profile editor is integrated into the member dashboard. Matching uses member-entered city text, never GPS, distance, or radius data.

## Core behavior and lifecycle

A real listing belongs to its authenticated creator and contains category, size, brand label/tier, condition, description, broad member-entered city, a server-calculated estimate, availability, and up to four JPEG/PNG/WebP photos. The estimate is **category guide × condition factor × brand-tier factor, rounded to ₹50**. It is guidance, not a cash price, appraisal, sale offer, or fairness guarantee; the typed brand name itself is not used in the formula. A separate optional **Comparable retail price (user-entered, unverified)** may be displayed as a member-supplied reference; retailer prices are not imported, and this field does not affect the estimate or matching.

A swap request connects two available member listings belonging to different members and creates a private conversation. Only the recipient can accept or decline; the requester may withdraw while the request is pending. Acceptance reserves both items. Each status transition is stored with `from`, `to`, participant/admin actor ID, and timestamp. Actor IDs are references, not duplicated names/emails. Existing records from an earlier version may not have complete historical transitions; unknown actors/times are not fabricated.

After acceptance, both participants must exchange a message before a member can propose exact negotiated terms. Each proposal creates a numbered revision; each participant confirms the current revision separately. A changed proposal creates a new revision and clears both confirmations. The server rejects completion confirmation unless both members confirmed the current terms. Each member’s later completion confirmation is a different action and is stored with that member ID and timestamp; the swap becomes completed only after both record that confirmation. This is an in-app claim, not proof of delivery or a physical hand-off.

After both participants confirm the current terms, either participant may enter a carrier/service label, tracking reference, self-reported shipment status, and local/remote/flexible preference. These notes and their status-transition history are stored on the swap and exposed only through participant-authorized swap/dashboard/thread APIs. The admin overview omits them. There is no public tracking page, external courier request, provider API, booking, availability/rate lookup, label or waybill creation, shipping payment, or carrier-verified delivery. **Real courier integration remains Partial** pending an explicitly selected provider, authorized credentials/consent, and separate implementation and testing.

## Matching

The match endpoint prioritizes real available listings whose member-entered city exactly matches the selected city (case-insensitive), then includes other-city offers as clearly labeled value-fit alternatives. Matching uses the city name and the relative difference between the member’s active-listing estimate and the candidate estimate. It is **city-level matching, not geospatial proximity**: no coordinates, GPS, street addresses, distance, or radius are collected or inferred.

## First-party analytics and KPI definitions

The admin overview reports a rolling window of the previous **30 × 24 hours**. `ActivityEvent` records only a member account ID, an allow-listed action type, and server timestamp; it does not copy names, emails, message text, listing descriptions, tracking references, or other profile content. No third-party tracker or analytics service is used. Events are indexed and expire after 35 days; ordinary MongoDB TTL cleanup may be asynchronous.

- **Eligible members:** distinct registered, non-demo, non-suspended member accounts that exist by the window end. This is the engagement-rate denominator.
- **Active members:** distinct eligible accounts with at least one recorded successful member action in the window.
- **Engaged members:** distinct eligible accounts with at least two recorded successful actions in the window.
- **Engagement rate:** engaged-member count ÷ eligible-member count × 100. If there are no eligible members, the rate is unavailable (`null`), not zero.
- **Requests created:** swap records whose `createdAt` falls inside the same 30-day window.
- **Requests accepted:** those same request records with a recorded transition to `accepted`. This is an intake-cohort conversion snapshot; a request can be accepted after it was created and the displayed numerator may therefore rise later. Requests with no stored acceptance transition are not inferred from a final status.
- **Request-acceptance rate:** requests accepted ÷ requests created × 100. If no requests were created, the rate is unavailable (`null`).

Tracked member actions are successful registration, profile/listing changes, swap request/response/withdrawal, private message send, agreement proposal/confirmation, completion confirmation, dispute request, and private shipment-note update. Read-only visits, logins, impressions, and searches are not counted. Thus active/engaged metrics describe these recorded product actions, not every visit or person using a production deployment. Events before instrumentation are not backfilled.

## Data and privacy

MongoDB persists accounts, bcrypt password hashes, profile city/bio, listings/photos, swap records, messages, first-party activity events, server-side sessions, and short-lived shared rate-limit counters. The rate-limit store saves only a secret-keyed HMAC of the limiter's client key (not the raw IP) and expires the counter after its configured window. Public listing output does not disclose email. Status/agreement histories store actor IDs and timestamps without name/email duplication. Participant-only shipment fields and status history do not appear in public listing responses or the admin overview. The UI instructs members not to enter payment details, phone numbers, or exact addresses in negotiated terms/messages; free-form member text cannot be guaranteed free of personal details, so participants should minimize it.

Session cookies are HTTP-only and SameSite Strict; production and Vercel HTTPS cookies are Secure. State-changing API routes require a session CSRF token and same-origin request. Image uploads verify JPEG/PNG/WebP signatures, cap each image at 1 MB and each listing at four images, and store bytes in MongoDB. The 1 MB cap keeps the maximum four-file multipart upload below Vercel Functions' 4.5 MB request-body ceiling; JSON and URL-encoded request bodies remain bounded at 64 KB and 16 KB. Bounded fields, fixed enums, escaped user content, authentication rate limits, and role/participant checks are required.

## Admin overview

The admin panel retains database-record counts for registered non-demo members, available non-demo listings, requests, current accepted swaps, disputes, and two-member completion confirmations. It also shows the defined 30-day active-member, engaged-member, engagement-rate, and request-acceptance metrics. A completion is always labeled as member-confirmed; it is not presented as independently verified delivery or impact. Admin collections show only the newest 30 records; search/pagination is not implemented.

## Explicit exclusions and remaining limitations

No payments, cash sale, checkout, AI recommendations, AR/virtual try-on, GPS/location tracking, native app, external identity verification, courier booking, provider API, shipping rates/labels, public tracking page, or environmental-impact claim is included. The manual participant-only shipment metadata is a limited feature, **not** courier integration. Vercel is the intended host only for the authorized noncommercial student demo; source preparation is not deployment. Deployment is on hold until the owner chooses a courier provider. The original briefs’ live-deployed-link criterion has not been met or verified. Production database durability, backups, live browser behavior, and performance at scale remain unverified. Nearby geographic search, historical reconstruction of missing legacy transition events, admin pagination, and verified physical outcomes remain limitations.

## Acceptance criteria

- Registration/login use unique email, password hashing, rate limiting, server-side sessions, CSRF checks, and role checks.
- Members can browse/search/filter items, view details, and create/edit/remove their own listings with safe persistent images.
- Swap requests use the authenticated member’s own available item; recipient accept/decline, requester withdrawal, private messaging, and reservation rules are enforced.
- Status transitions persist an actor ID and timestamp. New requests and subsequent status changes have a durable audit trail; no unknown legacy actor/time is invented.
- After negotiation, both participants must confirm the exact current terms before either completion confirmation can be accepted. Terms confirmation and final completion confirmation remain separate.
- Matching returns actual same-city member opportunities first and clearly explains that matching is city-level, not geospatial; different-city alternatives are distinguished.
- Private manually entered shipment metadata/status is available to only the two participants after bilateral terms confirmation. No courier call, booking, rate/label, payment, public tracking page, or false provider claim exists.
- First-party analytics implement the above 30-day definitions and disclose the exact numerators/denominators, retention, and exclusions.
- Admin actions are role-gated and cannot fabricate a real-world completion.
- Tests use an ephemeral MongoDB server; they verify code behavior only, not durable production storage or a public deployment.
- Deployment is a separate acceptance requirement and is **not met** until the courier-provider choice release gate is resolved, a user-authorized Vercel deployment and persistent database are configured, and a reachable health check is verified. Source preparation does not satisfy this criterion.
