import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventSource, validateEvents } from '../static/update-state.mjs';

const output = fileURLToPath(new URL('../content/data/seoul-events.json', import.meta.url));
const textOnly = value => value.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  if (entity[0] !== '#') return named[entity.toLowerCase()];
  const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).replace(/\s+/g, ' ').trim();

// Read data as text; never execute JavaScript supplied by an external page.
export function parseVisitSeoul(html) {
  if (typeof html !== 'string' || html.length > 3000000) throw new Error('Unexpected source response');
  const anchors = new Map();
  for (const match of html.matchAll(/<a\b([^>]*\bdata-vs-content-id="([A-Za-z0-9_-]+)"[^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].match(/\bhref="([^"]+)"/i)?.[1];
    const title = match[3].match(/<span\b[^>]*class="title"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (href?.startsWith('/events/') && title) anchors.set(match[2], { title: textOnly(title), url: new URL(href, eventSource.url).href });
  }
  const items = [];
  for (const match of html.matchAll(/listData\.([A-Za-z0-9_-]+)\s*=\s*\{([\s\S]*?)\};/g)) {
    const anchor = anchors.get(match[1]);
    if (!anchor) continue;
    const startDate = match[2].match(/\bstartDt\s*:\s*'(\d{4}-\d{2}-\d{2})'/)?.[1];
    const endDate = match[2].match(/\bendDt\s*:\s*'(\d{4}-\d{2}-\d{2})'/)?.[1];
    items.push({ id: match[1], ...anchor, startDate, endDate });
  }
  // A changed/empty layout must not silently erase the last known good collection.
  if (!anchors.size || items.length !== anchors.size) throw new Error('Official listing layout changed or returned no recognizable events');
  return validateEvents(items);
}

export async function refreshEvents(previous, fetchPage, now = new Date()) {
  const lastAttemptAt = new Date(now).toISOString();
  try {
    const events = parseVisitSeoul(await fetchPage());
    return { schemaVersion: 1, source: eventSource, status: 'ok', lastAttemptAt, lastSuccessAt: lastAttemptAt, events };
  } catch {
    validateEvents(previous?.events ?? []);
    return { schemaVersion: 1, source: eventSource, status: 'unavailable', lastAttemptAt, lastSuccessAt: previous?.lastSuccessAt ?? null, events: previous?.events ?? [] };
  }
}

async function fetchPage() {
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(eventSource.url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'StargateKorea-EventListing/1.0 (+https://www.stargatekorea.net/about/)', Accept: 'text/html' } });
      if (!response.ok || new URL(response.url).origin !== new URL(eventSource.url).origin || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Official listing unavailable');
      const size = Number(response.headers.get('content-length'));
      if (size > 3000000) throw new Error('Response too large');
      return await response.text();
    } catch (error) { failure = error; }
  }
  throw failure;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let previous;
  try { previous = JSON.parse(await fs.readFile(output, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const snapshot = await refreshEvents(previous, fetchPage);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(snapshot.status === 'ok' ? `Checked official listing: ${snapshot.events.length} events.` : '::warning::Official listing check failed; last successful data retained.');
}
