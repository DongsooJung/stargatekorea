// Revenue measurement.
//
// The guide measurement already holds what the revenue model needs: the page views
// and the click labels for every path. This script reads that file and applies the
// revenue stage model to it. The service is read once and the clicks are counted
// once, so a click can never be counted in two places.
//
// It writes content/data/revenue-metrics.json: paths, stages and counts only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, WINDOW_DAYS } from './measure-guides.mjs';
import { jsonText } from './text-format.mjs';
import {
  STAGES,
  stageCounts,
  revenueScore,
  topStage,
  pathVerdict,
  moneyStep,
  pathFinding,
  pathWatch,
  buildFunnel,
  sufficiency,
  MIN_VIEWS,
} from './revenue.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FILE = path.join(ROOT, 'content', 'data', 'guide-metrics.json');
const LOG_FILE = path.join(ROOT, 'content', 'data', 'revenue-metrics.json');

export const RULE = 'A page is judged by money, not by traffic. Every click is placed on the money path — read, free plan, paid offer considered, purchase intent, order — and a page is a finding when it was read often enough to trust the reading and produced no step toward money. The completed order happens in the Korean store and by email, so the last step is external and is never counted here.';

export const DATA_QUALITY = 'Every analytics read sends the Origin of this site. The service keeps one store per site, so a request without Origin answers with another Stargate site\'s data. This report reuses the views and click labels already collected for the guides, so no click is counted twice. Page views are recorded per path and clicks per path, action and destination.';

function buildPath(entry) {
  const labels = entry.labels ?? {};
  const counts = stageCounts(labels);
  const path = {
    path: entry.path,
    kind: entry.kind,
    views: Number(entry.views) || 0,
    clicks: Number(entry.clicks) || 0,
    stageClicks: counts,
    revenueScore: revenueScore(labels),
    topStage: topStage(labels),
  };
  path.verdict = pathVerdict(path);
  path.moneyStep = moneyStep(path);
  return path;
}

export async function measure(root = ROOT) {
  let source;
  try {
    source = JSON.parse(await fs.readFile(path.join(root, 'content', 'data', 'guide-metrics.json'), 'utf8'));
  } catch {
    return null;
  }
  const entries = [...(source?.guides ?? []), ...(source?.funnel ?? [])];
  if (!entries.length) return null;
  const paths = entries.map(buildPath);
  const funnel = buildFunnel(paths);
  const findings = paths.map(path => pathFinding(path)).filter(Boolean);
  const watch = paths.map(path => pathWatch(path)).filter(Boolean);
  const report = {
    updatedAt: new Date().toISOString(),
    origin: ORIGIN,
    windowDays: source?.windowDays ?? WINDOW_DAYS,
    source: 'guide-metrics',
    measuredAt: source?.updatedAt ?? null,
    rule: RULE,
    dataQuality: DATA_QUALITY,
    stages: STAGES,
    paths,
    funnel,
    findings,
    watch,
    totals: {
      paths: paths.length,
      pathsWithViews: paths.filter(path => path.views > 0).length,
      pathsWithReads: paths.filter(path => path.views >= MIN_VIEWS).length,
      clicks: funnel.clicks,
      revenueScore: funnel.revenueScore,
      activationClicks: funnel.stageClicks.activation,
      considerationClicks: funnel.stageClicks.consideration,
      revenueIntentClicks: funnel.stageClicks.intent,
      orderClicks: funnel.stageClicks.revenue,
    },
    notes: 'Views and clicks under /probe-* paths and under the labels probe_* on 2026-11-21 are diagnostic probes, not visitor activity. This site\'s store was empty before that date, so those records are the baseline.',
  };
  report.sufficiency = sufficiency(report);
  return report;
}

export async function writeReport(report) {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.writeFile(LOG_FILE, jsonText(report), 'utf8');
  return LOG_FILE;
}

export async function runMeasurement() {
  const report = await measure();
  if (!report) {
    return { ok: false, reason: 'no guide measurement to read — run npm run measure:guides first' };
  }
  await writeReport(report);
  return { ok: true, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runMeasurement();
  if (!result.ok) {
    console.log(`[measure-revenue] ${result.reason}`);
  } else {
    const { report } = result;
    const { totals } = report;
    console.log(`[measure-revenue] ${totals.paths} paths over ${report.windowDays} days · ${totals.pathsWithViews} with reads · ${totals.pathsWithReads} read ${MIN_VIEWS}+ times`);
    console.log(`[measure-revenue] money path: ${report.funnel.steps.map(step => `${step.id}=${step.clicks}`).join(' · ')}`);
    console.log(`[measure-revenue] revenue intent clicks ${totals.revenueIntentClicks} · intent score ${totals.revenueScore}`);
    console.log(`[measure-revenue] ranking basis: ${report.sufficiency.rankBasis} · provisional ${report.sufficiency.provisional ? 'yes' : 'no'} · money steps measured ${report.sufficiency.moneyStepsMeasured ? 'yes' : 'no'} — ${report.sufficiency.reason}`);
    for (const finding of report.findings) {
      console.log(`[measure-revenue] finding: ${finding.code} ${finding.target} (views ${finding.views}, impact ${finding.revenueImpact})`);
    }
    for (const item of report.watch) {
      console.log(`[measure-revenue] watch: ${item.target} (views ${item.views}) — ${item.reason}`);
    }
  }
}
