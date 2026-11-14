import commerce from './commerce.config.mjs';
import { bookTeaser, bookPriceLabel } from './books.mjs';
import { profileOptions, defaults, personalizeTrip, profileQuery } from './static/personalization.mjs';

const esc = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mail = (subject, body = '') => `mailto:ceo@stargateedu.co.kr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const essentials = [
  { id: 'airport', number: '01', title: 'Get from the airport', provider: 'Incheon Airport · official rail information',
    text: 'Compare the airport rail options with your arrival time, luggage and hotel location before choosing.',
    check: 'Check the terminal, last train and the final connection to your hotel.',
    url: 'https://www.airport.kr/ap_en/1512/subview.do', action: 'Check airport rail' },
  { id: 'connectivity', number: '02', title: 'Stay connected', provider: 'KT · official SIM & eSIM options',
    text: 'Compare a visitor SIM or eSIM with your existing roaming plan. An eSIM is useful only if your phone supports it.',
    check: 'Check device compatibility, data allowance, calls and activation rules.',
    url: 'https://roaming.kt.com/eng/main', action: 'Compare SIM options' },
  { id: 'stays', number: '03', title: 'Choose your neighborhood', provider: 'Visit Seoul · official accommodation guide',
    text: 'Choose the area before the room. Put your hotel near the places you want to spend time, rather than crossing the city every morning.',
    check: 'Check the station exit, luggage access, total room price and cancellation terms.',
    url: 'https://english.visitseoul.net/Accommodation', action: 'Explore places to stay' },
  { id: 'experiences', number: '04', title: 'Add one memorable experience', provider: 'Klook · third-party activity marketplace',
    text: 'Compare a class, attraction or guided experience after your route is settled. Leave room for free time, too.',
    check: 'Check the date, meeting point, language, inclusions and refund terms.',
    url: 'https://www.klook.com/en-US/destination/c13-seoul/1-things-to-do/', action: 'Browse Seoul experiences' },
];

export function resolvedEssential(item) {
  const configured = commerce.affiliateLinks[item.id];
  const affiliate = configured?.approved === true && Boolean(configured.url);
  const url = affiliate ? configured.url : item.url;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(`Invalid commercial URL: ${item.id}`);
  return { ...item, url, affiliate };
}

const outbound = (item) => {
  const resolved = resolvedEssential(item);
  return `<a class="text-link" href="${esc(resolved.url)}" rel="${resolved.affiliate ? 'sponsored noopener' : 'noopener'}" data-conversion="essential_${item.id}">${esc(item.action)} <span aria-hidden="true">↗</span></a><span class="link-kind">${resolved.affiliate ? 'Affiliate link · we may earn a commission' : 'Regular link · no affiliate commission'}</span>`;
};

export const disclosure = () => essentials.some((item) => resolvedEssential(item).affiliate)
  ? 'Some links below are affiliate links. We may earn a commission on qualifying purchases. Each paid link is labeled; you book and pay with the provider.'
  : 'These are regular provider links. We do not currently earn affiliate commission from them. You book and pay directly with the provider.';

export function renderDays(trip) {
  return trip.days.map((day) => `<li class="route-day"><span class="day-number">${String(day.number).padStart(2, '0')}</span><div><p class="route-area">${esc(day.area)}</p><h3>${esc(day.title)}</h3><p class="route-stops">${esc(day.route)}</p><p>${esc(day.detail)}</p>${day.map ? `<a class="route-map" href="${esc(day.map)}" target="_blank" rel="noopener">Check the starting point on a map ↗</a>` : ''}<details><summary>Weather & planning note</summary><p>${esc(day.alternative)}</p></details></div></li>`).join('');
}

function profileField(name, title, value = defaults[name], prefix = 'trip') {
  return `<label for="${prefix}-${name}">${title}<select id="${prefix}-${name}" name="${name}">${Object.entries(profileOptions[name]).map(([id,label])=>`<option value="${id}"${id===value?' selected':''}>${esc(label)}</option>`).join('')}</select></label>`;
}

export function renderPersonalContext(trip) {
  return `<div class="plan-context"><div><p class="eyebrow">Chosen for your trip</p><h3>A little planning, around you.</h3><ul>${trip.why.map(note=>`<li>${esc(note)}</li>`).join('')}</ul></div><div class="personal-reading"><p class="eyebrow">Read next</p>${trip.resources.map(resource=>`<a href="${resource.href}" data-conversion="personal_reading_open"><strong>${esc(resource.title)} →</strong><span>${esc(resource.reason)}</span></a>`).join('')}</div></div>`;
}

export function renderMatchedOffer(trip) {
  const customUrl = '/custom-guide/?' + profileQuery(trip.profile);
  return `<aside class="matched-offer" id="matched-offer" data-offer="${trip.offer.kind}"><p class="eyebrow">Your next step · optional</p><h3>${esc(trip.offer.title)}</h3><p data-offer-reason>${esc(trip.offer.reason)}</p><div class="cta"><a class="btn" data-offer-primary data-book-price="${esc(bookPriceLabel())}" href="${trip.offer.kind==='custom'?esc(customUrl):'/books/?'+esc(profileQuery(trip.profile))}" data-conversion="${trip.offer.kind==='custom'?'matched_custom_open':'matched_book_open'}">${trip.offer.kind==='custom'?'Ask for a custom brief quote →':'See the '+esc(bookPriceLabel())+' PDF & sample →'}</a><a class="text-link" data-offer-secondary href="${trip.offer.kind==='custom'?'/books/':esc(customUrl)}" data-conversion="${trip.offer.kind==='custom'?'book_view':'custom_guide_view'}">${trip.offer.kind==='custom'?'Prefer a fixed-price guide?':'Need research around specific needs?'} →</a></div><p class="small muted">Your free outline stays free. The PDF is a standard edition; a custom brief is quoted separately.</p></aside>`;
}

export function planner() {
  const trip = personalizeTrip();
  return `<section class="wrap section planner-section" id="plan" aria-labelledby="plan-title">
  <div class="section-head split-head"><div><p class="eyebrow">01 / Your kind of Seoul</p><h2 id="plan-title">A Seoul plan that<br>starts with you.</h2></div><p class="lead">Your company, interests, pace and spending style matter. Get a free starting plan, then choose only the extra help you need.</p></div>
  <div class="traveler-shortcuts" role="group" aria-label="Start with a traveler profile"><button type="button" data-profile="solo">Solo discovery</button><button type="button" data-profile="couple">A couple's getaway</button><button type="button" data-profile="family">A calmer family trip</button><button type="button" data-profile="friends">Food with friends</button></div>
  <form class="planner-controls personal-controls" id="trip-planner">${profileField('days','Time in Seoul')}${profileField('party','Who is coming?')}${profileField('interest','What draws you here?')}${profileField('pace','Your pace')}${profileField('budget','Your spending style')}${profileField('season','When will you visit?')}<div class="planner-submit"><button class="btn" type="submit">Make my Seoul plan <span aria-hidden="true">→</span></button><p class="small muted">No email needed. Your choices are processed in this page.</p></div></form>
  <p class="small" id="planner-status" role="status"></p>
  <div class="plan-result" id="plan-result"><p class="plan-caption" id="plan-caption">${esc(trip.summary)}</p><p class="profile-caption" id="profile-caption">${esc(trip.label)}</p><div id="plan-context">${renderPersonalContext(trip)}</div><h3 class="route-heading">Your neighborhood days</h3><ol class="route-list" id="route-list">${renderDays(trip)}</ol><div id="matched-offer-container">${renderMatchedOffer(trip)}</div></div>
  <p class="small muted">An editorial starting point, not a live route or reservation. Check opening days, current fees, access, weather and the journey from your hotel before booking. <a href="/seoul-starter/">Read the complete starter guide</a>.</p>
  <div class="plan-tools" role="group" aria-label="Keep your free plan"><button type="button" class="btn ghost" id="download-plan">Download my free plan ↓</button><button type="button" class="btn ghost" id="print-plan">Print / save as PDF</button><button type="button" class="btn ghost" id="save-plan">Remember on this device</button><button type="button" class="text-button" id="forget-plan" hidden>Forget saved plan</button><button type="button" class="text-button" id="share-plan">Copy a link to this plan</button></div>
  <p class="small" id="plan-tool-status" role="status"></p>
  <div class="planner-next"><a class="text-link" href="/downloads/seoul-first-trip-checklist.md" download data-conversion="checklist_download">Download the arrival checklist ↓</a><a class="text-link" id="personalize-link" href="${esc('/custom-guide/?'+profileQuery(trip.profile))}" data-conversion="custom_guide_view">Want a written brief built around you? →</a></div>
  <noscript><p>The default 3-day plan is shown above. <a href="/seoul-starter/">Read the starter guide</a> or <a href="/custom-guide/">email your trip outline</a>.</p></noscript>
</section>`;
}

export function essentialsSection(full = false) {
  return `<section class="wrap section" id="essentials" aria-labelledby="essentials-title"><div class="section-head split-head"><div><p class="eyebrow">02 / Sort the practical things</p><h${full ? '1' : '2'} id="essentials-title">Less arrival admin.<br>More time for Korea.</h${full ? '1' : '2'}></div><p class="lead">Four decisions to make before you go. Compare the details that matter to your trip.</p></div>
  <div class="essentials-grid">${essentials.map((item) => `<article class="essential"><span class="item-number">${item.number}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p>${full ? `<p class="essential-check">${esc(item.check)}</p>` : ''}<p class="provider">${esc(item.provider)}</p>${outbound(item)}</article>`).join('')}</div><p class="disclosure-note">${esc(disclosure())} <a href="/disclosure/">How we earn & choose links</a>.</p>
  ${full ? '<p class="small muted">Links checked November 12, 2026. Prices and availability are shown by the provider. Listing a service does not imply a commercial partnership.</p>' : '<p><a class="text-link" href="/travel-essentials/">See the full pre-trip checklist →</a></p>'}</section>`;
}

export function customTeaser() {
  return `<section class="wrap section" id="custom"><div class="custom-panel"><div><p class="eyebrow">03 / A guide that fits you</p><h2>Your interests.<br>Your pace.<br>Your Seoul.</h2><p class="lead">Have a particular neighborhood, family pace or theme in mind? Enquire about a paid, custom digital travel brief.</p><a class="btn" href="/custom-guide/" data-conversion="custom_guide_view">Explore a custom guide →</a><p class="small">Individual quote · scope & delivery agreed by email</p></div><div class="deliverables"><p class="eyebrow">What to ask for</p><ul><li><strong>A day-by-day reading guide</strong><span>Neighborhoods grouped into a practical order.</span></li><li><strong>The details behind the choices</strong><span>Transport notes, useful links and things to check.</span></li><li><strong>Alternatives for your kind of day</strong><span>Slower options, indoor ideas and room for free time.</span></li></ul><p class="small muted">Digital information only. Bookings, tickets, accommodation and in-person guiding are arranged separately with providers.</p></div></div></section>`;
}

// Visitor statistics from the existing Cloudflare counter. Hidden until real numbers load,
// so no placeholder figure is ever shown as a count.
export const visitorStatsSince = '2026-10-27';
export function visitorStats() {
  return `<section class="wrap section visitor-stats" id="visitor-stats" aria-labelledby="visitor-stats-title" data-visitor-stats hidden><div class="section-head"><p class="eyebrow">Site statistics · Live</p><h2 id="visitor-stats-title">Who's reading along.</h2></div><dl class="stat-tiles"><div class="stat-tile"><dt>Visitors today</dt><dd data-visitor-today>–</dd><span class="small muted">Korea time · <span data-visitor-day></span></span></div><div class="stat-tile"><dt>Total visitors</dt><dd data-visitor-total>–</dd><span class="small muted">Since 27 October 2026</span></div></dl><figure class="visit-trend" data-visitor-trend hidden><figcaption><span class="trend-title">Daily visitors · last 30 days</span><span class="small muted" data-visitor-period></span></figcaption><div class="trend-plot" data-visitor-chart></div><details class="trend-table"><summary class="small">Show as table</summary><table><thead><tr><th scope="col">Date (KST)</th><th scope="col">Visitors</th></tr></thead><tbody data-visitor-rows></tbody></table></details></figure><p class="small muted">Unique browsers per day, counted once per Korea-time day. No names, emails or trip choices are attached. <a href="/privacy-policy/">Privacy policy</a></p></section>`;
}

export function homePage(posts, card, updates = '') {
  const travelPosts = posts.filter((post) => post.category === 'travel-korea');
  return `<section class="travel-hero wrap"><div class="hero-copy"><p class="eyebrow">Independent Korea travel notes · From Seoul</p><h1>Seoul, at<br>your own <em>pace.</em></h1><p class="lead">Traveling solo, with your partner, friends or family? Find a Seoul plan around your interests, pace and spending style — with free ideas before you buy anything.</p><div class="cta"><a class="btn" href="#plan">Make my free Seoul plan <span aria-hidden="true">↗</span></a><a class="text-link" href="/custom-guide/">Ask for a custom guide →</a></div><p class="hero-note"><span aria-hidden="true">✦</span> Free personalized outline · Instant download · Optional book or custom brief</p></div><figure class="hero-photo"><img src="/images/seoul-palace.jpg" width="1440" height="960" alt="Gyeongbokgung Palace and the green mountains behind central Seoul" fetchpriority="high"><figcaption><span>SEOUL, SOUTH KOREA</span><span>Gyeongbokgung, a place to begin</span></figcaption></figure></section>
  <div class="wrap travel-promise"><span>Tell us your kind of trip</span><span>Keep your free plan instantly</span><span>Choose the help worth paying for</span></div>
  ${updates}${planner()}${bookTeaser()}${essentialsSection()}${customTeaser()}
  <section class="wrap section" id="latest"><div class="section-head split-head"><div><p class="eyebrow">Field notes</p><h2>Read before you roam.</h2></div><a class="text-link" href="/category/travel-korea/">All travel guides →</a></div><div class="grid">${travelPosts.slice(0, 3).map(card).join('')}</div></section>
  ${visitorStats()}
  <section class="wrap section quiet-section"><h2>Staying a little longer?</h2><p>Our guides for international students and newcomers are still here.</p><div class="cta"><a class="text-link" href="/category/study-in-korea/">Study in Korea →</a><a class="text-link" href="/category/living-in-korea/">Living in Korea →</a></div></section>`;
}

export function customGuidePage() {
  const fallback = mail('Custom digital Seoul guide enquiry', 'Hello Stargate Korea,\n\nI would like a quote for a custom digital travel brief.\nTrip length:\nTravel month:\nInterests:\nPace:\n\nPlease confirm the scope, fee, delivery timing and cancellation/refund terms before any order.');
  return `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Custom guide</nav><div class="custom-intro"><p class="eyebrow">Paid digital travel research · Enquiries open</p><h1>A Seoul guide<br>with <em>you</em> in mind.</h1><p class="lead">Tell us what you want to discover. Ask for a quote for an English digital brief built around your interests and pace.</p></div>
  <div class="quote-layout"><div><h2>What the brief can include</h2><ul class="scope-list"><li>A suggested sequence for 1–5 days in Seoul</li><li>Neighborhood notes and transport research links</li><li>Indoor alternatives and a practical pre-trip checklist</li><li>A clearly agreed document format and delivery date</li></ul><h2>How it works</h2><ol class="order-steps"><li><strong>Send an enquiry.</strong> Share a short outline. There is no charge to enquire.</li><li><strong>Review a written quote.</strong> Scope, fee, delivery, revisions and cancellation/refund terms must be agreed before you order.</li><li><strong>Receive your digital brief.</strong> You choose and book any travel services directly with the providers.</li></ol><p class="service-note">This is an information and writing service. It does not include booking, ticketing, transport, accommodation, guided trips or live availability checks. Sending an enquiry is not a booking or an order.</p></div>
  <div class="quote-card"><p class="eyebrow">Start a conversation</p><h2>Build your enquiry</h2><p class="small muted">No payment is taken here. Your planner choices are carried into this outline. Review the draft and send it from your own email app when ready.</p><form id="guide-enquiry">${profileField('days','Days in Seoul',defaults.days,'guide')}${profileField('party','Who is coming?',defaults.party,'guide')}${profileField('interest','Main interest',defaults.interest,'guide')}${profileField('pace','Preferred pace',defaults.pace,'guide')}${profileField('budget','Spending style',defaults.budget,'guide')}${profileField('season','Travel season',defaults.season,'guide')}<label for="guide-month">Travel month (optional)<input id="guide-month" name="month" type="month"></label><label for="guide-notes">Anything the brief should focus on? (optional)<textarea id="guide-notes" name="notes" rows="4" maxlength="1200" placeholder="A neighborhood, meal preferences, a shared interest, or a practical question."></textarea></label><p class="small muted">Include only details you want to send with the email. Please leave out identity documents and payment information.</p><button class="btn" type="submit">Prepare my enquiry →</button></form><noscript><p><a href="${esc(fallback)}">Email your trip outline</a> to request a quote.</p></noscript>
  <div id="enquiry-preview" class="enquiry-preview" hidden><h3>Your email draft</h3><textarea id="enquiry-text" aria-label="Enquiry email text" rows="12" readonly></textarea><a class="btn" id="enquiry-email" href="${esc(fallback)}" data-conversion="enquiry_email_open">Open in email app ↗</a><button class="copy-btn" type="button" id="copy-enquiry">Copy enquiry text</button><p class="small muted">Send it from your email app to <a href="mailto:ceo@stargateedu.co.kr">ceo@stargateedu.co.kr</a>. Preparing or copying this draft does not send it.</p><p id="copy-status" class="small" role="status"></p></div><p class="small">Prefer to write directly? <a href="${esc(fallback)}">Email the team</a>.</p><p class="small muted">English or Korean · <a href="/privacy-policy/">Privacy policy</a></p></div></div></section>`;
}

export const postCta = `<aside class="post-cta"><p class="eyebrow">Take the next step</p><h2>Keep a useful Seoul guide with you.</h2><p>Preview our English PDF travel book, start with a free neighborhood route, or ask about a custom digital brief.</p><div class="cta"><a class="btn" href="/books/">See the book & free sample →</a><a class="text-link" href="/#plan">Get a free route →</a></div></aside>`;
