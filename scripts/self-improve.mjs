// Self-improvement pass — the recursive loop that keeps the site earning.
//
//   observe   → audit every published page for a next step and for measurement
//   diagnose  → carry unresolved findings forward from the previous iteration
//   repair    → re-insert the offer block into generated pages that lost it
//   record    → write the decision log the next iteration starts from
//
// The log lives in content/data/, which the build never publishes as a page.
// It holds page paths and counts only: no visitor data, no names, no clicks.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDist } from './monetization-audit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = path.join(ROOT, 'content', 'data', 'self-improvement.json');
const GUIDE_METRICS = path.join(ROOT, 'content', 'data', 'guide-metrics.json');
const GENERATED = [
  path.join(ROOT, 'content', 'posts'),
  path.join(ROOT, 'content', 'pages'),
];

export const OFFER_BLOCK = `

## Make this page your trip

[Build your free Seoul plan](/#plan) turns your dates, pace and interests into a route. If you want the same structure offline, the [Seoul, at your own pace PDF guide](/books/) is a fixed 24-page English edition, and a [custom digital travel brief](/custom-guide/) is quoted by email.
`;

export function needsOffer(markdown) {
  return !/\]\(\/books\//.test(markdown) || !/\]\(\/custom-guide\//.test(markdown);
}

export async function repairGeneratedPages(log = []) {
  const repaired = [];
  for (const dir of GENERATED) {
    let names = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      if (!/^seoul-week-of-\d{4}-\d{2}-\d{2}\.md$/.test(name) && !/^seoul-in-[a-z]+\.md$/.test(name)) continue;
      const file = path.join(dir, name);
      const original = await fs.readFile(file, 'utf8');
      if (!needsOffer(original)) continue;
      const eol = original.includes('\r\n') ? '\r\n' : '\n';
      const next = `${original.replace(/\s*$/, '')}${OFFER_BLOCK.replace(/\n/g, eol)}`;
      await fs.writeFile(file, next, 'utf8');
      repaired.push(path.relative(ROOT, file).replace(/\\/g, '/'));
      log.push({ code: 'generated_offer_restored', target: path.relative(ROOT, file).replace(/\\/g, '/') });
    }
  }
  return repaired;
}

// The guide measurement lives beside the log. It is written by scripts/measure-guides.mjs.
export async function loadGuideMetrics() {
  try {
    return JSON.parse(await fs.readFile(GUIDE_METRICS, 'utf8'));
  } catch {
    return null;
  }
}

// Only a guide that is read and never acted on is a finding. A guide with no reads
// yet is missing data, not a defect, so it must not push the loop into busy work.
export function guideFindings(metrics) {
  if (!metrics?.guides?.length) return [];
  return metrics.guides
    .filter((guide) => guide.verdict === 'read-not-acting')
    .map((guide) => ({ code: 'guide_read_not_acting', target: guide.path }));
}

export function mergeFindings(previous = [], current = []) {  const before = new Map(previous.map(item => [`${item.code}:${item.target}`, item]));
  const now = new Map(current.map(item => [`${item.code}:${item.target}`, item]));
  const open = [];
  const closed = [];
  for (const [key, item] of now) {
    const earlier = before.get(key);
    open.push({ ...item, firstSeen: earlier?.firstSeen ?? item.firstSeen, count: (earlier?.count ?? 0) + 1 });
  }
  for (const [key, item] of before) {
    if (!now.has(key)) closed.push({ ...item, closedAt: new Date().toISOString() });
  }
  return { open, closed };
}

export async function runSelfImprovement({ today = new Date().toISOString().slice(0, 10), dryRun = false } = {}) {
  let previous = { openFindings: [], iterations: [] };
  try {
    previous = JSON.parse(await fs.readFile(LOG_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const report = auditDist();
  const metrics = await loadGuideMetrics();
  const findings = [
    ...report.missingOffer.map(url => ({ code: 'missing_offer', target: url })),
    ...report.unmeasured.map(url => ({ code: 'unmeasured_offer', target: url })),
    ...guideFindings(metrics),
  ];
  const { open, closed } = mergeFindings(previous.openFindings ?? [], findings);

  const repaired = dryRun ? [] : await repairGeneratedPages([]);
  if (repaired.length) {
    // A repaired page is no longer a finding; re-audit after the repair.
    const after = auditDist();
    const remaining = [
      ...after.missingOffer.map(url => ({ code: 'missing_offer', target: url })),
      ...after.unmeasured.map(url => ({ code: 'unmeasured_offer', target: url })),
      ...guideFindings(metrics),
    ];
    const merged = mergeFindings(open, remaining);
    await writeLog({ ...previous, today, repaired, guideMetrics: metrics?.updatedAt ?? null, openFindings: merged.open, iterations: appendIteration(previous, today, after, merged, repaired, metrics) });
    return { report: after, open: merged.open, closed: merged.closed, repaired, iterations: (previous.iterations ?? []).length + 1 };
  }

  await writeLog({ ...previous, today, repaired, guideMetrics: metrics?.updatedAt ?? null, openFindings: open, iterations: appendIteration(previous, today, report, { open, closed }, repaired, metrics) });
  return { report, open, closed, repaired, iterations: (previous.iterations ?? []).length + 1 };
}

function appendIteration(previous, today, report, merged, repaired, metrics) {
  const iterations = previous.iterations ?? [];
  const last = iterations[iterations.length - 1];
  const iteration = {
    date: today,
    pagesInScope: report.totals?.inScope ?? 0,
    pagesWithOffer: report.totals?.withOffer ?? 0,
    pagesMissingOffer: report.totals?.missingOffer ?? 0,
    pagesUnmeasured: report.totals?.unmeasured ?? 0,
    openFindings: merged.open.length,
    repaired: repaired.length,
    guideViews: metrics?.totals?.guideViews ?? 0,
    guideClicks: metrics?.totals?.guideClicks ?? 0,
    guidesWithViews: metrics?.totals?.guidesWithViews ?? 0,
    guidesWithClicks: metrics?.totals?.guidesWithClicks ?? 0,
  };
  const streak = last && last.pagesMissingOffer === 0 && iteration.pagesMissingOffer === 0 ? (last.streak ?? 1) + 1 : 1;
  iteration.streak = streak;
  return [...iterations.slice(-29), iteration];
}

async function writeLog(payload) {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  // The rule and the data limitation are owned by this file, so an older copy in the
  // log must not win over the current wording.
  const { rule, dataQuality, ...rest } = payload;
  const ordered = {
    updatedAt: new Date().toISOString(),
    rule: 'Every page a visitor can land on must offer a next step inside the content, and that step must be measurable.',
    dataQuality: 'Every analytics read sends the Origin of this site. The service keeps one store per site, so a request without Origin answers with another Stargate site\'s data. Page views are recorded per path and clicks per path, action and destination.',
    ...rest,
  };
  await fs.writeFile(LOG_FILE, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  const result = await runSelfImprovement({ dryRun });
  console.log(`[self-improve] ${result.report.totals?.inScope ?? 0} pages in scope · ${result.report.totals?.withOffer ?? 0} with an offer · ${result.report.totals?.missingOffer ?? 0} missing · ${result.report.totals?.unmeasured ?? 0} unmeasured`);
  console.log(`[self-improve] iteration ${result.iterations} · open findings ${result.open.length} · repaired ${result.repaired.length}`);
  for (const item of result.open) console.log(`[self-improve] open: ${item.code} ${item.target} (seen ${item.count}x)`);
  for (const item of result.closed) console.log(`[self-improve] closed: ${item.code} ${item.target}`);
}
