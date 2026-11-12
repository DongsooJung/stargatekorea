import commerce from './commerce.config.mjs';
import { selectTrip } from './static/trip-data.mjs';
import { bookTeaser } from './books.mjs';

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
  return trip.days.map((day) => `<li class="route-day"><span class="day-number">${String(day.number).padStart(2, '0')}</span><div><p class="route-area">${esc(day.area)}</p><h3>${esc(day.title)}</h3><p class="route-stops">${esc(day.route)}</p><p>${esc(day.detail)}</p><details><summary>Weather & planning note</summary><p>${esc(day.alternative)}</p></details></div></li>`).join('');
}

export function planner() {
  return `<section class="wrap section planner-section" id="plan" aria-labelledby="plan-title">
  <div class="section-head split-head"><div><p class="eyebrow">01 / Make it your kind of trip</p><h2 id="plan-title">A good first plan.<br>A little room to wander.</h2></div><p class="lead">Start with a free Seoul route, grouped by neighborhood. Choose your time and pace.</p></div>
  <form class="planner-controls" id="trip-planner"><label for="trip-days">Time in Seoul<select id="trip-days" name="days"><option value="1">1 day · a first taste</option><option value="3" selected>3 days · the city essentials</option><option value="5">5 days · a slower discovery</option></select></label><label for="trip-pace">Your pace<select id="trip-pace" name="pace"><option value="balanced">Balanced · sights & downtime</option><option value="slow">Slow · fewer stops</option></select></label><button class="btn" type="submit">Show my route <span aria-hidden="true">→</span></button></form>
  <div class="plan-result" id="plan-result" aria-live="polite" aria-atomic="false"><p class="plan-caption" id="plan-caption">3 days in Seoul · A mix of sights and downtime</p><ol class="route-list" id="route-list">${renderDays(selectTrip())}</ol></div>
  <p class="small muted">An editorial starting point, not a live route or reservation. Check opening days, access and weather with the venues. <a href="/seoul-starter/">Read the complete starter guide</a>.</p>
  <div class="planner-next"><a class="text-link" href="/downloads/seoul-first-trip-checklist.md" download data-conversion="checklist_download">Download the free arrival checklist ↓</a><a class="text-link" id="personalize-link" href="/custom-guide/?days=3&amp;pace=balanced">Want a guide built around you? →</a></div>
  <noscript><p>The 3-day route is shown above. For other lengths, <a href="/seoul-starter/">read the complete starter guide</a> or <a href="/custom-guide/">email a custom guide enquiry</a>.</p></noscript>
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

export function homePage(posts, card) {
  const travelPosts = posts.filter((post) => post.category === 'travel-korea');
  return `<section class="travel-hero wrap"><div class="hero-copy"><p class="eyebrow">Independent Korea travel notes · From Seoul</p><h1>Seoul, at<br>your own <em>pace.</em></h1><p class="lead">Palace mornings. Neighborhood afternoons. A Korea trip with less guesswork and more of what you came for.</p><div class="cta"><a class="btn" href="#plan">Find my Seoul route <span aria-hidden="true">↗</span></a><a class="text-link" href="/custom-guide/">Ask for a custom guide →</a></div><p class="hero-note"><span aria-hidden="true">✦</span> Free routes to start. Thoughtful guidance when you need more.</p></div><figure class="hero-photo"><img src="/images/seoul-palace.jpg" width="1440" height="960" alt="Gyeongbokgung Palace and the green mountains behind central Seoul" fetchpriority="high"><figcaption><span>SEOUL, SOUTH KOREA</span><span>Gyeongbokgung, a place to begin</span></figcaption></figure></section>
  <div class="wrap travel-promise"><span>Start with a useful free plan</span><span>Compare before you book</span><span>Go deeper with a custom guide</span></div>
  ${planner()}${bookTeaser()}${essentialsSection()}${customTeaser()}
  <section class="wrap section" id="latest"><div class="section-head split-head"><div><p class="eyebrow">Field notes</p><h2>Read before you roam.</h2></div><a class="text-link" href="/category/travel-korea/">All travel guides →</a></div><div class="grid">${travelPosts.slice(0, 3).map(card).join('')}</div></section>
  <section class="wrap section quiet-section"><h2>Staying a little longer?</h2><p>Our guides for international students and newcomers are still here.</p><div class="cta"><a class="text-link" href="/category/study-in-korea/">Study in Korea →</a><a class="text-link" href="/category/living-in-korea/">Living in Korea →</a></div></section>`;
}

export function customGuidePage() {
  const fallback = mail('Custom digital Seoul guide enquiry', 'Hello Stargate Korea,\n\nI would like a quote for a custom digital travel brief.\nTrip length:\nTravel month:\nInterests:\nPace:\n\nPlease confirm the scope, fee, delivery timing and cancellation/refund terms before any order.');
  return `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Custom guide</nav><div class="custom-intro"><p class="eyebrow">Paid digital travel research · Enquiries open</p><h1>A Seoul guide<br>with <em>you</em> in mind.</h1><p class="lead">Tell us what you want to discover. Ask for a quote for an English digital brief built around your interests and pace.</p></div>
  <div class="quote-layout"><div><h2>What the brief can include</h2><ul class="scope-list"><li>A suggested sequence for 1–5 days in Seoul</li><li>Neighborhood notes and transport research links</li><li>Indoor alternatives and a practical pre-trip checklist</li><li>A clearly agreed document format and delivery date</li></ul><h2>How it works</h2><ol class="order-steps"><li><strong>Send an enquiry.</strong> Share a short outline. There is no charge to enquire.</li><li><strong>Review a written quote.</strong> Scope, fee, delivery, revisions and cancellation/refund terms must be agreed before you order.</li><li><strong>Receive your digital brief.</strong> You choose and book any travel services directly with the providers.</li></ol><p class="service-note">This is an information and writing service. It does not include booking, ticketing, transport, accommodation, guided trips or live availability checks. Sending an enquiry is not a booking or an order.</p></div>
  <div class="quote-card"><p class="eyebrow">Start a conversation</p><h2>Build your enquiry</h2><p class="small muted">No payment is taken here. Your selections stay in this page until you choose to email them.</p><form id="guide-enquiry"><label for="guide-days">Days in Seoul<select id="guide-days" name="days"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="5">5 days</option></select></label><label for="guide-pace">Preferred pace<select id="guide-pace" name="pace"><option value="balanced">Balanced</option><option value="slow">Slow</option></select></label><label for="guide-month">Travel month (optional)<input id="guide-month" name="month" type="month"></label><label for="guide-interests">Main interest<select id="guide-interests" name="interests"><option>First visit essentials</option><option>Culture & history</option><option>Food & neighborhoods</option><option>Shops & design</option><option>A slower family trip</option></select></label><button class="btn" type="submit">Prepare my enquiry →</button></form><noscript><p><a href="${esc(fallback)}">Email your trip outline</a> to request a quote.</p></noscript>
  <div id="enquiry-preview" class="enquiry-preview" hidden><h3>Your email draft</h3><textarea id="enquiry-text" aria-label="Enquiry email text" rows="12" readonly></textarea><a class="btn" id="enquiry-email" href="${esc(fallback)}" data-conversion="enquiry_email_open">Open in email app ↗</a><button class="copy-btn" type="button" id="copy-enquiry">Copy enquiry text</button><p class="small muted">Send it from your email app to <a href="mailto:ceo@stargateedu.co.kr">ceo@stargateedu.co.kr</a>. Preparing or copying this draft does not send it.</p><p id="copy-status" class="small" role="status"></p></div><p class="small">Prefer to write directly? <a href="${esc(fallback)}">Email the team</a>.</p><p class="small muted">English or Korean · <a href="/privacy-policy/">Privacy policy</a></p></div></div></section>`;
}

export const postCta = `<aside class="post-cta"><p class="eyebrow">Take the next step</p><h2>Keep a useful Seoul guide with you.</h2><p>Preview our English PDF travel book, start with a free neighborhood route, or ask about a custom digital brief.</p><div class="cta"><a class="btn" href="/books/">See the book & free sample →</a><a class="text-link" href="/#plan">Get a free route →</a></div></aside>`;
