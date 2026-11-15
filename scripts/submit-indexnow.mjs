// IndexNow submission — tells Bing and other IndexNow partners that the site's
// URLs changed right after a deploy. The key file is public on purpose:
// IndexNow verifies the key by fetching it from the site.
//
// A failed submission never fails the deploy; it only prints a warning.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_FILE = path.join(ROOT, 'static', 'indexnow-key.txt');
const SITE = (process.env.SITE_URL || 'https://www.stargatekorea.net').replace(/\/$/, '');

const readKey = async () => {
  const key = (await fs.readFile(KEY_FILE, 'utf8')).trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) throw new Error('IndexNow key file is missing or malformed');
  return key;
};

const readSitemapUrls = async () => {
  const response = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/xml' } });
  if (!response.ok) throw new Error(`Sitemap unavailable: ${response.status}`);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim()).filter(url => url.startsWith(SITE));
  if (!urls.length) throw new Error('No site URLs found in the sitemap');
  return urls;
};

async function main() {
  const key = await readKey();
  const urlList = await readSitemapUrls();
  const body = { host: new URL(SITE).host, key, keyLocation: `${SITE}/indexnow-key.txt`, urlList };
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const detail = await response.text();
  if (response.ok) {
    console.log(`[indexnow] ${response.status} · ${urlList.length} URLs submitted · ${new URL(SITE).host}`);
    return;
  }
  console.warn(`[indexnow] ${response.status} · ${detail.slice(0, 200)}`);
}

try {
  await main();
} catch (error) {
  console.warn(`[indexnow] skipped: ${error.message}`);
}
