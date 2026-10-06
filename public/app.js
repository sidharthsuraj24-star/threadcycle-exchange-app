const appRoot = document.getElementById('app');
let currentUser = null;
let csrfToken = '';
let toastTimer;
const categories = ['Tops', 'Outerwear', 'Dresses', 'Bottoms', 'Shoes', 'Accessories', 'Bundle'];
const conditions = ['New with tags', 'Excellent', 'Good', 'Well loved'];
const tiers = ['Everyday', 'Premium', 'Designer', 'Unbranded'];
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const shortDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const shortTime = (value) => value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const selected = (value, candidate) => String(value || '') === String(candidate) ? ' selected' : '';
const img = (url, alt, extra = '') => `<img class="${extra}" src="${escapeHTML(url || '/favicon.svg')}" alt="${escapeHTML(alt)}" loading="lazy">`;
function toast(message, error = false) {
  let node = document.querySelector('.toast');
  if (!node) { node = document.createElement('div'); node.className = 'toast'; node.setAttribute('role', 'status'); document.body.appendChild(node); }
  node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3500);
}
async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(url, { ...options, method, headers, body, credentials: 'same-origin', cache: 'no-store' });
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    if (response.status === 401 && currentUser) { currentUser = null; }
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (data.user) currentUser = data.user;
  return data;
}
function routeInfo() {
  const url = new URL(location.href);
  return { path: url.pathname.replace(/\/$/, '') || '/', query: url.searchParams };
}
function navigate(path) {
  history.pushState({}, '', path);
  const hash = new URL(path, location.origin).hash;
  void render().then(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
function logo() { return `<a class="brand" href="/" data-link aria-label="Second Loop home"><span class="brand-mark">S</span><span class="brand-text">second <span>loop</span></span></a>`; }
function header(path) {
  const link = (href, text, active) => `<a href="${href}" data-link class="${active ? 'active' : ''}">${text}</a>`;
  const matchesView = routeInfo().query.get('view') === 'matches';
  return `<header class="site-header"><div class="header-inner">${logo()}<nav class="main-nav" id="main-nav" aria-label="Main navigation">
    ${link('/', 'Discover', (path === '/' && !matchesView) || path.startsWith('/listings'))}${link('/?view=matches', 'City matches', path === '/matches' || matchesView)}${currentUser ? link('/messages', 'Messages', path.startsWith('/messages')) : ''}${currentUser ? link('/dashboard', 'My wardrobe', path === '/dashboard' || path === '/profile') : ''}${currentUser?.role === 'admin' ? link('/admin', 'Admin', path === '/admin') : ''}
    </nav><div class="header-actions">${currentUser ? `<span class="user-pill">${escapeHTML(currentUser.name)}</span><button class="icon-button" data-action="logout" aria-label="Sign out" title="Sign out">↗</button>` : `<a class="button button-outline button-small" href="/login" data-link>Sign in</a>`}<button class="icon-button menu-toggle" data-action="menu" aria-label="Toggle menu" aria-expanded="false">☰</button></div></div></header>`;
}
function footer() {
  return `<footer><div class="footer-inner"><div>${logo()}<p>Clothes find their next chapter through direct, one-for-one exchanges. No payments, courier booking, or carrier integration.</p></div><p>DEMO NOTICE · Cards labeled illustrative are sample content only, not real member offers. Other listings and photos come from registered members. Cities are member-entered; no real-world swaps or impact claims are implied.</p></div></footer>`;
}
function layout(content, path) { appRoot.innerHTML = `${header(path)}<main id="main-content">${content}</main>${footer()}`; }
function demoBadge(isDemo) { return isDemo ? '<span class="badge badge-demo">Illustrative demo</span>' : ''; }
function statusBadge(status, agreementConfirmed = null) {
  const acceptedLabel = agreementConfirmed === true ? 'Accepted · terms agreed' : agreementConfirmed === false ? 'Accepted · terms pending' : 'Accepted';
  const labels = { requested: 'Awaiting response', accepted: acceptedLabel, declined: 'Declined', withdrawn: 'Closed', completed: 'Completion claimed by both', disputed: 'Needs admin review' };
  const type = ['declined', 'withdrawn', 'completed'].includes(status) ? 'closed' : status === 'disputed' ? 'disputed' : status === 'requested' ? 'pending' : '';
  return `<span class="badge badge-status ${type}">${escapeHTML(labels[status] || status)}</span>`;
}
function listingCard(item, match = null) {
  const url = `/listings/${encodeURIComponent(item.id)}`;
  return `<article class="listing-card"><a class="listing-card-media" href="${url}" data-link aria-label="View ${escapeHTML(item.title)}">${img(item.imageUrls?.[0], `${item.title} clothing listing${item.isDemo ? ', illustrative demo photo' : ''}`)}${item.isDemo ? `<span style="position:absolute;left:10px;top:10px">${demoBadge(true)}</span>` : ''}</a><div class="listing-card-body"><div class="listing-kicker"><span>${escapeHTML(item.category)} · ${escapeHTML(item.size)}</span>${match ? `<span class="match-note">${match.sameCity ? '● Same city' : 'Other city · value fit'}</span>` : ''}</div><h3><a href="${url}" data-link>${escapeHTML(item.title)}</a></h3><div class="listing-meta"><span>${escapeHTML(item.condition)}</span><span>·</span><span>${escapeHTML(item.city)}</span></div><div class="listing-bottom"><span class="value-tag">~${money(item.estimatedValue)} <span class="sr-only">indicative estimate</span></span><a class="button button-quiet button-small" href="${url}" data-link>View item <span aria-hidden="true">→</span></a></div></div></article>`;
}
function browseChip(label, value, current, query) {
  const params = new URLSearchParams(query.toString());
  if (value) params.set('category', value); else params.delete('category');
  params.delete('view');
  return `<button class="category-chip${current === value ? ' active' : ''}" type="button" data-category="${escapeHTML(value)}" aria-pressed="${current === value}" data-query="${escapeHTML(params.toString())}">${escapeHTML(label)}<span aria-hidden="true">↗</span></button>`;
}
function pageHead(label, title, body) { return `<div class="page-head"><div class="eyebrow">${escapeHTML(label)}</div><h1>${escapeHTML(title)}</h1><p class="lede">${escapeHTML(body)}</p></div>`; }
function disclaimer(message = 'Illustrative demo listings only. Sample people, items, photos, and activity are not real member offers or completed swaps.') {
  return `<aside class="disclaimer"><span class="disclaimer-mark">i</span><span><b>Demo content:</b> ${escapeHTML(message)}</span></aside>`;
}
async function renderBrowse(query) {
  if (query.get('view') === 'matches') { await renderMatches(true); return; }
  const q = query.get('q') || '', category = query.get('category') || '', city = query.get('city') || '';
  const params = new URLSearchParams(); if (q) params.set('q', q); if (category) params.set('category', category); if (city) params.set('city', city);
  const data = await api(`/api/listings${params.size ? `?${params}` : ''}`);
  const hero = `<section class="hero"><div class="container hero-grid"><div class="hero-copy"><div class="eyebrow">A slower kind of style</div><h1>Good clothes.<br><em>New chapters.</em></h1><p>Trade a piece you’ve outgrown for one you’ll reach for again. One direct swap at a time, on your terms.</p><div class="hero-cta"><a class="button" href="#the-wardrobe">Explore the wardrobe <span aria-hidden="true">↓</span></a>${currentUser ? `<a class="button button-outline" href="/dashboard" data-link>List a piece</a>` : `<a class="button button-outline" href="/register" data-link>Join the community</a>`}</div><p class="hero-note">No payments. No courier booking. Negotiate the details directly.</p></div><div class="hero-art">${img('/images/demo-8.webp', 'Illustrative wardrobe of clothing, not a live marketplace offer', 'hero-photo')}<div class="hero-sticker">Wear it<br>again<small>give good clothes another loop</small></div><div class="hero-card"><strong>Swap on your terms</strong><span>Compare estimates · agree the details together</span></div></div></div></section>`;
  const categoryBrowse = `<div class="category-browse"><div class="category-browse-head"><div class="eyebrow">Browse by category</div><h2>Start with what you love</h2><p>Pick a kind of piece, then search by size, details, or member-entered city.</p></div><nav class="category-chips" aria-label="Browse clothing categories">${browseChip('All pieces', '', category, query)}${categories.map((name) => browseChip(name, name, category, query)).join('')}</nav></div>`;
  const filter = `<div class="container">${disclaimer('Cards tagged illustrative are sample content; real member listings can be exchanged. City is broad user-entered text only.') }<section class="section" id="the-wardrobe"><div class="section-head"><div><div class="eyebrow">The shared wardrobe</div><h2>Find your next favourite</h2><p>Browse labeled demo examples alongside real member listings when members have posted them.</p></div><span class="pill">${data.total} available item${data.total === 1 ? '' : 's'}</span></div>${categoryBrowse}<form class="filter-bar" id="filter-form"><div class="field search-field"><label for="search-q">Search pieces</label><div class="search-input-wrap"><span class="search-glyph" aria-hidden="true">⌕</span><input class="input" id="search-q" name="q" value="${escapeHTML(q)}" placeholder="Try denim, linen, everyday…" maxlength="60"></div></div><div class="field"><label for="search-category">Category</label><select class="select" id="search-category" name="category"><option value="">All categories</option>${categories.map((c) => `<option${selected(category, c)}>${escapeHTML(c)}</option>`).join('')}</select></div><div class="field"><label for="search-city">City</label><input class="input" id="search-city" name="city" value="${escapeHTML(city)}" placeholder="Your city" maxlength="60"></div><button class="button" type="submit">Find pieces <span aria-hidden="true">→</span></button></form><div class="listing-grid">${data.items.length ? data.items.map((item) => listingCard(item)).join('') : `<div class="empty-state no-results"><strong>No pieces just yet</strong>Try widening your filters. City is a member-entered city name—not a distance or GPS search.</div>`}</div></section></div>`;
  layout(`${hero}${filter}`, '/');
}
async function renderMatches(embedded = false) {
  if (!currentUser) { renderAuth('login', '/?view=matches'); return; }
  const data = await api(`/api/matches?city=${encodeURIComponent(currentUser.city || '')}`);
  const cards = data.items.map((match) => listingCard(match.item, match)).join('');
  layout(`<div class="container">${pageHead('City & value guide', 'Good fits, not magic matches', 'Same-city member listings appear first; remaining offers are alternatives sorted by indicative value gap.')}${disclaimer('Matching is exact city-level text entered by members—not geospatial, distance, radius, GPS, or street-address matching. No courier booking is provided.')}<section class="section"><div class="split-head"><div><div class="eyebrow">Your entered city · ${escapeHTML(currentUser.city || 'not set')}</div><h2 style="font:500 30px var(--serif);margin:9px 0">Same-city opportunities</h2></div><a href="/dashboard?tab=profile#profile" data-link class="text-link">Edit my city</a></div><div class="note-box">Same-city is a broad city-name match only, not nearby or geospatial distance. “Other city · value fit” cards are listed as cross-city alternatives. Estimate differences do not measure garment quality, guarantee a fair exchange, or price clothes for sale.</div><div class="listing-grid">${cards || `<div class="empty-state no-results"><strong>No member listings to match yet</strong>When you list a piece, same-city and other-city offers from real members may appear here. Sample demo cards are intentionally not shown as real match opportunities.</div>`}</div></section></div>`, embedded ? '/' : '/matches');
}
async function renderAuth(mode = 'login', next = '/') {
  const registering = mode === 'register';
  const content = `<section class="auth-shell"><div class="container auth-grid"><div class="auth-art"><div><div class="eyebrow">Clothes, passed forward</div><h2>Less buying.<br>More belonging.</h2><p>Your wardrobe is a story you can keep rewriting.</p></div>${img('/images/demo-1.webp', 'Illustrative denim jacket photo used as a visual sample')}</div><div class="auth-form"><div class="form-card"><div class="eyebrow">${registering ? 'Make your account' : 'Welcome back'}</div><h1>${registering ? 'Join the loop.' : 'Come on in.'}</h1><p class="auth-sub">${registering ? 'A name, an email, and your city are all we need to get started.' : 'Sign in to manage listings, swap requests, and private conversations.'}</p><form class="form-stack" data-form="auth" data-mode="${registering ? 'register' : 'login'}" data-next="${escapeHTML(next)}">${registering ? `<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" class="input" maxlength="48" autocomplete="name" required></div>` : ''}<div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" class="input" maxlength="254" autocomplete="email" required></div>${registering ? `<div class="field"><label for="auth-city">City</label><input id="auth-city" name="city" class="input" maxlength="60" autocomplete="address-level2" placeholder="e.g. Bengaluru" required><p class="field-help">City only—never a street address or live location.</p></div>` : ''}<div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" class="input" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? '12' : '1'}" maxlength="72" required>${registering ? '<p class="field-help">Use at least 12 characters. Passwords are stored as secure hashes.</p>' : ''}</div><button class="button" type="submit">${registering ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span></button></form><div class="separator"></div><p class="auth-sub">${registering ? 'Already have an account?' : 'New around here?'} <a class="text-link" data-link href="/${registering ? 'login' : 'register'}?next=${encodeURIComponent(next)}">${registering ? 'Sign in' : 'Create an account'}</a></p><p class="legal-note">Demo listings are not member accounts and cannot sign in or receive requests.</p></div></div></div></section>`;
  layout(content, '/login');
}
async function renderDetail(id) {
  const data = await api(`/api/listings/${encodeURIComponent(id)}`);
  const item = data.item;
  const details = `<div class="container">${disclaimer(item.isDemo ? 'This photo, member profile, and listing are illustrative sample content only. This demo listing cannot receive swap requests.' : 'Swap values are estimates for discussion only. A swap is an item-for-item agreement, not a sale.')}<section class="detail-layout"><div>${img(item.imageUrls?.[0], `${item.title} clothing photo`, 'detail-main-image')}${item.imageUrls?.length > 1 ? `<div class="detail-thumbs">${item.imageUrls.slice(1).map((src) => img(src, `Additional view of ${item.title}`)).join('')}</div>` : ''}</div><article class="detail-copy"><div class="eyebrow">${escapeHTML(item.category)} · ${escapeHTML(item.size)}</div><h1>${escapeHTML(item.title)}</h1><div class="button-row">${demoBadge(item.isDemo)}<span class="pill">${escapeHTML(item.condition)}</span><span class="pill">${escapeHTML(item.city)}</span></div><p class="detail-description">${escapeHTML(item.description)}</p><div class="detail-value"><strong>~${money(item.estimatedValue)}</strong><span>Indicative swap-value estimate—not cash, a sale price, or a guarantee.</span></div><div class="detail-specs"><div class="detail-spec"><small>Category</small><b>${escapeHTML(item.category)}</b></div><div class="detail-spec"><small>Size</small><b>${escapeHTML(item.size)}</b></div><div class="detail-spec"><small>Label</small><b>${escapeHTML(item.brand)}</b></div><div class="detail-spec"><small>Condition</small><b>${escapeHTML(item.condition)}</b></div></div><div class="owner-card"><span class="avatar">${escapeHTML((item.ownerName || '?').slice(0, 1).toUpperCase())}</span><span><strong>${escapeHTML(item.ownerName)} ${item.ownerIsDemo ? demoBadge(true) : ''}</strong><small>${item.ownerIsDemo ? 'Illustrative demo profile · not contactable' : `Member-entered city: ${escapeHTML(item.ownerCity)}`}</small></span></div>${item.isDemo ? `<button class="button" disabled title="Demo sample; not a real offer">Sample listing only</button>` : `<button class="button" data-action="request-item" data-id="${escapeHTML(item.id)}">Offer a swap <span aria-hidden="true">→</span></button>`}<p class="location-note">${item.isDemo ? 'Illustrative sample data; no member account or real item is behind this card.' : 'Ask the member to confirm item details and agree how to exchange privately. No courier booking is provided.'}</p><div class="note-box">Estimate method: category guide × condition factor × brand tier, rounded to ₹50. The other member can negotiate—or decline.</div></article></section></div>`;
  layout(details, `/listings/${id}`);
}
function categoryOptions(value = '') { return categories.map((c) => `<option${selected(value, c)}>${escapeHTML(c)}</option>`).join(''); }
function conditionOptions(value = '') { return conditions.map((c) => `<option${selected(value, c)}>${escapeHTML(c)}</option>`).join(''); }
function tierOptions(value = 'Everyday') { return tiers.map((c) => `<option${selected(value, c)}>${escapeHTML(c)}</option>`).join(''); }
function listingForm(item = null) {
  const x = item || {};
  return `<form class="form-card" data-form="listing" data-id="${escapeHTML(x.id || '')}" enctype="multipart/form-data"><div class="eyebrow">${x.id ? 'Keep your listing up to date' : 'Offer a well-loved piece'}</div><h2>${x.id ? 'Edit your listing' : 'Add to the wardrobe'}</h2><p>City comes from your profile. Keep location broad and personal details private.</p><div class="form-grid"><div class="field full"><label for="listing-title">Listing title</label><input id="listing-title" name="title" class="input" maxlength="90" required value="${escapeHTML(x.title || '')}" placeholder="e.g. Relaxed linen overshirt"></div><div class="field"><label for="listing-category">Category</label><select id="listing-category" name="category" class="select" required>${categoryOptions(x.category)}</select></div><div class="field"><label for="listing-size">Size</label><input id="listing-size" name="size" class="input" maxlength="24" required value="${escapeHTML(x.size || '')}" placeholder="e.g. M / UK 10"></div><div class="field"><label for="listing-brand">Label / brand</label><input id="listing-brand" name="brand" class="input" maxlength="60" required value="${escapeHTML(x.brand || '')}" placeholder="e.g. Unbranded"></div><div class="field"><label for="listing-tier">Label tier for estimate</label><select id="listing-tier" name="brandTier" class="select">${tierOptions(x.brandTier || 'Everyday')}</select></div><div class="field full"><label for="listing-condition">Condition</label><select id="listing-condition" name="condition" class="select" required>${conditionOptions(x.condition)}</select></div><div class="field full"><label for="listing-description">A few useful details</label><textarea id="listing-description" name="description" class="textarea" maxlength="800" required placeholder="Fit, fabric, care notes, or a small flaw to mention…">${escapeHTML(x.description || '')}</textarea></div><div class="field full"><div class="price-help">Indicative swap estimate: <b data-estimate>${x.estimatedValue ? `~${money(x.estimatedValue)}` : 'Choose category and condition'}</b><br><span>Category × condition × brand tier, rounded to ₹50. This is only a conversation aid, not cash value.</span></div></div><div class="field full"><label for="listing-images">Photos ${x.id ? '(optional: upload to replace current photos)' : '(up to 4)'}</label><input id="listing-images" class="file-input" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple ${x.id ? '' : ''}><p class="photo-hint">JPEG, PNG, or WebP · max 1 MB each. Stored in the persistent database, not on temporary app disk.</p>${x.imageUrls?.length ? `<p class="field-help">Current photo${x.imageUrls.length > 1 ? 's' : ''}: ${x.imageUrls.length}</p>` : ''}</div></div><div class="form-actions"><button class="button" type="submit">${x.id ? 'Save changes' : 'Publish listing'}</button>${x.id ? `<button class="button button-outline" type="button" data-action="cancel-edit">Cancel</button>` : `<span class="legal-note">No sale price or payment field.</span>`}</div></form>`;
}
async function updateEstimate(form) {
  const output = form.querySelector('[data-estimate]');
  if (!output) return;
  const category = form.elements.category.value, condition = form.elements.condition.value, brandTier = form.elements.brandTier.value;
  if (!category || !condition) { output.textContent = 'Choose category and condition'; return; }
  try { const data = await api(`/api/value/estimate?${new URLSearchParams({ category, condition, brandTier })}`); output.textContent = `~${money(data.estimatedValue)}`; }
  catch { output.textContent = 'Unavailable'; }
}
function itemMini(item, owner) {
  if (!item) return '<div class="empty-state">Listing no longer available.</div>';
  return `<div class="mini-item">${img(item.imageUrls?.[0], item.title)}<span><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.category)} · ${escapeHTML(item.size)} · ${owner ? `${escapeHTML(owner)} · ` : ''}~${money(item.estimatedValue)}</small></span></div>`;
}
function swapPair(s) {
  return `<div class="swap-pair"><div class="swap-side">${img(s.offeredListing?.imageUrls?.[0], s.offeredListing?.title || 'Offered item')}<b>${escapeHTML(s.offeredListing?.title || 'Offered item')}</b><small>${escapeHTML(s.requester?.name || '')} · ~${money(s.offeredListing?.estimatedValue)}</small></div><div class="swap-arrow" aria-label="for">⇄</div><div class="swap-side">${img(s.requestedListing?.imageUrls?.[0], s.requestedListing?.title || 'Requested item')}<b>${escapeHTML(s.requestedListing?.title || 'Requested item')}</b><small>${escapeHTML(s.recipient?.name || '')} · ~${money(s.requestedListing?.estimatedValue)}</small></div></div>`;
}
function participantLabel(s, actorId, userId) {
  if (String(actorId) === String(userId)) return 'you';
  if ([s.requester?.id, s.recipient?.id].some((id) => String(id) === String(actorId))) return 'the other participant';
  return 'an administrator';
}
function statusHistoryMarkup(s, userId) {
  const history = s.statusHistory || [];
  if (!history.length) return '<p class="field-help">No recorded transitions yet; older records may predate transition logging.</p>';
  return `<ol class="history-list">${history.map((entry) => `<li><span>${escapeHTML(entry.from)} → <b>${escapeHTML(entry.to)}</b></span><small>${escapeHTML(participantLabel(s, entry.actorId, userId))} · ${shortTime(entry.at)}</small></li>`).join('')}</ol>`;
}
function completionHistoryMarkup(s, userId) {
  const history = s.completionConfirmations || [];
  if (!history.length) return '<p class="field-help">No final completion confirmations have been recorded. These are separate from negotiated-terms confirmations and do not verify delivery.</p>';
  return `<p class="field-help">Final completion confirmations (${history.length} of 2; member-reported, not delivery-verified): ${history.map((entry) => `${escapeHTML(participantLabel(s, entry.memberId, userId))} · ${shortTime(entry.at)}`).join(' · ')}</p>`;
}
function agreementPanel(s, userId) {
  const versions = s.agreements || [];
  const current = versions[versions.length - 1];
  const currentConfirmation = current?.confirmedBy?.some((entry) => String(entry.memberId) === String(userId));
  const state = s.agreementConfirmed ? 'Both participants confirmed these terms.' : current ? `${current.confirmedBy.length} of 2 participants confirmed this revision.` : 'No negotiated terms have been confirmed yet.';
  const history = versions.length ? versions.map((version, index) => `<article class="agreement-version"><b>Terms v${Number(version.revision)}${index === versions.length - 1 ? ' · current' : ' · prior'}</b><p>${escapeHTML(version.terms)}</p><small>Proposed by ${escapeHTML(participantLabel(s, version.proposedBy, userId))} · ${shortTime(version.proposedAt)} · ${version.confirmedBy.length} of 2 confirmed</small></article>`).join('') : '<p class="field-help">Agree the exact item-for-item terms after chatting. Both members must confirm the same revision before either completion confirmation is accepted.</p>';
  const controls = s.status !== 'accepted' ? '<p class="field-help">The request must be accepted before the separate terms agreement can be recorded.</p>' : `<form class="form-card form-stack" data-form="agreement" data-id="${escapeHTML(s.id)}"><div class="field"><label for="agreement-terms">Negotiated terms (max 1,000 characters)</label><textarea class="textarea" id="agreement-terms" name="terms" maxlength="1000" required placeholder="Describe the two items and the exchange arrangement you discussed…">${escapeHTML(current?.terms || '')}</textarea><p class="field-help">Do not include passwords, payment details, phone numbers, or exact home addresses. Proposing changed terms creates a new revision and clears both confirmations.</p></div><button class="button button-small" type="submit">${current ? 'Propose new terms revision' : 'Propose negotiated terms'}</button></form>${current && !currentConfirmation ? `<button class="button button-outline button-small" data-action="agreement-confirm" data-id="${escapeHTML(s.id)}">Confirm terms v${Number(current.revision)}</button>` : currentConfirmation ? '<p class="field-help">You confirmed this revision; a change will require you to confirm again.</p>' : ''}`;
  return `<section class="panel agreement-panel"><div class="panel-head"><h2>Negotiated agreement</h2><small>${escapeHTML(state)}</small></div><p class="field-help">This is a distinct agreement step after chat; it does not confirm delivery or completion.</p>${history}${controls}</section>`;
}
function shipmentPanel(s, userId) {
  const ship = s.shipment || { status: 'not_started', history: [] };
  const statuses = { not_started: 'Not started', dispatched: 'Dispatched · member-reported', in_transit: 'In transit · member-reported', delivered: 'Delivered · member-reported, not verified', issue: 'Issue reported', not_applicable: 'Not applicable (for example, local exchange)' };
  const history = (ship.history || []).map((entry) => `<li><span>${escapeHTML(statuses[entry.from] || entry.from)} → <b>${escapeHTML(statuses[entry.to] || entry.to)}</b></span><small>${escapeHTML(participantLabel(s, entry.actorId, userId))} · ${shortTime(entry.at)}</small></li>`).join('');
  const agreed = s.status === 'accepted' && s.agreementConfirmed;
  return `<section class="panel shipment-panel"><div class="panel-head"><h2>Private hand-off notes</h2><small>Visible only to these two participants</small></div><p class="field-help">Manual notes only. The member-entered carrier/service label and reference are not sent to any provider, and status is not verified. No booking, rates, labels, payment, public tracking page, or courier API.</p><p class="field-help">Current status: <b>${escapeHTML(statuses[ship.status] || ship.status)}</b>${ship.updatedAt ? ` · updated by ${escapeHTML(participantLabel(s, ship.updatedBy, userId))} ${shortTime(ship.updatedAt)}` : ''}</p>${history ? `<details><summary>Shipment status history</summary><ol class="history-list">${history}</ol></details>` : ''}${agreed ? `<form class="form-card form-stack" data-form="shipment" data-id="${escapeHTML(s.id)}"><div class="form-grid"><div class="field"><label for="shipment-service">Carrier or service label (optional)</label><input class="input" id="shipment-service" name="serviceLabel" maxlength="80" value="${escapeHTML(ship.serviceLabel)}" placeholder="Entered manually; no integration"></div><div class="field"><label for="shipment-reference">Tracking reference (optional)</label><input class="input" id="shipment-reference" name="trackingReference" maxlength="120" value="${escapeHTML(ship.trackingReference)}"></div><div class="field"><label for="shipment-status">Self-reported status</label><select class="select" id="shipment-status" name="status">${Object.entries(statuses).map(([value, label]) => `<option value="${value}"${selected(ship.status, value)}>${escapeHTML(label)}</option>`).join('')}</select></div><div class="field"><label for="shipment-preference">Handoff preference</label><select class="select" id="shipment-preference" name="preference"><option value="local"${selected(s.handoffPreference, 'local')}>Local</option><option value="remote"${selected(s.handoffPreference, 'remote')}>Remote / shipping</option><option value="flexible"${selected(s.handoffPreference, 'flexible')}>Flexible</option></select></div></div><button class="button button-outline button-small" type="submit">Save private hand-off notes</button></form>` : '<p class="field-help">Available after the request is accepted and both participants confirm the current negotiated terms.</p>'}</section>`;
}
function swapActions(s, userId) {
  const isRecipient = String(s.recipient?.id) === String(userId);
  const actions = [];
  if (s.status === 'requested' && isRecipient) actions.push(`<button class="button button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="accept">Accept</button><button class="button button-outline button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="decline">Decline</button>`);
  if (s.status === 'requested' && !isRecipient) actions.push(`<button class="button button-outline button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="withdraw">Withdraw request</button>`);
  if (['requested', 'accepted', 'disputed'].includes(s.status)) actions.push(`<a class="button button-outline button-small" href="/messages/${encodeURIComponent(s.id)}" data-link>Open conversation</a>`);
  if (s.status === 'accepted' && s.agreementConfirmed) {
    actions.push(`<button class="button button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="confirm">${s.confirmed ? 'Waiting for the other member' : 'Confirm final hand-off'}</button>`);
  }
  if (s.status === 'accepted') actions.push(`<button class="button button-outline button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="dispute">Ask admin to review</button>`);
  if (s.status === 'requested' && isRecipient) actions.push(`<button class="button button-outline button-small" data-action="swap-status" data-id="${escapeHTML(s.id)}" data-value="dispute">Ask admin to review</button>`);
  return `<div class="swap-actions">${actions.join('')}</div>`;
}
function swapCard(s, userId) {
  const diff = Math.abs(Number(s.offeredListing?.estimatedValue || 0) - Number(s.requestedListing?.estimatedValue || 0));
  const handoff = { local: 'Local exchange preference', remote: 'Remote / shipping preference', flexible: 'Flexible exchange preference' }[s.handoffPreference] || 'Flexible exchange preference';
  const agreement = s.agreements?.[s.agreements.length - 1];
  const agreementState = s.status !== 'accepted' ? 'Agreement not available yet' : s.agreementConfirmed ? `Terms v${Number(agreement?.revision)} confirmed by both · completion confirmation is separate` : agreement ? `Terms v${Number(agreement.revision)} · ${agreement.confirmedBy.length} of 2 confirmed` : 'Negotiated terms need both participants’ confirmation';
  return `<article class="swap-card">${swapPair(s)}<div class="swap-info"><span>${statusBadge(s.status, s.agreementConfirmed)}</span><span>Estimate gap ~${money(diff)} · ${shortDate(s.createdAt)}</span></div><p class="field-help">${escapeHTML(handoff)} · not booked or delivery-tracked.</p>${s.status === 'accepted' ? `<p class="field-help">Agreement state: ${escapeHTML(agreementState)}</p>` : ''}${s.status === 'completed' ? completionHistoryMarkup(s, userId) : ''}${s.note ? `<p class="field-help">Your note: ${escapeHTML(s.note)}</p>` : ''}<details><summary>Auditable status history</summary>${statusHistoryMarkup(s, userId)}</details>${swapActions(s, userId)}</article>`;
}
async function renderDashboard(query) {
  if (!currentUser) { renderAuth('login', '/dashboard'); return; }
  const [data, profileData] = await Promise.all([api('/api/dashboard'), api('/api/profile')]);
  const profile = profileData.profile;
  const editId = query.get('edit'); const editing = data.listings.find((item) => item.id === editId);
  const incoming = data.swaps.filter((s) => String(s.recipient.id) === String(currentUser.id));
  const outgoing = data.swaps.filter((s) => String(s.requester.id) === String(currentUser.id));
  const itemRows = data.listings.map((item) => `<div class="listing-row">${img(item.imageUrls?.[0], item.title)}<div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.status)} · ${escapeHTML(item.city)} · estimate ~${money(item.estimatedValue)}</p></div><div class="button-row"><a class="button button-outline button-small" href="/dashboard?edit=${encodeURIComponent(item.id)}" data-link>Edit</a>${item.status !== 'removed' ? `<button class="button button-danger button-small" data-action="delete-listing" data-id="${escapeHTML(item.id)}">Remove</button>` : ''}</div></div>`).join('');
  const content = `<div class="container">${pageHead('Your corner of the loop', `Hello, ${currentUser.name.split(' ')[0]}.`, 'Manage the pieces you have listed, keep an eye on requests, and agree exchange details directly.')}
    <div class="stat-grid"><div class="stat-card"><b>${data.listings.filter((i) => i.status === 'available').length}</b><span>Available listings</span></div><div class="stat-card"><b>${incoming.filter((s) => s.status === 'requested').length}</b><span>Requests to review</span></div><div class="stat-card"><b>${data.swaps.filter((s) => s.status === 'accepted').length}</b><span>Accepted · coordinate privately</span></div><div class="stat-card"><b>${data.swaps.filter((s) => s.status === 'completed').length}</b><span>Confirmed by both members</span></div></div>
    <div class="dashboard-grid"><div class="full">${listingForm(editing || null)}</div><section class="panel"><div class="panel-head"><h2>My listings</h2><small>${data.listings.length} total</small></div>${itemRows || `<div class="empty-state"><strong>A fresh start</strong>Your first well-loved piece can go here.</div>`}</section><section class="panel"><div class="panel-head"><h2>Requests to you</h2><small>${incoming.length}</small></div>${incoming.map((s) => swapCard(s, currentUser.id)).join('') || `<div class="empty-state">Nothing to review right now.</div>`}</section><section class="panel full"><div class="panel-head"><h2>My swap requests</h2><small>${outgoing.length}</small></div>${outgoing.map((s) => swapCard(s, currentUser.id)).join('') || `<div class="empty-state">You haven’t requested a swap yet. Browse the community wardrobe to find a piece.</div>`}</section><details class="panel full" id="profile" ${query.get('tab') === 'profile' ? 'open' : ''}><summary><strong>My profile and city</strong> <span class="field-help">Edit your name, broad location, or short bio</span></summary><form class="form-card form-stack" data-form="profile"><div class="field"><label for="profile-name">Name</label><input class="input" id="profile-name" name="name" maxlength="48" required value="${escapeHTML(profile.name)}"></div><div class="field"><label for="profile-email">Email</label><input class="input" id="profile-email" value="${escapeHTML(profile.email || '')}" disabled></div><div class="field"><label for="profile-city">City</label><input class="input" id="profile-city" name="city" autocomplete="address-level2" maxlength="60" required value="${escapeHTML(profile.city)}"><p class="field-help">City only—not a street address or live location.</p></div><div class="field"><label for="profile-bio">About me (optional)</label><textarea class="textarea" id="profile-bio" name="bio" maxlength="300" placeholder="What kinds of pieces do you enjoy swapping?">${escapeHTML(profile.bio || '')}</textarea></div><button class="button" type="submit">Save profile</button></form></details></div></div>`;
  layout(content, '/dashboard');
}
async function renderSwapStart(targetId) {
  if (!currentUser) { renderAuth('login', `/swap/new?item=${encodeURIComponent(targetId)}`); return; }
  const [{ item }, dashboard] = await Promise.all([api(`/api/listings/${encodeURIComponent(targetId)}`), api('/api/dashboard')]);
  const available = dashboard.listings.filter((x) => x.status === 'available');
  let body;
  if (item.isDemo) {
    body = `<div class="empty-state"><strong>This is a demo listing</strong>Sample cards are not real offers and cannot receive swap requests.<p><a href="/" data-link class="text-link">Browse actual member listings</a></p></div>`;
  } else if (!available.length) {
    body = `<div class="panel">${swapPair({ requestedListing: item, recipient: { name: item.ownerName } })}</div><div class="note-box">First add an available listing to your wardrobe; then you can make a swap offer.</div><a class="button" href="/dashboard" data-link>Add a piece</a>`;
  } else {
    body = `<div class="panel">${swapPair({ offeredListing: available[0], requestedListing: item, requester: currentUser, recipient: { name: item.ownerName } })}</div><form class="form-card" data-form="swap-request" data-target="${escapeHTML(item.id)}"><div class="field"><label for="offered-listing">Your item to offer</label><select class="select" name="offeredListingId" id="offered-listing" required>${available.map((x) => `<option value="${escapeHTML(x.id)}">${escapeHTML(x.title)} · ~${money(x.estimatedValue)}</option>`).join('')}</select></div><div class="field"><label for="handoff-preference">Preferred hand-off</label><select class="select" name="handoffPreference" id="handoff-preference"><option value="flexible">Flexible · discuss in chat</option><option value="local">Local exchange preference</option><option value="remote">Remote / shipping preference</option></select><p class="field-help">This is a preference only. After both members confirm the negotiated terms, they may add private, manually entered hand-off notes and status. No courier API, booking, payment, or verification.</p></div><div class="field" style="margin-top:13px"><label for="swap-note">A friendly note (optional)</label><textarea class="textarea" id="swap-note" name="note" maxlength="600" placeholder="Share what caught your eye, or ask about fit and condition…"></textarea></div><div class="note-box">No payment is collected. Shipping or meeting plans, if any, are up to the two members; this app does not book couriers.</div><div class="form-actions"><button class="button" type="submit">Send swap request</button><a href="/listings/${encodeURIComponent(item.id)}" data-link class="text-link">Back to item</a></div></form>`;
  }
  const content = `<div class="container-narrow">${pageHead('One-for-one, on your terms', 'Suggest an exchange', 'Choose one of your available pieces. The other member can respond, negotiate in the chat, or decline.')}${body}</div>`;
  layout(content, `/swap/new?item=${targetId}`);
}
async function renderMessages() {
  if (!currentUser) { renderAuth('login', '/messages'); return; }
  const { swaps } = await api('/api/swaps');
  const rows = swaps.map((s) => `<a class="listing-row" href="/messages/${encodeURIComponent(s.id)}" data-link><span class="avatar">⇄</span><div><h3>${escapeHTML(s.offeredListing?.title || 'Swap request')} ↔ ${escapeHTML(s.requestedListing?.title || 'item')}</h3><p>${escapeHTML(s.requester.id === currentUser.id ? `With ${s.recipient.name}` : `With ${s.requester.name}`)} · ${statusBadge(s.status)}</p></div><span class="button button-outline button-small">Open chat</span></a>`).join('');
  layout(`<div class="container">${pageHead('Private conversations', 'Swap messages', 'Talk through fit, condition, and whether you both want to move forward. Messages stay tied to the swap request.')}${swaps.length ? `<section class="panel" style="margin-bottom:55px">${rows}</section>` : `<div class="empty-state" style="margin-bottom:70px"><strong>Your messages will show up here</strong>Send a swap request on a real member listing to start a private thread.</div>`}</div>`, '/messages');
}
async function renderThread(id) {
  if (!currentUser) { renderAuth('login', `/messages/${encodeURIComponent(id)}`); return; }
  const { swaps } = await api('/api/swaps');
  const swap = swaps.find((s) => s.id === id);
  if (!swap) throw new Error('This private swap conversation was not found.');
  const { messages } = await api(`/api/swaps/${encodeURIComponent(id)}/messages`);
  const handoff = { local: 'Local exchange preference', remote: 'Remote / shipping preference', flexible: 'Flexible exchange preference' }[swap.handoffPreference] || 'Flexible exchange preference';
  const discussion = `<div class="thread-layout"><div class="thread-top"><div><a href="/messages" data-link class="text-link">← All messages</a><h2 style="margin-top:7px">A swap conversation</h2></div>${statusBadge(swap.status, swap.agreementConfirmed)}</div><div class="thread-items">${swapPair(swap)}<p class="legal-note">Indicative value gap ~${money(Math.abs(swap.offeredListing.estimatedValue - swap.requestedListing.estimatedValue))}; estimates are not prices or a fairness guarantee.</p><p class="legal-note">${escapeHTML(handoff)} only. Matching and city details are city-level, not distance-based. No courier is booked or integrated.</p></div><div class="chat-messages" aria-live="polite">${messages.map((m) => `<div class="message ${m.sender.id === currentUser.id ? 'mine' : ''}">${escapeHTML(m.body)}<small>${escapeHTML(m.sender.name)} · ${shortTime(m.createdAt)}</small></div>`).join('') || '<div class="empty-state">No messages yet.</div>'}</div>${['declined', 'withdrawn', 'completed'].includes(swap.status) ? `<div class="note-box" style="margin:14px">This conversation is closed. Completion is a separate two-member in-app confirmation; it does not verify delivery or a physical exchange.</div>` : `<form class="thread-compose" data-form="message" data-id="${escapeHTML(id)}"><label class="sr-only" for="message-body">Message</label><input class="input" id="message-body" name="body" maxlength="1200" required placeholder="Ask about fit, condition, or timing…"><button class="button button-small" type="submit">Send</button></form>`}${agreementPanel(swap, currentUser.id)}${shipmentPanel(swap, currentUser.id)}${swap.status === 'accepted' || swap.status === 'completed' ? `<section class="panel agreement-panel"><div class="panel-head"><h2>Final completion confirmations</h2><small>Separate from negotiated terms</small></div>${completionHistoryMarkup(swap, currentUser.id)}</section>` : ''}<div class="thread-footer"><span class="legal-note">Keep exact home addresses and unnecessary personal details out of the chat. Manual shipment notes are visible only to the two participants.</span><div class="button-row">${swapActions(swap, currentUser.id)}</div></div></div>`;
  layout(`<div class="container">${disclaimer('This conversation is private to its two member accounts. The app does not take payment or arrange delivery.')}${discussion}</div>`, `/messages/${id}`);
  const messagesNode = document.querySelector('.chat-messages'); if (messagesNode) messagesNode.scrollTop = messagesNode.scrollHeight;
}
async function renderAdmin() {
  if (!currentUser) { renderAuth('login', '/admin'); return; }
  if (currentUser.role !== 'admin') throw new Error('Administrator access only. The first administrator is promoted by an authorized owner from a trusted terminal; no self-sign-up exists.');
  const data = await api('/api/admin/overview');
  const kpis = [['Registered members', data.kpis.registeredMembers], ['Available member listings', data.kpis.availableMemberListings], ['Swap requests', data.kpis.swapRequests], ['Accepted', data.kpis.acceptedSwaps], ['Member-confirmed completions', data.kpis.memberConfirmedCompletions], ['Open disputes', data.kpis.disputesOpen]].map(([label, value]) => `<div class="stat-card"><b>${Number(value).toLocaleString()}</b><span>${escapeHTML(label)}</span></div>`).join('');
  const activity = data.kpis.activity30d;
  const activityKpis = [
    ['Active members · 30 days', activity.activeUsers],
    ['Engaged members · 2+ actions', activity.engagedMemberCount],
    ['Engagement rate · engaged / eligible', activity.engagementRatePercent === null ? 'n/a' : `${activity.engagementRatePercent}%`],
    ['Request acceptance · accepted / created', activity.requestAcceptanceRatePercent === null ? 'n/a' : `${activity.requestAcceptanceRatePercent}%`]
  ].map(([label, value]) => `<div class="stat-card"><b>${escapeHTML(value)}</b><span>${escapeHTML(label)}</span></div>`).join('');
  const users = data.users.map((u) => `<tr><td><strong>${escapeHTML(u.name)}</strong><br><small>${escapeHTML(u.email || '')}</small></td><td>${escapeHTML(u.city)}</td><td>${escapeHTML(u.role)}</td><td>${u.suspended ? 'Suspended' : 'Active'}</td><td>${u.role === 'admin' ? '—' : `<button class="button ${u.suspended ? 'button-outline' : 'button-danger'} button-small" data-action="admin-user" data-id="${escapeHTML(u.id)}" data-suspend="${!u.suspended}">${u.suspended ? 'Restore' : 'Suspend'}</button>`}</td></tr>`).join('');
  const listings = data.listings.map((item) => `<tr><td>${itemMini(item)}</td><td>${escapeHTML(item.city)}</td><td>${escapeHTML(item.status)}</td><td>${item.status === 'hidden' ? `<button class="button button-outline button-small" data-action="admin-listing" data-id="${escapeHTML(item.id)}" data-hidden="false">Restore</button>` : `<button class="button button-danger button-small" data-action="admin-listing" data-id="${escapeHTML(item.id)}" data-hidden="true">Hide</button>`}</td></tr>`).join('');
  const swaps = data.swaps.map((s) => `<div class="swap-card">${swapPair(s)}<div class="swap-info"><span>${statusBadge(s.status)}</span><span>${escapeHTML(s.requester?.name)} ↔ ${escapeHTML(s.recipient?.name)}</span></div>${s.adminNote ? `<p class="field-help">Admin note: ${escapeHTML(s.adminNote)}</p>` : ''}${s.status === 'disputed' ? `<div class="swap-actions"><button class="button button-danger button-small" data-action="admin-resolve" data-id="${escapeHTML(s.id)}">Close dispute · restore items</button><a class="button button-outline button-small" href="/messages/${encodeURIComponent(s.id)}" data-link>Review conversation</a></div>` : ''}</div>`).join('');
  layout(`<div class="container">${pageHead('Private moderation', 'Marketplace overview', 'Moderation and database counts only. A swap is counted complete only after both members confirm; illustrative seed entries are excluded.')}${disclaimer(data.note)}<section class="section"><div class="stat-grid">${kpis}</div><section class="panel full"><div class="panel-head"><h2>Member activity · rolling 30 days</h2><small>${shortDate(activity.startsAt)}–${shortDate(activity.endsAt)}</small></div><div class="stat-grid">${activityKpis}</div><p class="field-help">Active = at least one successful tracked member action; engaged = at least two tracked actions. Engagement rate = ${activity.engagedMemberCount} engaged eligible members / ${activity.eligibleMemberCount} currently registered, non-demo, non-suspended eligible members. Requests accepted = ${activity.requestsAccepted} requests created during this same window with a recorded acceptance / ${activity.requestsCreated} total requests created during the window. Rates are unavailable when the denominator is zero. Activity events contain member ID, action type, and timestamp only; they exclude profile/contact content and are retained for at most 35 days.</p></section><div class="note-box">These are in-app activity and request outcomes only—not environmental savings, real-world adoption, physical exchanges, delivery outcomes, or verified user behavior.</div><div class="dashboard-grid"><section class="panel full"><div class="panel-head"><h2>Members</h2><small>Newest 30</small></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Member</th><th>City</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${users || '<tr><td colspan="5">No registered members yet.</td></tr>'}</tbody></table></div></section><section class="panel full"><div class="panel-head"><h2>Recent listings</h2><small>Hide or restore offers</small></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Piece</th><th>City</th><th>Status</th><th>Action</th></tr></thead><tbody>${listings || '<tr><td colspan="4">No listings.</td></tr>'}</tbody></table></div></section><section class="panel full"><div class="panel-head"><h2>Swap activity & disputes</h2><small>Newest 30</small></div>${swaps || '<div class="empty-state">No swap records yet. Counts remain zero until users create requests.</div>'}</section></div></section></div>`, '/admin');
}
function renderError(message) {
  layout(`<div class="container-narrow" style="padding:80px 0"><div class="empty-state"><strong>We couldn’t open this page</strong>${escapeHTML(message)}<p><a href="/" data-link class="text-link">Return to the wardrobe</a></p></div></div>`, routeInfo().path);
}
async function render() {
  const route = routeInfo();
  appRoot.innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (route.path === '/') await renderBrowse(route.query);
    else if (route.path === '/login') await renderAuth('login', route.query.get('next') || '/');
    else if (route.path === '/register') await renderAuth('register', route.query.get('next') || '/');
    else if (route.path === '/matches') await renderMatches(true);
    else if (route.path === '/dashboard') await renderDashboard(route.query);
    else if (route.path === '/profile') await renderDashboard(new URLSearchParams('tab=profile'));
    else if (route.path === '/messages') await renderMessages();
    else if (route.path.startsWith('/messages/')) await renderThread(decodeURIComponent(route.path.split('/')[2]));
    else if (route.path === '/admin') await renderAdmin();
    else if (route.path === '/swap/new') await renderSwapStart(route.query.get('item') || '');
    else if (route.path.startsWith('/listings/')) await renderDetail(decodeURIComponent(route.path.split('/')[2]));
    else renderError('This page is not available.');
  } catch (error) {
    if (error.message.includes('Please sign in')) renderAuth('login', route.path);
    else renderError(error.message || 'Please try again.');
  }
}
function internalNext(value) { return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'; }
async function submitHandler(event) {
  const form = event.target.closest('form[data-form]'); if (!form) return;
  event.preventDefault();
  const type = form.dataset.form;
  const submit = form.querySelector('[type="submit"]'); if (submit) submit.disabled = true;
  try {
    if (type === 'auth') {
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries());
      const data = await api(form.dataset.mode === 'register' ? '/api/register' : '/api/login', { method: 'POST', body: payload });
      currentUser = data.user; csrfToken = data.csrfToken; toast(form.dataset.mode === 'register' ? 'Welcome to the loop.' : 'You’re signed in.');
      navigate(internalNext(form.dataset.next)); return;
    }
    if (type === 'listing') {
      const fd = new FormData(form); const editId = form.dataset.id;
      if (editId && !form.elements.images.files.length) fd.delete('images');
      const data = await api(editId ? `/api/listings/${encodeURIComponent(editId)}` : '/api/listings', { method: editId ? 'PATCH' : 'POST', body: fd });
      toast(editId ? 'Listing updated.' : 'Your listing is live.'); navigate('/dashboard'); return;
    }
    if (type === 'profile') {
      const payload = Object.fromEntries(new FormData(form).entries()); const data = await api('/api/profile', { method: 'PATCH', body: payload });
      currentUser = data.user; toast('Profile saved.'); navigate('/dashboard?tab=profile#profile'); return;
    }
    if (type === 'agreement') {
      const payload = Object.fromEntries(new FormData(form).entries()); payload.action = 'propose';
      const result = await api(`/api/swaps/${encodeURIComponent(form.dataset.id)}/agreement`, { method: 'PATCH', body: payload });
      toast(result.revisionCreated ? 'A new negotiated-terms revision was proposed. Both members must confirm it.' : 'Terms are unchanged; the current revision and its confirmations remain in effect.'); await render(); return;
    }
    if (type === 'shipment') {
      const payload = Object.fromEntries(new FormData(form).entries());
      await api(`/api/swaps/${encodeURIComponent(form.dataset.id)}/shipment`, { method: 'PATCH', body: payload });
      toast('Private hand-off notes saved. Status is member-reported, not carrier-verified.'); await render(); return;
    }
    if (type === 'swap-request') {
      const payload = Object.fromEntries(new FormData(form).entries()); payload.requestedListingId = form.dataset.target;
      const data = await api('/api/swaps', { method: 'POST', body: payload }); toast('Swap request sent.'); navigate(`/messages/${encodeURIComponent(data.swap.id)}`); return;
    }
    if (type === 'message') {
      await api(`/api/swaps/${encodeURIComponent(form.dataset.id)}/messages`, { method: 'POST', body: Object.fromEntries(new FormData(form).entries()) });
      await render(); return;
    }
  } catch (error) { toast(error.message || 'Please try again.', true); }
  finally { if (submit) submit.disabled = false; }
}
async function clickHandler(event) {
  const link = event.target.closest('a[data-link]');
  if (link && link.origin === location.origin && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault(); navigate(link.pathname + link.search + link.hash); document.querySelector('.main-nav')?.classList.remove('open'); return;
  }
  const category = event.target.closest('[data-category]');
  if (category) { const query = category.dataset.query; navigate(`/${query ? `?${query}` : ''}#the-wardrobe`); return; }
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'menu') { const nav = document.querySelector('.main-nav'); nav?.classList.toggle('open'); button.setAttribute('aria-expanded', String(nav?.classList.contains('open'))); return; }
    if (action === 'logout') { await api('/api/logout', { method: 'POST', body: {} }); currentUser = null; csrfToken = ''; toast('You’re signed out.'); navigate('/'); return; }
    if (action === 'request-item') {
      if (!currentUser) { navigate(`/login?next=${encodeURIComponent(`/swap/new?item=${button.dataset.id}`)}`); return; }
      navigate(`/swap/new?item=${encodeURIComponent(button.dataset.id)}`); return;
    }
    if (action === 'cancel-edit') { navigate('/dashboard'); return; }
    if (action === 'delete-listing') {
      if (!window.confirm('Remove this listing from the public wardrobe?')) return;
      await api(`/api/listings/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE', body: {} }); toast('Listing removed.'); await renderDashboard(routeInfo().query); return;
    }
    if (action === 'swap-status') {
      const data = await api(`/api/swaps/${encodeURIComponent(button.dataset.id)}/status`, { method: 'PATCH', body: { action: button.dataset.value } });
      toast(data.swap.status === 'completed' ? 'Both participants recorded completion confirmations; delivery is not verified.' : 'Swap status updated.'); await render(); return;
    }
    if (action === 'agreement-confirm') {
      await api(`/api/swaps/${encodeURIComponent(button.dataset.id)}/agreement`, { method: 'PATCH', body: { action: 'confirm' } });
      toast('Your confirmation of the current negotiated terms is recorded separately from completion.'); await render(); return;
    }
    if (action === 'admin-user') {
      const suspended = button.dataset.suspend === 'true';
      await api(`/api/admin/users/${encodeURIComponent(button.dataset.id)}`, { method: 'PATCH', body: { suspended } }); toast(suspended ? 'Member suspended.' : 'Member restored.'); await renderAdmin(); return;
    }
    if (action === 'admin-listing') {
      const hidden = button.dataset.hidden === 'true'; await api(`/api/admin/listings/${encodeURIComponent(button.dataset.id)}`, { method: 'PATCH', body: { hidden } }); toast(hidden ? 'Listing hidden from browsing.' : 'Listing restored.'); await renderAdmin(); return;
    }
    if (action === 'admin-resolve') {
      const reason = window.prompt('Write a brief moderation note explaining why this disputed request is being closed.');
      if (reason === null) return;
      await api(`/api/admin/swaps/${encodeURIComponent(button.dataset.id)}/resolve`, { method: 'PATCH', body: { outcome: 'close', reason } }); toast('Dispute closed. Both items were returned to available.'); await renderAdmin(); return;
    }
  } catch (error) { toast(error.message || 'Please try again.', true); }
}
function submitFilter(event) {
  const form = event.target.closest('#filter-form'); if (!form) return;
  event.preventDefault(); const data = new FormData(form); const query = new URLSearchParams();
  for (const [key, value] of data.entries()) if (String(value).trim()) query.set(key, String(value).trim());
  navigate(`/${query.size ? `?${query}` : ''}`);
}
appRoot.addEventListener('submit', submitHandler);
appRoot.addEventListener('click', clickHandler);
appRoot.addEventListener('error', (event) => { const image = event.target; if (image?.tagName === 'IMG' && !image.dataset.fallback) { image.dataset.fallback = 'true'; image.src = '/favicon.svg'; } }, true);
appRoot.addEventListener('submit', submitFilter, true);
appRoot.addEventListener('change', (event) => { const form = event.target.closest('form[data-form="listing"]'); if (form && ['category', 'condition', 'brandTier'].includes(event.target.name)) updateEstimate(form); });
window.addEventListener('popstate', render);
(async function boot() {
  try {
    const data = await api('/api/me'); currentUser = data.user; csrfToken = data.csrfToken || '';
    await render();
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'auto' });
  } catch (error) {
    layout(`<div class="container-narrow" style="padding:80px 0"><div class="empty-state"><strong>Marketplace data is not connected</strong>This app uses MongoDB for durable accounts, listings, photo storage, swaps, and messages. Configure the required database and session environment variables; no local or in-memory production store is used.</div></div>`, '/');
  }
})();
