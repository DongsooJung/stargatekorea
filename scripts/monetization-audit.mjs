// Monetization audit — measures how many published pages actually offer the paid
// products. It is the observation step of the self-improvement loop and the basis
// of the funnel-integrity test.
//
// Scope rules:
//   - every page a visitor can land on from search must lead to an offer
//   - legal and contact pages are excluded: a purchase prompt there reads as spam
//   - the /economy/ section serves a different audience (Korea policy and markets),
//     so a Seoul travel offer does not belong on those pages
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

export const EXCLUDED = [
  /^\/404\.html$/,
  /^\/privacy-policy\/$/,
  /^\/disclosure\/$/,
  /^\/contact\/$/,
  /^\/about\/$/,
  /^\/economy\//,
  // The custom guide page is the offer itself: it carries the enquiry form.
  /^\/custom-guide\/$/,
  // Campus Trips is a separate small-group product with its own registration route.
  /^\/campus-trips\/$/,
];

export const OFFERS = [
  { name: 'paid_pdf', test: /href="\/books\// },
  { name: 'custom_brief', test: /href="\/custom-guide\// },
  { name: 'free_plan', test: /href="(\/#plan|"\/#plan")/ },
];

export function pagePath(rel) {
  const clean = rel.replace(/\\/g, '/');
  if (clean === 'index.html') return '/';
  if (clean.endsWith('/index.html')) return `/${clean.slice(0, -'index.html'.length)}`;
  return `/${clean}`;
}

// The navigation and the footer carry the offer on every page, so they prove
// nothing. Only links inside the main content count as a real next step.
export function mainContent(html) {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1] : html;
}

export function auditHtml(html, rel) {
  const url = pagePath(rel);
  const body = mainContent(html);
  const offers = OFFERS.filter(offer => offer.test.test(body)).map(offer => offer.name);
  const labels = [...body.matchAll(/data-conversion="([a-z_]+)"/g)].map(match => match[1]);
  return {
    url,
    excluded: EXCLUDED.some(pattern => pattern.test(url)),
    offers,
    hasOffer: offers.length > 0,
    labels: [...new Set(labels)].sort(),
    measured: labels.length > 0,
    bytes: html.length,
  };
}

export function auditDist(dist = DIST) {
  if (!fs.existsSync(dist)) return { pages: [], generatedAt: null };
  const pages = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const rel = path.relative(dist, full).replace(/\\/g, '/');
        pages.push(auditHtml(fs.readFileSync(full, 'utf8'), rel));
      }
    }
  };
  walk(dist);
  pages.sort((a, b) => a.url.localeCompare(b.url));
  const inScope = pages.filter(page => !page.excluded);
  const missingOffer = inScope.filter(page => !page.hasOffer);
  const unmeasured = inScope.filter(page => page.hasOffer && !page.measured);
  return {
    generatedAt: new Date().toISOString(),
    pages,
    totals: {
      all: pages.length,
      inScope: inScope.length,
      withOffer: inScope.filter(page => page.hasOffer).length,
      missingOffer: missingOffer.length,
      unmeasured: unmeasured.length,
    },
    missingOffer: missingOffer.map(page => page.url),
    unmeasured: unmeasured.map(page => page.url),
  };
}

export function summarize(report) {
  const lines = [];
  for (const page of report.pages) {
    if (page.excluded) continue;
    const offers = page.hasOffer ? page.offers.join('+') : 'NO-OFFER';
    const measured = page.measured ? 'measured' : 'unmeasured';
    lines.push(`${page.url.padEnd(42)} ${offers.padEnd(28)} ${measured}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditDist();
  if (!report.pages.length) {
    console.log('[audit] no dist/ found — run the build first');
  } else {
    console.log(`[audit] ${report.totals.inScope} pages in scope · ${report.totals.withOffer} offer a next step · ${report.totals.missingOffer} without an offer · ${report.totals.unmeasured} without measurement`);
    console.log(summarize(report));
    if (report.missingOffer.length) console.log(`[audit] pages without an offer: ${report.missingOffer.join(', ')}`);
    if (report.unmeasured.length) console.log(`[audit] offers without a conversion label: ${report.unmeasured.join(', ')}`);
  }
}
