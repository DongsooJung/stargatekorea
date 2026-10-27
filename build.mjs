// Static build for stargatekorea.net.
// Markdown in content/ -> HTML in dist/, using WordPress-style URLs (/post-slug/, /category/slug/)
// so the site can move to WordPress later without breaking links.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import site from './site.config.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
const readingTime = (text) => Math.max(1, Math.round(text.split(/\s+/).length / 220));

export function loadContent() {
  const read = (dir) =>
    fs
      .readdirSync(path.join(ROOT, 'content', dir))
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const raw = fs.readFileSync(path.join(ROOT, 'content', dir, f), 'utf8');
        const { data, content } = matter(raw);
        return { ...data, body: content, html: marked.parse(content), minutes: readingTime(content) };
      });
  const posts = read('posts')
    .filter((p) => !p.draft)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const pages = read('pages');
  const econDir = path.join(ROOT, 'content', 'economy');
  const reports = fs.existsSync(econDir)
    ? read('economy')
        .filter((r) => !r.draft)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  return { posts, pages, reports };
}

// Sections that have no published content are not built, linked or listed in the sitemap.
// set by build(): which categories have posts and whether /economy/ has any reports.
const live = { cats: new Set(site.categories.map((c) => c.slug)), economy: true };
const isLive = (href) => {
  if (href.startsWith('/economy/')) return live.economy;
  const m = href.match(/^\/category\/([^/]+)\//);
  return m ? live.cats.has(m[1]) : true;
};
const liveCategories = () => site.categories.filter((c) => live.cats.has(c.slug));

const catOf = (slug) => site.categories.find((c) => c.slug === slug) || { slug, name: slug, icon: '•' };

function layout({ title, description, pathname, body, type = 'website', jsonld, date, head = '' }) {
  const url = site.url + pathname;
  const fullTitle = pathname === '/' ? `${site.title} — ${site.tagline}` : `${title} | ${site.title}`;
  const ads = site.adsenseClient
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}" crossorigin="anonymous"></script>`
    : '';
  const ga = site.gaId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${site.gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${site.gaId}');</script>`
    : '';
  const nav = site.nav
    .filter((n) => isLive(n.href))
    .map((n) => `<a href="${n.href}"${pathname.startsWith(n.href) ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="naver-site-verification" content="2a0043cee1ff978f2bde90cc34a86f780f5f2684">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary">
${date ? `<meta property="article:published_time" content="${new Date(date).toISOString()}">` : ''}
${head}
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${site.url}/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
${ads}${ga}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/"><span class="star">✦</span><span>STARGATE <b>KOREA</b></span></a>
    <button class="menu-btn" aria-expanded="false" aria-controls="site-nav" onclick="const n=document.getElementById('site-nav');const o=n.classList.toggle('open');this.setAttribute('aria-expanded',o)">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">${nav}</nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap foot">
    <div>
      <a class="brand" href="/"><span class="star">✦</span><span>STARGATE <b>KOREA</b></span></a>
      <p class="muted">${esc(site.tagline)}.</p>
    </div>
    <nav aria-label="Topics"><h2>Topics</h2>${liveCategories().map((c) => `<a href="/category/${c.slug}/">${esc(c.name)}</a>`).join('')}</nav>
    <nav aria-label="Site"><h2>Site</h2>${site.footerPages.map((p) => `<a href="${p.href}">${esc(p.label)}</a>`).join('')}${live.economy ? '<a href="/economy/">Economy</a>' : ''}<a href="/feed.xml">RSS</a></nav>
  </div>
  <div class="wrap legal muted">© ${new Date().getFullYear()} ${esc(site.publisher)} · Seoul, Republic of Korea</div>
</footer>
</body>
</html>`;
}

const card = (p) => {
  const c = catOf(p.category);
  return `<article class="card">
  <a class="cat-chip" href="/category/${c.slug}/">${c.icon} ${esc(c.name)}</a>
  <h3><a href="/${p.slug}/">${esc(p.title)}</a></h3>
  <p>${esc(p.excerpt)}</p>
  <p class="meta"><time datetime="${new Date(p.date).toISOString()}">${fmtDate(p.date)}</time> · ${p.minutes} min read</p>
</article>`;
};

// ---------- /economy/ ----------
const E = site.economy;
const secOf = (slug) => E.sections.find((x) => x.slug === slug) || { slug, name: slug, icon: '•', blurb: '' };
const verdictBadge = (v) => {
  const d = E.verdicts[v];
  return d ? `<span class="verdict v-${d.tone}">${esc(d.label)}</span>` : '';
};
const econCard = (r) => {
  const s = secOf(r.section);
  return `<article class="card">
  <div class="card-top"><a class="cat-chip" href="/economy/${s.slug}/">${s.icon} ${esc(s.name)}</a>${verdictBadge(r.verdict)}</div>
  <h3><a href="/economy/${r.slug}/">${esc(r.title)}</a></h3>
  <p>${esc(r.excerpt)}</p>
  <p class="meta"><time datetime="${new Date(r.date).toISOString()}">${fmtDate(r.date)}</time> · ${r.minutes} min read</p>
</article>`;
};
const econEmpty = `<p class="empty">The first data-checked reports are being verified. Until then, read <a href="/economy/methodology/">how we check the numbers</a>.</p>`;

function buildEconomy(reports) {
  if (!reports.length) return; // nothing published yet: no hub, no empty section pages
  const counts = Object.fromEntries(E.sections.map((s) => [s.slug, reports.filter((r) => r.section === s.slug).length]));
  const sectionTiles = E.sections
    .filter((s) => counts[s.slug])
    .map(
      (s) => `<a class="topic" href="/economy/${s.slug}/"><span class="ti">${s.icon}</span><strong>${esc(s.name)}</strong><span class="muted">${esc(s.blurb)}</span><span class="count">${counts[s.slug] || 0} ${counts[s.slug] === 1 ? 'report' : 'reports'}</span></a>`
    )
    .join('');
  const scale = Object.entries(E.verdicts)
    .map(([, d]) => `<span class="verdict v-${d.tone}">${esc(d.label)}</span>`)
    .join('');

  // Hub
  write(
    'economy/index.html',
    layout({
      title: E.title,
      description: E.description,
      pathname: '/economy/',
      body: `
<section class="hero econ"><div class="wrap">
  <p class="eyebrow">Economy · Written from Seoul</p>
  <h1>${esc(E.tagline)}.</h1>
  <p class="lead">${esc(E.description)}</p>
  <div class="scale" aria-label="Verdict scale">${scale}</div>
  <div class="cta"><a class="btn" href="#reports">Latest reports</a><a class="btn ghost" href="/economy/methodology/">Methodology</a></div>
</div></section>
<section id="sections" class="wrap section">
  <div class="section-head"><p class="eyebrow">Sections</p><h2>Browse by section</h2></div>
  <div class="topics">${sectionTiles}</div>
</section>
<section id="reports" class="wrap section">
  <div class="section-head"><p class="eyebrow">Latest</p><h2>Reports</h2></div>
  ${reports.length ? `<div class="grid">${reports.slice(0, 12).map(econCard).join('')}</div>` : econEmpty}
</section>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: E.title, url: `${site.url}/economy/`, description: E.description },
    })
  );

  // Section listings
  for (const s of E.sections) {
    const list = reports.filter((r) => r.section === s.slug);
    if (!list.length) continue;
    write(
      `economy/${s.slug}/index.html`,
      layout({
        title: `${s.name} — ${E.title}`,
        description: `${s.name}: ${s.blurb}. ${E.tagline}.`,
        pathname: `/economy/${s.slug}/`,
        body: `
<section class="wrap section">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/economy/">Economy</a></nav>
  <div class="section-head"><p class="eyebrow">${s.icon} Section</p><h1>${esc(s.name)}</h1><p class="lead">${esc(s.blurb)}.</p></div>
  ${list.length ? `<div class="grid">${list.map(econCard).join('')}</div>` : econEmpty}
</section>`,
      })
    );
  }

  // Reports
  for (const r of reports) {
    const s = secOf(r.section);
    const figures = (r.figures || [])
      .map(
        (f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}</td><td><span class="conf c-${esc(f.confidence || 'reference')}" title="${esc(E.confidence[f.confidence] || '')}">${esc(f.confidence || 'reference')}</span></td><td>${f.source ? `<a href="${esc(f.source)}" rel="noopener">source</a>` : '—'}</td></tr>`
      )
      .join('');
    const sources = (r.sources || [])
      .map((x) => `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.title)}</a>${x.accessed ? ` <span class="muted">(accessed ${esc(x.accessed)})</span>` : ''}</li>`)
      .join('');
    const related = reports.filter((x) => x.slug !== r.slug).slice(0, 3);
    const altKo = r.korean_original ? `<link rel="alternate" hreflang="ko" href="${esc(r.korean_original)}">` : '';
    write(
      `economy/${r.slug}/index.html`,
      layout({
        title: r.title,
        description: r.excerpt,
        pathname: `/economy/${r.slug}/`,
        type: 'article',
        date: r.date,
        head: altKo,
        body: `
<article class="wrap narrow post">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/economy/">Economy</a> / <a href="/economy/${s.slug}/">${esc(s.name)}</a></nav>
  <h1>${esc(r.title)}</h1>
  <p class="meta">By ${esc(site.author.name)} · <time datetime="${new Date(r.date).toISOString()}">${fmtDate(r.date)}</time> · ${r.minutes} min read${r.data_as_of ? ` · Data as of ${esc(r.data_as_of)}` : ''}</p>
  ${r.verdict ? `<p class="verdict-row">Verdict: ${verdictBadge(r.verdict)}</p>` : ''}
  <p class="dek">${esc(r.excerpt)}</p>
  ${figures ? `<div class="figures"><h2>Key numbers</h2><table><thead><tr><th>Indicator</th><th>Value</th><th>Status</th><th>Source</th></tr></thead><tbody>${figures}</tbody></table></div>` : ''}
  <!-- ad-slot: post-top -->
  <div class="prose">${r.html}</div>
  <!-- ad-slot: post-bottom -->
  ${sources ? `<section class="sources"><h2>Sources</h2><ol>${sources}</ol></section>` : ''}
  ${r.korean_original ? `<p class="muted">Korean version: <a href="${esc(r.korean_original)}" hreflang="ko" rel="noopener">read the original</a></p>` : ''}
  <p class="muted small">Found an error? See our <a href="/economy/methodology/#corrections">corrections policy</a>.</p>
</article>
${related.length ? `<section class="wrap section"><div class="section-head"><h2>More reports</h2></div><div class="grid">${related.map(econCard).join('')}</div></section>` : ''}`,
        jsonld: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: r.title,
          description: r.excerpt,
          datePublished: new Date(r.date).toISOString(),
          dateModified: new Date(r.updated || r.date).toISOString(),
          author: { '@type': 'Person', name: site.author.name },
          publisher: { '@type': 'Organization', name: site.publisher },
          mainEntityOfPage: `${site.url}/economy/${r.slug}/`,
          articleSection: s.name,
        },
      })
    );
  }
}

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function build() {
  const { posts, pages, reports } = loadContent();
  live.cats = new Set(posts.map((p) => p.category));
  live.economy = reports.length > 0;
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

  // Home
  const counts = Object.fromEntries(site.categories.map((c) => [c.slug, posts.filter((p) => p.category === c.slug).length]));
  const home = `
<section class="hero"><div class="wrap">
  <p class="eyebrow">Written from Seoul</p>
  <h1>Korea, explained by people who live here.</h1>
  <p class="lead">${esc(site.description)}</p>
  <div class="cta"><a class="btn" href="#latest">Read the latest guides</a><a class="btn ghost" href="/campus-trips/">Campus Trips</a></div>
</div></section>
<section id="latest" class="wrap section">
  <div class="section-head"><p class="eyebrow">Latest posts</p><h2>New guides</h2></div>
  <div class="grid">${posts.slice(0, 9).map(card).join('')}</div>
</section>
<section id="topics" class="wrap section">
  <div class="section-head"><p class="eyebrow">Topics</p><h2>Find guides by topic</h2></div>
  <div class="topics">${liveCategories()
    .map(
      (c) => `<a class="topic" href="/category/${c.slug}/"><span class="ti">${c.icon}</span><strong>${esc(c.name)}</strong><span class="muted">${esc(c.blurb)}</span><span class="count">${counts[c.slug] || 0} ${counts[c.slug] === 1 ? 'guide' : 'guides'}</span></a>`
    )
    .join('')}</div>
</section>
<section id="channels" class="wrap section">
  <div class="section-head"><p class="eyebrow">Channels</p><h2>More from Stargate</h2></div>
  <div class="channels">${site.channels
    .filter((ch) => isLive(ch.href))
    .map((ch) => `<a class="channel" href="${ch.href}"${ch.href.startsWith('http') ? ' rel="noopener"' : ''}><strong>${esc(ch.name)}</strong><span class="muted">${esc(ch.note)}</span><span class="arrow">→</span></a>`)
    .join('')}</div>
</section>`;
  write(
    'index.html',
    layout({
      title: site.title,
      description: site.description,
      pathname: '/',
      body: home,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.title,
        url: site.url + '/',
        description: site.description,
        publisher: { '@type': 'Organization', name: site.publisher },
      },
    })
  );

  // Posts
  for (const p of posts) {
    const c = catOf(p.category);
    const related = posts.filter((x) => x.slug !== p.slug).slice(0, 3);
    const body = `
<article class="wrap narrow post">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/${c.slug}/">${esc(c.name)}</a></nav>
  <h1>${esc(p.title)}</h1>
  <p class="meta">By ${esc(site.author.name)} · <time datetime="${new Date(p.date).toISOString()}">${fmtDate(p.date)}</time> · ${p.minutes} min read</p>
  <p class="dek">${esc(p.excerpt)}</p>
  <!-- ad-slot: post-top -->
  <div class="prose">${p.html}</div>
  <!-- ad-slot: post-bottom -->
  ${p.tags?.length ? `<p class="tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</p>` : ''}
</article>
${related.length ? `<section class="wrap section"><div class="section-head"><h2>Keep reading</h2></div><div class="grid">${related.map(card).join('')}</div></section>` : ''}`;
    write(
      `${p.slug}/index.html`,
      layout({
        title: p.title,
        description: p.excerpt,
        pathname: `/${p.slug}/`,
        body,
        type: 'article',
        date: p.date,
        jsonld: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.excerpt,
          datePublished: new Date(p.date).toISOString(),
          dateModified: new Date(p.updated || p.date).toISOString(),
          author: { '@type': 'Person', name: site.author.name },
          publisher: { '@type': 'Organization', name: site.publisher },
          mainEntityOfPage: `${site.url}/${p.slug}/`,
          articleSection: c.name,
        },
      })
    );
  }

  // Categories
  for (const c of liveCategories()) {
    const list = posts.filter((p) => p.category === c.slug);
    const body = `
<section class="wrap section">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Topics</nav>
  <div class="section-head"><p class="eyebrow">${c.icon} Topic</p><h1>${esc(c.name)}</h1><p class="lead">${esc(c.blurb)}.</p></div>
  ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<p class="empty">New guides in this topic are on the way. In the meantime, <a href="/#latest">browse the latest posts</a>.</p>`}
</section>`;
    write(`category/${c.slug}/index.html`, layout({ title: c.name, description: `${c.name}: ${c.blurb}. Guides from ${site.title}.`, pathname: `/category/${c.slug}/`, body }));
  }

  // Pages
  for (const pg of pages) {
    const body = `<article class="wrap narrow post"><h1>${esc(pg.title)}</h1><div class="prose">${pg.html}</div></article>`;
    write(`${pg.slug}/index.html`, layout({ title: pg.title, description: pg.excerpt, pathname: `/${pg.slug}/`, body }));
  }

  // Economy
  buildEconomy(reports);

  // 404
  write('404.html', layout({ title: 'Page not found', description: 'This page could not be found.', pathname: '/404/', body: `<section class="wrap narrow section"><h1>Page not found</h1><p>The page you are looking for does not exist. <a href="/">Go to the homepage</a>.</p></section>` }));

  // Feed, sitemap, robots, ads.txt
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${esc(site.title)}</title><link>${site.url}/</link><description>${esc(site.description)}</description><language>en-us</language>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${posts
  .map(
    (p) => `<item><title>${esc(p.title)}</title><link>${site.url}/${p.slug}/</link><guid>${site.url}/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(catOf(p.category).name)}</category><description>${esc(p.excerpt)}</description></item>`
  )
  .join('\n')}
${reports
  .map(
    (r) => `<item><title>${esc(r.title)}</title><link>${site.url}/economy/${r.slug}/</link><guid>${site.url}/economy/${r.slug}/</guid><pubDate>${new Date(r.date).toUTCString()}</pubDate><category>${esc(secOf(r.section).name)}</category><description>${esc(r.excerpt)}</description></item>`
  )
  .join('\n')}
</channel></rss>`;
  write('feed.xml', feed);

  const urls = [
    { loc: '/', lastmod: posts[0]?.date },
    ...posts.map((p) => ({ loc: `/${p.slug}/`, lastmod: p.updated || p.date })),
    ...liveCategories().map((c) => ({ loc: `/category/${c.slug}/` })),
    ...pages.map((pg) => ({ loc: `/${pg.slug}/` })),
    ...(reports.length ? [{ loc: '/economy/', lastmod: reports[0].date }] : []),
    ...E.sections.filter((x) => reports.some((r) => r.section === x.slug)).map((x) => ({ loc: `/economy/${x.slug}/` })),
    ...reports.map((r) => ({ loc: `/economy/${r.slug}/`, lastmod: r.updated || r.date })),
  ];
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `<url><loc>${site.url}${u.loc}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)
      .join('\n')}\n</urlset>\n`
  );
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  if (site.adsenseClient) write('ads.txt', `google.com, ${site.adsenseClient.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);

  console.log(`Built ${posts.length} posts, ${reports.length} economy reports, ${pages.length} pages, ${live.cats.size}/${site.categories.length} categories (empty ones skipped) -> dist/`);
  return { posts, pages, reports };
}

if (process.argv[1] === new URL(import.meta.url).pathname) build();
