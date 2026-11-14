import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { selectTrip } from '../static/trip-data.mjs';
import commerce from '../commerce.config.mjs';
import { essentials, resolvedEssential, essentialsSection } from '../travel.mjs';
import { book, bookPriceLabel } from '../books.mjs';
import { defaults, profileOptions, normalizeProfile, profileFromQuery, profileQuery, personalizeTrip, planAsText } from '../static/personalization.mjs';
import { conversionNames, conversionPayload } from '../static/conversions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
before(() => build());

test('all advertised trip lengths and paces produce useful routes', () => {
  for (const count of [1, 3, 5]) for (const pace of ['balanced', 'slow']) {
    const trip = selectTrip(String(count), pace);
    assert.equal(trip.days.length, count);
    assert.ok(trip.days.every((day) => day.title && day.route && day.alternative));
    if (pace === 'slow') assert.ok(trip.days.every((day) => day.route.split(' → ').length <= 2));
  }
  assert.equal(selectTrip('999', '<script>').count, 3);
  assert.equal(selectTrip('999', '<script>').pace, 'balanced');
});

test('unapproved affiliate URLs cannot replace regular resources', () => {
  const item = essentials[0];
  const original = { ...commerce.affiliateLinks[item.id] };
  try {
    commerce.affiliateLinks[item.id] = { approved: false, url: 'https://example.com/tracking' };
    assert.equal(resolvedEssential(item).url, item.url);
    assert.equal(resolvedEssential(item).affiliate, false);
    commerce.affiliateLinks[item.id] = { approved: true, url: 'https://example.com/tracking' };
    assert.equal(resolvedEssential(item).affiliate, true);
    assert.match(essentialsSection(), /rel="sponsored noopener"/);
    commerce.affiliateLinks[item.id] = { approved: true, url: 'javascript:alert(1)' };
    assert.throws(() => resolvedEssential(item), /Invalid commercial URL/);
  } finally { commerce.affiliateLinks[item.id] = original; }
});

test('every published internal link, fragment and asset resolves', () => {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
  const pages = walk(dist).filter((file) => file.endsWith('.html'));
  assert.ok(pages.length >= 20);
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `Exactly one h1: ${file}`);
    for (const match of html.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
      const url = new URL(match[1].replaceAll('&amp;', '&'), 'https://www.stargatekorea.net/');
      if (url.origin !== 'https://www.stargatekorea.net') continue;
      const target = path.join(dist, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
      assert.ok(fs.existsSync(target), `${file}: missing ${url.pathname}`);
      if (url.hash && target.endsWith('.html')) {
        const text = fs.readFileSync(target, 'utf8');
        assert.ok(text.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${file}: missing fragment ${url.href}`);
      }
    }
  }
});

test('book checkout points to the live product and explains digital delivery', () => {
  const html = fs.readFileSync(path.join(dist, 'books/index.html'), 'utf8');
  assert.match(html, /24 pages/);
  assert.match(html, /KRW 9,900/);
  assert.match(html, /cancellation\/refund terms/);
  assert.match(html, /Checkout is currently in Korean/);
  assert.match(html, /after payment is confirmed/i);
  assert.match(html, /book_checkout_open/);
  assert.ok(!html.includes('book_purchase_email'));
  const link = new URL(book.checkout);
  assert.equal(link.origin, 'https://stargateedu.imweb.me');
  assert.equal(link.pathname, '/shop_view');
  assert.equal(link.searchParams.get('idx'), '10');
  assert.ok(html.includes(`href="${book.checkout}"`));
  assert.equal(book.priceKrw, 9900);
  assert.equal(book.displayKrwPerUsd, 1400);
  assert.equal(bookPriceLabel(), 'US$7.07 / ₩9,900');
  assert.ok(html.includes('US$7.07 / ₩9,900'));
  assert.match(html, /fixed display rate of US\$1 = ₩1,400/);
  assert.equal(fs.readFileSync(path.join(dist, book.sample)).subarray(0, 5).toString('ascii'), '%PDF-');
});

test('only the sample PDF is public; the paid edition stays outside the site', () => {
  const pdfs = fs.readdirSync(path.join(dist, 'downloads')).filter((file) => file.endsWith('.pdf'));
  assert.deepEqual(pdfs, ['seoul-at-your-own-pace-sample.pdf']);
  assert.ok(!fs.existsSync(path.join(dist, 'Seoul-at-your-own-pace-v1.0.pdf')));
});

test('travel landing pages and original student URLs remain discoverable', () => {
  const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
  for (const slug of ['books', 'custom-guide', 'travel-essentials', 'seoul-starter', 'disclosure', 'korea-residence-card-arc-registration-guide', 'first-week-in-korea-international-student-checklist', 'getting-around-seoul-with-t-money', 'seoul-neighborhoods-for-international-students']) {
    assert.ok(sitemap.includes(`https://www.stargatekorea.net/${slug}/`), slug);
    assert.ok(fs.existsSync(path.join(dist, slug, 'index.html')), slug);
  }
  assert.equal(fs.readFileSync(path.join(dist, 'CNAME'), 'utf8').trim(), 'www.stargatekorea.net');
});

test('page and enquiry descriptions do not claim an automatic submission', () => {
  const html = fs.readFileSync(path.join(dist, 'custom-guide/index.html'), 'utf8');
  assert.match(html, /Preparing or copying this draft does not send it/);
  assert.match(html, /<noscript>/);
  assert.match(html, /aria-label="Enquiry email text"/);
  const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.match(home, /do not currently earn affiliate commission/);
  assert.ok(!home.includes('adsbygoogle'));
});

test('all 1,440 traveler combinations keep the requested length and a usable, non-repeating route', () => {
  let checked = 0;
  for (const days of Object.keys(profileOptions.days)) for (const pace of Object.keys(profileOptions.pace))
  for (const party of Object.keys(profileOptions.party)) for (const interest of Object.keys(profileOptions.interest))
  for (const budget of Object.keys(profileOptions.budget)) for (const season of Object.keys(profileOptions.season)) {
    const trip = personalizeTrip({ days, pace, party, interest, budget, season });
    assert.equal(trip.days.length, Number(days));
    assert.equal(new Set(trip.days.map(day => day.id)).size, Number(days));
    for (const day of trip.days) {
      assert.ok(day.detail.length > 80 && day.alternative.length > 80);
      assert.ok(new URL(day.map).searchParams.get('query').includes(day.stops[0]));
      if (party === 'family' || pace === 'slow') assert.ok(day.stops.length <= 2);
    }
    assert.ok(trip.resources.every(resource => fs.existsSync(path.join(dist, resource.href, 'index.html'))));
    checked++;
  }
  assert.equal(checked, 1440);
});

test('interests change the route, including one-day family plans; budget and season change useful advice', () => {
  for (const party of Object.keys(profileOptions.party)) {
    const firstStops = ['culture', 'food', 'design'].map(interest => personalizeTrip({ days: '1', party, interest }).days[0].id);
    assert.equal(new Set(firstStops).size, 3);
  }
  const lightWinter = personalizeTrip({ budget: 'lean', season: 'winter' });
  const specialSummer = personalizeTrip({ budget: 'flexible', season: 'summer' });
  assert.notEqual(lightWinter.why[1], specialSummer.why[1]);
  assert.notEqual(lightWinter.why[2], specialSummer.why[2]);
  assert.equal(personalizeTrip({ party: 'family' }).offer.kind, 'custom');
  assert.equal(personalizeTrip({ party: 'solo', pace: 'balanced' }).offer.kind, 'book');
});

test('shared preferences round-trip and hostile or malformed values fall back to known editorial choices', () => {
  const profile = { days: '5', pace: 'slow', party: 'family', interest: 'food', budget: 'lean', season: 'winter' };
  assert.deepEqual(profileFromQuery(profileQuery(profile)), profile);
  for (const invalid of [null, [], 'not an object', { days: '999', party: '<img src=x onerror=alert(1)>', email: 'private@example.com' }]) {
    assert.deepEqual(normalizeProfile(invalid), defaults);
  }
  const shared = profileQuery({ ...profile, email: 'private@example.com', token: 'secret' });
  assert.ok(!shared.includes('private') && !shared.includes('token'));
  const exported = planAsText(personalizeTrip(profile));
  assert.ok(exported.includes('5 days in Seoul'));
  assert.ok(exported.includes('Day 5:'));
  assert.ok(exported.includes('Save or share your settings: https://www.stargatekorea.net/?' + profileQuery(profile)));
  assert.ok(exported.includes('Free editorial outline'));
});

test('conversion events allow fixed funnel actions, strip URL preferences and cannot claim a completed purchase', () => {
  const context = { event: 'event-id', visitor: 'visitor-id', session: 'session-id', path: '/custom-guide/?email=private@example.com&party=family#plan', device: 'mobile' };
  const payload = conversionPayload('enquiry_prepared', context);
  assert.equal(payload.p_page_path, '/custom-guide/');
  assert.equal(payload.p_element_label, 'enquiry_prepared');
  assert.equal(payload.p_target_url, null);
  assert.ok(!JSON.stringify(payload).includes('private') && !JSON.stringify(payload).includes('family'));
  assert.equal(conversionPayload('private@example.com', context), null);
  assert.ok(!conversionNames.has('purchase') && !conversionNames.has('payment_completed'));
});

test('personalized landing pages, checkout fit and all six enquiry choices are published', () => {
  const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const custom = fs.readFileSync(path.join(dist, 'custom-guide/index.html'), 'utf8');
  for (const key of Object.keys(defaults)) {
    assert.ok(home.includes(`id="trip-${key}"`));
    assert.ok(custom.includes(`id="guide-${key}"`));
  }
  for (const slug of ['seoul-family-trip-plan', 'seoul-food-neighborhood-plan', 'seoul-culture-at-your-pace', 'seoul-design-neighborhood-plan']) {
    assert.ok(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8').includes(`/${slug}/`));
    assert.ok(fs.existsSync(path.join(dist, slug, 'index.html')));
  }
  assert.ok(home.indexOf('id="route-list"') < home.indexOf('id="matched-offer"'));
  assert.match(home, /id="download-plan"/);
  assert.match(home, /id="share-plan"/);
  assert.match(fs.readFileSync(path.join(dist, 'books/index.html'), 'utf8'), /id="book-fit" hidden/);
});

test('visitor statistics are published on the home page and footer, hidden until real counts load', () => {
  const home = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.match(home, /<section[^>]*id="visitor-stats"[^>]*data-visitor-stats hidden/);
  assert.match(home, /data-visitor-today>–</);
  assert.match(home, /data-visitor-total>–</);
  assert.match(home, /id="visitor-summary" class="visits" hidden/);
  assert.match(home, /\/visitor-counter\.js\?v=/);
  const counter = fs.readFileSync(path.join(root, 'static', 'visitor-counter.js'), 'utf8');
  assert.match(counter, /allowedHosts = \['www\.stargatekorea\.net'\]/);
  assert.match(counter, /box\.hidden = true/);
});
