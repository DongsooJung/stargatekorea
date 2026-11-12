import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { selectTrip } from '../static/trip-data.mjs';
import commerce from '../commerce.config.mjs';
import { essentials, resolvedEssential, essentialsSection } from '../travel.mjs';
import { book } from '../books.mjs';

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
