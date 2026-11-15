// Content factory — the daily update engine for www.stargatekorea.net.
//
// It turns the official Visit Seoul listing into dated, indexable pages:
//   1. a weekly roundup post per week (current week, plus the weeks that already have listings)
//   2. a refreshed event block inside each monthly guide page
//   3. a weekly archive index that links every roundup
//
// Rules that keep the output safe to publish automatically:
//   - every fact comes from the official listing snapshot; nothing is invented
//   - external titles are escaped before they enter markdown
//   - output is deterministic: running twice on the same data changes nothing
//   - a file is only written when its content actually changes
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { koreaDay, validDay } from '../static/update-state.mjs';
import site from '../site.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;

export const MONTHS = site.months;

// --- calendar helpers ------------------------------------------------------

export function addDays(day, count) {
  if (!validDay(day)) throw new Error(`Invalid day: ${day}`);
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
}

// Monday of the week that contains the given Korea-time day.
export function weekStartOf(day) {
  if (!validDay(day)) throw new Error(`Invalid day: ${day}`);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function monthKeyOf(day) {
  return day.slice(0, 7);
}

export function monthInfo(key) {
  const month = Number(key.split('-')[1]);
  const found = MONTHS[month - 1];
  if (!found) throw new Error(`Invalid month key: ${key}`);
  return found;
}

export function monthBounds(key) {
  const [year, month] = key.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new Error(`Invalid month key: ${key}`);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${key}-01`, end: `${key}-${String(lastDay).padStart(2, '0')}` };
}

const parseDay = day => new Date(`${day}T00:00:00Z`);

export function longDay(day) {
  return parseDay(day).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

export function rangeLabel(start, end) {
  const a = parseDay(start);
  const b = parseDay(end);
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
  const monthA = a.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' });
  const monthB = b.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' });
  if (sameMonth) return `${monthA} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  if (sameYear) return `${monthA} ${a.getUTCDate()} – ${monthB} ${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  return `${monthA} ${a.getUTCDate()}, ${a.getUTCFullYear()} – ${monthB} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
}

export function eventRangeLabel(start, end) {
  if (start === end) return longDay(start);
  const a = parseDay(start);
  const b = parseDay(end);
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    const shortA = a.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
    const shortB = b.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
    return `${shortA} – ${shortB}, ${a.getUTCFullYear()}`;
  }
  return `${longDay(start)} – ${longDay(end)}`;
}

// External titles are plain text. Escape the characters that would break a markdown link
// or turn into raw HTML inside the published page.
export function mdText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/([\\[\]*_`])/g, '\\$1')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// --- listing selection -----------------------------------------------------

export function eventsForRange(events, start, end) {
  return (Array.isArray(events) ? events : [])
    .filter(item => item && validDay(item.startDate) && validDay(item.endDate) && item.startDate <= end && item.endDate >= start)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || String(a.title).localeCompare(String(b.title)))
    .slice(0, 12);
}

// --- markdown helpers ------------------------------------------------------

export function replaceMarker(content, name, inner) {
  const start = `<!-- factory:${name} -->`;
  const end = `<!-- /factory:${name} -->`;
  const from = content.indexOf(start);
  const to = content.indexOf(end);
  if (from === -1 || to === -1 || to < from) return null;
  return `${content.slice(0, from + start.length)}\n${inner.trim()}\n${content.slice(to)}`;
}

export function setUpdated(content, today) {
  const stamp = JSON.stringify(`${today}T09:00:00+09:00`);
  if (/^updated:.*$/m.test(content)) return content.replace(/^updated:.*$/m, `updated: ${stamp}`);
  const lines = content.split('\n');
  if (lines[0] === '---') {
    lines.splice(1, 0, `updated: ${stamp}`);
    return lines.join('\n');
  }
  return content;
}

export function extractDateLine(content) {
  return content.match(/^date:.*$/m)?.[0] ?? null;
}

// Markdown in this repository uses CRLF line endings. Comparisons always run on
// normalised text so a rewrite never depends on how the file was stored.
const toEol = (text, eol) => text.replace(/\r\n/g, '\n').replace(/\n/g, eol);
const withoutUpdated = content => toEol(content, '\n').replace(/^updated:.*\n?/m, '').replace(/\n{3,}/g, '\n\n').trimEnd();

// --- weekly roundup ---------------------------------------------------------

export function weeklyPostFile({ weekStart, events, today, dateLine = null }) {
  const weekEnd = addDays(weekStart, 6);
  const slug = `seoul-week-of-${weekStart}`;
  const label = rangeLabel(weekStart, weekEnd);
  const isCurrent = weekStart <= today && today <= weekEnd;
  const isPast = today > weekEnd;
  const title = isCurrent || isPast ? `This Week in Seoul: ${label}` : `Seoul Week of ${label}`;
  const excerpt = `Official Visit Seoul listings for ${label}, with dates, links and a simple way to fit them into a short trip.`;
  const list = eventsForRange(events, weekStart, weekEnd);

  const intro = isPast
    ? `This roundup covered **${label}**. The week has passed, so treat the dates as a record and check the official calendar for anything current.`
    : isCurrent
      ? `Every week we check the official Visit Seoul listing and turn it into a dated plan you can use. This one covers **${label}**.`
      : `The official listing already includes the weeks ahead, so we publish this early. This roundup covers **${label}**, and we update it when the organizer changes details.`;

  const listing = list.length
    ? list.map(item => `- **[${mdText(item.title)}](${item.url})** — ${eventRangeLabel(item.startDate, item.endDate)}`).join('\n')
    : 'No official event listing is published for these dates in our source yet. The [official Seoul event calendar](https://english.visitseoul.net/events) is where to check, and this page is updated when listings appear.';

  const body = `${intro}

Dates, hours and admission can change, so every entry below links to the organizer's own page. Confirm before you travel.

## Official listings for ${isCurrent || isPast ? 'this week' : 'the week'}

${listing}

## How to fit them into a short trip

- **One full day** — start in Jongno with the palace, Insadong and Ikseon-dong, then leave the rest of the day open. The [first-trip starter guide](/seoul-starter/) sets out the route.
- **A half day** — pair one indoor stop with one market or neighborhood walk. The [rain and weather plan](/seoul-rain-and-weather-plan/) has the indoor versions.
- **An evening** — keep it light: a market, a riverside walk and an early dinner. The [food neighborhood plan](/seoul-food-neighborhood-plan/) has ideas by area.

## Before you set out

- [The official Seoul event calendar](https://english.visitseoul.net/events) — the source behind every listing above.
- [Airport rail options](https://www.airport.kr/ap_en/1511/subview.do) — match the train to your arrival time and terminal.
- [T-money and getting around](/getting-around-seoul-with-t-money/) — one card for the subway, buses and many taxis.
- [Choose your base before the room](/where-to-stay-first-seoul-trip/) — pick the area first, then the hotel.

## Make this week your trip

[Build your free Seoul plan](/#plan) turns your dates, pace and interests into a route. If you want the same structure offline, the [Seoul, at your own pace PDF guide](/books/) is a fixed 24-page English edition, and a [custom digital travel brief](/custom-guide/) is quoted by email.

*This page is one of our [weekly Seoul roundups](/seoul-weekly/). Each one is generated from the official listing and refreshed on a schedule.*`;

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `slug: ${JSON.stringify(slug)}`,
    dateLine || `date: ${today}T09:00:00+09:00`,
    'category: travel-korea',
    'tags: [seoul, events, weekly]',
    `excerpt: ${JSON.stringify(excerpt)}`,
    'generated: weekly',
    `weekStart: ${JSON.stringify(weekStart)}`,
    `weekEnd: ${JSON.stringify(weekEnd)}`,
    `expires: ${JSON.stringify(weekEnd)}`,
    `eventCount: ${list.length}`,
    '---',
    '',
  ].join('\n');

  return `${frontmatter}${body}\n`;
}

// --- monthly guide block ----------------------------------------------------

export function monthEventsBlock(events, key) {
  const { start, end } = monthBounds(key);
  const { label } = monthInfo(key);
  const list = eventsForRange(events, start, end);
  if (!list.length) {
    return `Official listings for **${label}** are not published in our source yet. They appear here as soon as the [official Seoul event calendar](https://english.visitseoul.net/events) publishes them.`;
  }
  const items = list.map(item => `- **[${mdText(item.title)}](${item.url})** — ${eventRangeLabel(item.startDate, item.endDate)}`).join('\n');
  return `### Official listings in ${label}\n\n${items}\n\nOfficial listings only. Confirm hours, admission and any booking with the organizer.`;
}

export function refreshMonthPage(content, inner, today) {
  const normalised = toEol(content, '\n');
  const replaced = replaceMarker(normalised, 'month-events', inner);
  if (replaced === null) return null;
  if (withoutUpdated(replaced) === withoutUpdated(normalised)) return null;
  return setUpdated(replaced, today);
}

// --- weekly archive ---------------------------------------------------------

export function weeklyArchiveBlock(entries, today) {
  if (!entries.length) return 'The first checked week is published by the factory shortly after this page goes live.';
  const items = entries.map(entry => {
    const count = Number(entry.eventCount) || 0;
    const state = entry.weekEnd < today ? ' · past week' : '';
    return `- [${rangeLabel(entry.weekStart, entry.weekEnd)}](/${entry.slug}/) — ${count} official listing${count === 1 ? '' : 's'}${state}`;
  }).join('\n');
  return `### Latest roundups\n\n${items}`;
}

export async function readWeeklyEntries(postsDir) {
  const files = (await fs.readdir(postsDir)).filter(name => /^seoul-week-of-\d{4}-\d{2}-\d{2}\.md$/.test(name)).sort().reverse();
  const entries = [];
  for (const name of files) {
    const raw = await fs.readFile(path.join(postsDir, name), 'utf8');
    const { data } = matter(raw);
    if (!data.slug || !validDay(data.weekStart) || !validDay(data.weekEnd)) continue;
    entries.push({ slug: data.slug, weekStart: data.weekStart, weekEnd: data.weekEnd, eventCount: data.eventCount ?? 0 });
  }
  return entries;
}

// --- the factory run --------------------------------------------------------

async function readIfExists(file) {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Markdown files in this repository use CRLF, so generated pages follow the same rule.
async function writeMarkdown(file, text) {
  await fs.writeFile(file, toEol(text, '\r\n'), 'utf8');
}

export async function runFactory({ root = ROOT, snapshot, today = koreaDay(), dryRun = false } = {}) {
  const postsDir = path.join(root, 'content', 'posts');
  const pagesDir = path.join(root, 'content', 'pages');
  const events = snapshot?.events ?? [];
  const changed = [];
  const skipped = [];

  const currentStart = weekStartOf(today);
  const weekStarts = [currentStart, addDays(currentStart, 7), addDays(currentStart, 14)];
  for (const weekStart of weekStarts) {
    const weekEnd = addDays(weekStart, 6);
    const listed = eventsForRange(events, weekStart, weekEnd).length > 0;
    if (weekStart !== currentStart && !listed) {
      skipped.push(`seoul-week-of-${weekStart}.md`);
      continue;
    }
    const file = path.join(postsDir, `seoul-week-of-${weekStart}.md`);
    const existing = await readIfExists(file);
    const dateLine = existing ? extractDateLine(existing) : null;
    const desired = weeklyPostFile({ weekStart, events, today, dateLine });
    if (existing && withoutUpdated(existing) === withoutUpdated(desired)) continue;
    if (!dryRun) await writeMarkdown(file, setUpdated(desired, today));
    changed.push({ file: path.relative(root, file).replace(/\\/g, '/'), action: existing ? 'updated' : 'created' });
  }

  const monthKeys = [...new Set([monthKeyOf(today), monthKeyOf(addDays(today, 40))])];
  for (const key of monthKeys) {
    const { key: slug } = monthInfo(key);
    const file = path.join(pagesDir, `seoul-in-${slug}.md`);
    const existing = await readIfExists(file);
    if (!existing) {
      skipped.push(path.relative(root, file).replace(/\\/g, '/'));
      continue;
    }
    const next = refreshMonthPage(existing, monthEventsBlock(events, key), today);
    if (!next) continue;
    if (!dryRun) await writeMarkdown(file, next);
    changed.push({ file: path.relative(root, file).replace(/\\/g, '/'), action: 'updated' });
  }

  const archiveFile = path.join(pagesDir, 'seoul-weekly.md');
  const archive = await readIfExists(archiveFile);
  if (archive) {
    const entries = await readWeeklyEntries(postsDir);
    const next = replaceMarker(archive, 'weekly-archive', weeklyArchiveBlock(entries, today));
    if (next && withoutUpdated(next) !== withoutUpdated(archive)) {
      if (!dryRun) await writeMarkdown(archiveFile, setUpdated(next, today));
      changed.push({ file: path.relative(root, archiveFile).replace(/\\/g, '/'), action: 'updated' });
    }
  } else {
    skipped.push(path.relative(root, archiveFile).replace(/\\/g, '/'));
  }

  return { today, changed, skipped, sourceStatus: snapshot?.status ?? 'unknown', eventCount: events.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  const snapshotFile = path.join(ROOT, 'content', 'data', 'seoul-events.json');
  let snapshot = null;
  try {
    snapshot = JSON.parse(await fs.readFile(snapshotFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const result = await runFactory({ snapshot, dryRun });
  const prefix = dryRun ? '[dry-run]' : '[factory]';
  console.log(`${prefix} ${result.today} · source ${result.sourceStatus} · ${result.eventCount} listings`);
  for (const item of result.changed) console.log(`${prefix} ${item.action}: ${item.file}`);
  for (const item of result.skipped) console.log(`${prefix} skipped: ${item}`);
  if (!result.changed.length) console.log(`${prefix} no content changes`);
}
