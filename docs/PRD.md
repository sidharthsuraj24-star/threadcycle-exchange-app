# Product requirements: Second Loop clothing swap marketplace

## Product purpose

Second Loop is a responsive web marketplace for members who prefer to exchange clothing directly instead of buying it. A member posts an item, browses another member’s listing, proposes one of their own available pieces, and negotiates in a private thread. Either member may decline. The application takes no payment and does not book a courier or arrange a meeting.

The included seed cards are **illustrative demo content**. Their profile names, items, photos, cities, and sample values are not real marketplace members or live offers. They cannot log in, receive a request, or be counted as activity. No swap, user, environmental benefit, or community metric is fabricated.

## Users and permissions

- **Visitor:** browse and filter public available listings and inspect item details; cannot create an account or message through demo profiles.
- **Registered member:** maintain a profile using a broad city name, create/update/remove their own listings, suggest an exchange, exchange private messages with the other participant, respond to incoming requests, report a disputed request, and confirm their own side of an accepted exchange.
- **Administrator:** use a role-protected dashboard to review record-based KPIs, suspend/restore members, hide/restore listings, and close a disputed request with a moderation note. Admin access is never self-assigned. An authorized owner promotes an already registered account using a trusted command-line action and email confirmation.

## Connected experience (7 top-level screens)

1. **Discover / nearby match view:** browse the shared wardrobe and filter by text, category, size, and city; an embedded nearby-match view combines the member-entered city with indicative value proximity.
2. **Login / register:** email/password authentication and coarse city entry.
3. **Listing detail:** item photos, fit/condition details, owner summary, city, estimate explanation, and an offer action for real available member listings.
4. **Swap request:** select one of the requester’s available listings and add an optional note.
5. **Messages:** inbox and participant-only thread associated with a request; messages persist in the database.
6. **Member dashboard / profile section:** manage listings and outgoing/incoming requests, show exchange confirmations, and edit profile fields.
7. **Admin panel:** record-based KPIs plus member, listing, swap, and dispute moderation.

These pages are linked using browser routes and are mobile-responsive. Matching is integrated into Discover; profile editing is integrated into the member dashboard.

## Core behaviors and rules

- A real listing belongs to its authenticated creator. Allowed fields are title, category, size, brand label/tier, condition, details, member city, computed estimate, status, and up to four photos.
- Member-supplied city text is a coarse matching aid. The application never requests browser location permission, stores GPS coordinates, or exposes a street address.
- The displayed swap estimate is calculated server-side: **category guide × condition factor × brand-tier factor, rounded to the nearest ₹50**. Users see these factors and may negotiate. The result is not a cash price, appraisal, offer, or fairness guarantee.
- A request links one available listing from each of two different real accounts. It creates a participant-only thread. Only its recipient can accept or decline; the requester can withdraw before a response.
- The requester may record a **local**, **remote/shipping**, or **flexible** preference. It is a discussion hint only: the app does not book a courier, arrange a meeting, collect shipping fees, or track delivery. The supplied project specifications list courier integration for remote swaps as in-scope; that requirement remains **partially implemented**, not waived by this preference field.
- On acceptance, both items become reserved. Either participant can ask for admin review. Both members must separately confirm before a swap is counted completed and the items are marked swapped.
- A completion count indicates only two in-app confirmations. It does **not** verify that goods were delivered or exchanged in person.
- Admin moderation actions are role-gated. Closing a dispute restores reserved items where appropriate; the administrator cannot mark an exchange complete on members’ behalf.
- Listing photos are stored as binary data in MongoDB, not on temporary application disk.

## Data and privacy

MongoDB persists users (bcrypt password hash only), profile city/bio, listings and image bytes, swaps, messages, and server-side sessions. Public item output does not expose members’ email addresses. Admin member views are restricted to administrators. Session cookies are HTTP-only and SameSite Strict; production cookies are secure. State-changing API calls require a session CSRF token and a matching same-origin request.

Photos accept JPEG, PNG, or WebP only, with signature verification after upload, a maximum of 1.25 MB each and four per listing. SVG and other active-content formats are rejected. Request bodies have explicit size/field limits, free-form strings are length-limited, user content is HTML-escaped in the client, and sensitive routes use rate limits.

## KPIs

The admin panel shows counts derived from database records only: registered non-demo members, available non-demo listings, swap requests, accepted swaps, disputes, and member-confirmed completions. Demo seed data is excluded. The supplied specifications also request active users, user engagement, and swap-request conversion rate; these are **not implemented** because the application has no defined activity window or event instrumentation. No climate impact, waste diversion, adoption, delivery, or successful trade claims are calculated.

## Explicit exclusions and unimplemented requirement

Payments, sale checkout, pricing clothes for cash, GPS/location tracking, external identity verification, automated fashion recommendations, virtual try-on, native mobile apps, and environmental impact claims are not included. Courier integration is **not** an exclusion from the supplied project specifications: it is an unmet in-scope requirement. This implementation only records a remote/shipping preference; it has no courier provider/API, booking, label, shipment, or tracking integration.

## Acceptance criteria

- Register/login with a unique email, hashed password, rate limiting, secure server-side session, CSRF checks, and role checks.
- Browse/search/filter items; view detail; create/edit/remove own available listings with safe photos and persistent data.
- Send a swap request using the current member’s own listing; recipient accept/decline; requester withdraw; both participants can negotiate through persistent, private messages.
- Accepted listings are reserved; both participants must confirm before completion; status history is visible on dashboards.
- Matching uses only explicitly entered city text and the published deterministic estimate; sample profiles are never presented as contactable matches.
- Admin can inspect KPIs, suspend/restore members, hide/restore offers, and close disputed requests without fabricating a completion.
- No seeded account has credentials; the user is shown no shared or default admin password.
- Tests exercise the API against an ephemeral MongoDB test server. This verifies behavior, not a deployed durable database.
- A public deployment is considered delivered only after the host and persistent database are configured, the service is reachable, and a health check confirms database connectivity. This workspace is not labeled live until then.
