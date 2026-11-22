// Monetization audit — measures how many published pages actually offer the paid
// products. It is the observation step of the self-improvement loop and the basis
// of the funnel-integrity test.
//
// Scope rules:
//   - every page a visitor can land on from search must lead to an offer
//   - legal and contact pages are excluded: a purchase prompt there reads as spam
//   - the /economy/ section serves a different audience (Korea policy and markets),
//     so a Seoul travel offer does not belong on those pages
//
// The audit also reads the pages the same way the money path does: where does a
// visitor stand, and can this page move them one step closer to paying?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFER_STAGE, REVENUE_ENDPOINTS, classifyLabel, stageOrder } from './revenue.mjs';

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

// The pages where money can change hands. A page that links to one of them must
// find it there, otherwise the visitor is sent nowhere.
export const ENDPOINT_LINKS = [
  { endpoint: '/books/', test: /href="\/books\// },
  { endpoint: '/custom-guide/', test: /href="\/custom-guide\// },
  { endpoint: '/book-help/', test: /href="\/book-help\// },
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
  const uniqueLabels = [...new Set(labels)].sort();

  // The money steps this page measures itself and the ones its offers can reach.
  const labelStages = {};
  let maxLabelStage = null;
  for (const label of uniqueLabels) {
    const id = classifyLabel(label);
    if (!id) continue;
    labelStages[id] = true;
    if (!maxLabelStage || stageOrder(id) > stageOrder(maxLabelStage)) maxLabelStage = id;
  }
  const offerStages = {};
  let maxOfferStage = null;
  for (const name of offers) {
    const id = OFFER_STAGE[name];
    offerStages[name] = id;
    if (!maxOfferStage || stageOrder(id) > stageOrder(maxOfferStage)) maxOfferStage = id;
  }
  const linkedEndpoints = ENDPOINT_LINKS.filter(link => link.test.test(body)).map(link => link.endpoint);

  return {
    url,
    excluded: EXCLUDED.some(pattern => pattern.test(url)),
    offers,
    hasOffer: offers.length > 0,
    labels: uniqueLabels,
    measured: uniqueLabels.length > 0,
    labelStages,
    maxLabelStage,
    offerStages,
    maxOfferStage,
    linkedEndpoints,
    // A page that offers only the free plan can never move a visitor toward money.
    revenueReady: stageOrder(maxOfferStage) >= stageOrder('consideration'),
    // A page can carry a paid offer and still measure nothing that leads to money.
    paidLabelStage: labelStages.consideration === true || labelStages.intent === true,
    bytes: html.length,
  };
}

// The end of the funnel: every page where money can change hands has to exist and
// has to measure the step it owes, otherwise the last move is invisible.
export function auditEndpoints(pages = []) {
  const byUrl = new Map(pages.map(page => [page.url, page]));
  const endpoints = [];
  const findings = [];
  for (const endpoint of REVENUE_ENDPOINTS) {
    const page = byUrl.get(endpoint.url) ?? null;
    const exists = Boolean(page);
    const hasStage = exists && page.labelStages[endpoint.stage] === true;
    endpoints.push({
      url: endpoint.url,
      stage: endpoint.stage,
      exists,
      hasStage,
      labels: page?.labels ?? [],
      maxLabelStage: page?.maxLabelStage ?? null,
    });
    if (!exists) {
      findings.push({ code: 'revenue_endpoint_missing', target: endpoint.url, stage: endpoint.stage });
    } else if (!hasStage) {
      findings.push({ code: 'revenue_endpoint_unmeasurable', target: endpoint.url, stage: endpoint.stage });
    }
  }
  return { endpoints, findings };
}

// A page that links to an end of the funnel which does not exist sends the visitor
// nowhere, and the offer it carries is worth nothing.
export function bridgeFindings(pages = []) {
  const known = new Set(pages.map(page => page.url));
  const findings = [];
  for (const page of pages) {
    if (page.excluded) continue;
    for (const endpoint of page.linkedEndpoints) {
      if (known.has(endpoint)) continue;
      findings.push({ code: 'revenue_bridge_broken', target: page.url, stage: 'consideration', detail: endpoint });
    }
  }
  return findings;
}

// A page that reaches a visitor and offers only the free plan, or offers a paid
// product without measuring anything that leads to money, cannot be improved by
// traffic alone. These are the revenue findings of the static pass.
export function revenueOfferFindings(pages = []) {
  const findings = [];
  for (const page of pages) {
    if (page.excluded) continue;
    if (!page.hasOffer) continue;
    if (!page.revenueReady) {
      findings.push({ code: 'revenue_offer_missing', target: page.url, stage: 'consideration' });
    } else if (!page.paidLabelStage) {
      findings.push({ code: 'revenue_offer_unmeasured', target: page.url, stage: 'consideration' });
    }
  }
  return findings;
}

export function auditDist(dist = DIST) {
  const empty = {
    generatedAt: new Date().toISOString(),
    pages: [],
    totals: { all: 0, inScope: 0, withOffer: 0, missingOffer: 0, unmeasured: 0, revenueReady: 0 },
    missingOffer: [],
    unmeasured: [],
    endpoints: [],
    revenueFindings: [],
  };
  if (!fs.existsSync(dist)) return empty;
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
  const { endpoints, findings: endpointFindings } = auditEndpoints(pages);
  const revenueFindings = [
    ...endpointFindings,
    ...bridgeFindings(pages),
    ...revenueOfferFindings(pages),
  ];
  return {
    generatedAt: new Date().toISOString(),
    pages,
    totals: {
      all: pages.length,
      inScope: inScope.length,
      withOffer: inScope.filter(page => page.hasOffer).length,
      missingOffer: missingOffer.length,
      unmeasured: unmeasured.length,
      revenueReady: inScope.filter(page => page.revenueReady).length,
      revenueFindings: revenueFindings.length,
    },
    missingOffer: missingOffer.map(page => page.url),
    unmeasured: unmeasured.map(page => page.url),
    endpoints,
    revenueFindings,
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
    console.log(`[audit] revenue ready: ${report.totals.revenueReady} of ${report.totals.inScope} · revenue findings ${report.totals.revenueFindings}`);
    for (const endpoint of report.endpoints) {
      console.log(`[audit] endpoint ${endpoint.url.padEnd(16)} ${endpoint.exists ? 'exists' : 'MISSING'} · ${endpoint.stage} ${endpoint.hasStage ? 'measured' : 'not measured'}`);
    }
    for (const finding of report.revenueFindings) {
      console.log(`[audit] revenue finding: ${finding.code} ${finding.target}${finding.detail ? ` (${finding.detail})` : ''}`);
    }
    console.log(summarize(report));
    if (report.missingOffer.length) console.log(`[audit] pages without an offer: ${report.missingOffer.join(', ')}`);
    if (report.unmeasured.length) console.log(`[audit] offers without a conversion label: ${report.unmeasured.join(', ')}`);
  }
}
