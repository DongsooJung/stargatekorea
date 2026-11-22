// Choose the evergreen guides whose offer has to be strengthened.
//
// A guide qualifies when it was read often enough to trust the reading and never
// produced a step toward money: several views and no click that reached a paid
// offer. A click that only led to another guide is not a result, so it does not
// save the page. A guide with one or two views is missing data, not a problem,
// and must not send the loop into rewriting editorial content on a single visit.
//
// The list comes from content/data/guide-metrics.json, written by measure-guides.
// What the agent still has to do is the editorial work itself, so this script
// decides, it does not rewrite.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageCounts } from './revenue.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METRICS_FILE = path.join(ROOT, 'content', 'data', 'guide-metrics.json');

// Several reads and no step toward money. One visitor is not evidence.
export const MIN_VIEWS = 3;

export const MARKER = 'guide-offer-strengthened';

export function markerFor(date) {
  return `<!-- ${MARKER}: ${date} -->`;
}

export function isStrengthened(markdown) {
  return markdown.includes(MARKER);
}

// The money rule: the guide has to be read often enough, and nothing it collected
// may have reached a paid offer or a purchase intent.
export function qualifies(guide, minViews = MIN_VIEWS) {
  if (!guide) return false;
  const views = Number(guide.views) || 0;
  if (views < minViews) return false;
  const counts = guide.stageClicks ?? (guide.labels ? stageCounts(guide.labels) : null);
  if (counts) return !(counts.consideration > 0 || counts.intent > 0);
  return (Number(guide.clicks) || 0) === 0;
}

export function guideFile(guidePath) {
  const name = guidePath.replace(/^\//, '').replace(/\/$/, '');
  return path.join(ROOT, 'content', 'pages', `${name}.md`);
}

export async function loadMetrics(root = ROOT) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'content', 'data', 'guide-metrics.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Returns the guides to strengthen. A guide that already carries the marker is
// left out, so the same page is never rewritten twice.
export async function selectGuides({ root = ROOT, minViews = MIN_VIEWS, metrics = null } = {}) {
  const report = metrics ?? (await loadMetrics(root));
  if (!report?.guides?.length) return { candidates: [], done: [], reason: 'no measurement' };
  const candidates = [];
  const done = [];
  for (const guide of report.guides) {
    if (!qualifies(guide, minViews)) continue;
    const file = path.join(root, 'content', 'pages', `${guide.path.replace(/^\//, '').replace(/\/$/, '')}.md`);
    let markdown = '';
    try {
      markdown = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    if (isStrengthened(markdown)) {
      done.push({ ...guide, file });
      continue;
    }
    candidates.push({ ...guide, file });
  }
  return { candidates, done, reason: null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.find((value) => value.startsWith('--min-views='));
  const minViews = arg ? Number(arg.split('=')[1]) : MIN_VIEWS;
  const { candidates, done, reason } = await selectGuides({ minViews });
  if (reason) {
    console.log(`[strengthen-guides] ${reason}: no guide can be judged yet`);
  } else {
    console.log(`[strengthen-guides] ${candidates.length} guides to strengthen (min ${minViews} views, no clicks) · ${done.length} already strengthened`);
    for (const guide of candidates) {
      console.log(`[strengthen-guides] to strengthen: ${guide.path} views=${guide.views} clicks=${guide.clicks}`);
    }
    for (const guide of done) {
      console.log(`[strengthen-guides] already done   : ${guide.path} views=${guide.views} clicks=${guide.clicks}`);
    }
  }
}
