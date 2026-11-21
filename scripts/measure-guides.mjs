// Measure the evergreen guides against the live analytics service.
//
// The service keeps one store per site and picks the store from the Origin header.
// A request without Origin answers with another Stargate site's data, so every call
// here sends the Origin of this site and nothing else is read.
//
// Output: content/data/guide-metrics.json — paths and counts only, no visitor data.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import site from '../site.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_FILE = path.join(ROOT, 'content', 'data', 'guide-metrics.json');
const ENDPOINT = 'https://stargate.stargate8225.workers.dev/api/analytics';
export const ORIGIN = 'https://www.stargatekorea.net';
export const WINDOW_DAYS = 30;

// A guide is only a merge candidate when it is read and never acted on.
export const MERGE_MIN_VIEWS = 10;

export const FUNNEL_PATHS = [
  '/',
  '/seoul-weekly/',
  '/seoul-starter/',
  '/category/travel-korea/',
  '/travel-essentials/',
  '/books/',
  '/custom-guide/',
];

export function monthPaths(months = site.months) {
  return months.map((month) => `/seoul-in-${month.key}/`);
}

export async function weekPaths(root = ROOT) {
  const dir = path.join(root, 'content', 'posts');
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => /^seoul-week-of-\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map((name) => `/${name.replace(/\.md$/, '')}/`)
    .sort();
}

export async function call(method, payload) {
  const response = await fetch(`${ENDPOINT}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`${method}_${response.status}`);
  return response.json();
}

// Views come from the shared summary, so one call covers every path.
async function pageViews() {
  const summary = await call('get_site_usage_summary', { p_days: WINDOW_DAYS });
  const views = new Map();
  for (const row of summary.pages ?? []) views.set(row.page_path, Number(row.page_views) || 0);
  return views;
}

async function clickLabels(pathname) {
  const rows = await call('get_site_button_click_counts', { p_page_path: pathname });
  const labels = {};
  let clicks = 0;
  for (const row of rows ?? []) {
    const label = row.element_label || '(unnamed button)';
    labels[label] = (labels[label] ?? 0) + (Number(row.clicks) || 0);
    clicks += Number(row.clicks) || 0;
  }
  return { clicks, labels };
}

export function verdict(views, clicks) {
  if (!views && !clicks) return 'no-data';
  if (views && !clicks) return 'read-not-acting';
  if (!views && clicks) return 'acting';
  return 'working';
}

// Merging is allowed only with evidence: enough reads and no action at all.
export function mergeCandidate(guide) {
  if (guide.views >= MERGE_MIN_VIEWS && guide.clicks === 0) return guide.path;
  return null;
}

export function actionFor(guide) {
  if (guide.verdict === 'read-not-acting') return 'strengthen-offer';
  if (guide.verdict === 'no-data') return 'collect-data';
  return 'keep-separate';
}

async function measurePath(pathname, kind, views) {
  const { clicks, labels } = await clickLabels(pathname);
  const viewCount = views.get(pathname) ?? 0;
  const guide = { path: pathname, kind, views: viewCount, clicks, labels };
  guide.verdict = verdict(viewCount, clicks);
  guide.action = actionFor(guide);
  guide.mergeCandidate = mergeCandidate(guide);
  return guide;
}

export async function measure() {
  const views = await pageViews();
  const months = monthPaths();
  const weeks = await weekPaths();
  const guides = [];
  for (const pathname of months) guides.push(await measurePath(pathname, 'month', views));
  for (const pathname of weeks) guides.push(await measurePath(pathname, 'week', views));
  const funnel = [];
  for (const pathname of FUNNEL_PATHS) funnel.push(await measurePath(pathname, 'funnel', views));
  return {
    updatedAt: new Date().toISOString(),
    origin: ORIGIN,
    windowDays: WINDOW_DAYS,
    source: 'cloudflare',
    rule: 'Only paths that belong to this site are used. A guide is merged into another guide only when it was read at least ' + MERGE_MIN_VIEWS + ' times in the window and never acted on.',
    guides,
    funnel,
    totals: {
      guides: guides.length,
      guideViews: guides.reduce((sum, guide) => sum + guide.views, 0),
      guideClicks: guides.reduce((sum, guide) => sum + guide.clicks, 0),
      guidesWithViews: guides.filter((guide) => guide.views > 0).length,
      guidesWithClicks: guides.filter((guide) => guide.clicks > 0).length,
    },
  };
}

export async function writeReport(report) {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.writeFile(LOG_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return LOG_FILE;
}

export async function runMeasurement() {
  try {
    const report = await measure();
    await writeReport(report);
    return { ok: true, report };
  } catch (error) {
    const report = {
      updatedAt: new Date().toISOString(),
      origin: ORIGIN,
      windowDays: WINDOW_DAYS,
      error: String(error?.message ?? error),
      note: 'The measurement service could not be reached. No numbers are reported and nothing was changed.',
      guides: [],
      funnel: [],
      totals: { guides: 0, guideViews: 0, guideClicks: 0, guidesWithViews: 0, guidesWithClicks: 0 },
    };
    await writeReport(report);
    return { ok: false, report, error };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runMeasurement();
  const { report } = result;
  if (!result.ok) {
    console.log(`[measure-guides] the analytics service could not be read: ${report.error}`);
  } else {
    const { totals } = report;
    console.log(`[measure-guides] ${totals.guides} guides over ${report.windowDays} days · ${totals.guideViews} views · ${totals.guideClicks} clicks · ${totals.guidesWithViews} guides with views · ${totals.guidesWithClicks} with clicks`);
    for (const guide of report.guides) {
      console.log(`[measure-guides] ${guide.path.padEnd(30)} views=${String(guide.views).padEnd(4)} clicks=${String(guide.clicks).padEnd(4)} ${guide.verdict} → ${guide.action}`);
    }
    for (const guide of report.funnel) {
      console.log(`[measure-guides] ${guide.path.padEnd(30)} views=${String(guide.views).padEnd(4)} clicks=${String(guide.clicks).padEnd(4)} ${guide.verdict}`);
    }
  }
}
