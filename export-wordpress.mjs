// Exports every post, page, category and tag to a WordPress WXR 1.2 file.
// Import it in WordPress: Tools -> Import -> WordPress -> kit/wordpress-import.xml
// Slugs, dates and categories are preserved, so URLs stay identical after the switch.
import fs from 'node:fs';
import path from 'node:path';
import site from './site.config.mjs';
import { loadContent } from './build.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const cdata = (s = '') => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const pad = (n) => String(n).padStart(2, '0');
// WordPress wants local (KST) and GMT timestamps as "YYYY-MM-DD HH:MM:SS".
const wpDate = (d, offsetHours) => {
  const t = new Date(new Date(d).getTime() + offsetHours * 3600e3);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
};
const tagSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Turn root-relative links into absolute ones so they resolve inside WordPress.
const absolutize = (html) => html.replace(/href="\/(?!\/)/g, `href="${site.url}/`);

export function exportWxr() {
  const { posts, pages } = loadContent();
  const tags = [...new Set(posts.flatMap((p) => p.tags || []))];
  const now = new Date();
  let id = 1;

  const item = (doc, type) => {
    const date = doc.date || now;
    const cat = site.categories.find((c) => c.slug === doc.category);
    const terms = [
      cat ? `<category domain="category" nicename="${cat.slug}">${cdata(cat.name)}</category>` : '',
      ...(doc.tags || []).map((t) => `<category domain="post_tag" nicename="${tagSlug(t)}">${cdata(t)}</category>`),
    ].join('\n    ');
    return `  <item>
    <title>${cdata(doc.title)}</title>
    <link>${site.url}/${doc.slug}/</link>
    <pubDate>${new Date(date).toUTCString()}</pubDate>
    <dc:creator>${cdata(site.author.login)}</dc:creator>
    <guid isPermaLink="false">${site.url}/?p=${id}</guid>
    <description></description>
    <content:encoded>${cdata(absolutize(doc.html))}</content:encoded>
    <excerpt:encoded>${cdata(doc.excerpt || '')}</excerpt:encoded>
    <wp:post_id>${id++}</wp:post_id>
    <wp:post_date>${cdata(wpDate(date, 9))}</wp:post_date>
    <wp:post_date_gmt>${cdata(wpDate(date, 0))}</wp:post_date_gmt>
    <wp:comment_status>${cdata('closed')}</wp:comment_status>
    <wp:ping_status>${cdata('closed')}</wp:ping_status>
    <wp:post_name>${cdata(doc.slug)}</wp:post_name>
    <wp:status>${cdata('publish')}</wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>0</wp:menu_order>
    <wp:post_type>${cdata(type)}</wp:post_type>
    <wp:post_password>${cdata('')}</wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
    ${terms}
  </item>`;
  };

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!-- WordPress eXtended RSS export generated from the stargatekorea.net static site on ${now.toISOString()} -->
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>${cdata(site.title)}</title>
  <link>${site.url}</link>
  <description>${cdata(site.tagline)}</description>
  <pubDate>${now.toUTCString()}</pubDate>
  <language>${site.language}</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>${site.url}</wp:base_site_url>
  <wp:base_blog_url>${site.url}</wp:base_blog_url>
  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login>${cdata(site.author.login)}</wp:author_login>
    <wp:author_email>${cdata(site.author.email)}</wp:author_email>
    <wp:author_display_name>${cdata(site.author.name)}</wp:author_display_name>
    <wp:author_first_name>${cdata('Dongsoo')}</wp:author_first_name>
    <wp:author_last_name>${cdata('Jung')}</wp:author_last_name>
  </wp:author>
${site.categories
  .map(
    (c, i) => `  <wp:category>
    <wp:term_id>${i + 1}</wp:term_id>
    <wp:category_nicename>${cdata(c.slug)}</wp:category_nicename>
    <wp:category_parent>${cdata('')}</wp:category_parent>
    <wp:cat_name>${cdata(c.name)}</wp:cat_name>
    <wp:category_description>${cdata(c.blurb)}</wp:category_description>
  </wp:category>`
  )
  .join('\n')}
${tags
  .map(
    (t, i) => `  <wp:tag>
    <wp:term_id>${100 + i}</wp:term_id>
    <wp:tag_slug>${cdata(tagSlug(t))}</wp:tag_slug>
    <wp:tag_name>${cdata(t)}</wp:tag_name>
  </wp:tag>`
  )
  .join('\n')}
${posts.map((p) => item(p, 'post')).join('\n')}
${pages.map((p) => item(p, 'page')).join('\n')}
</channel>
</rss>
`;
  const out = path.join(ROOT, 'kit', 'wordpress-import.xml');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, xml);
  console.log(`WXR written: ${posts.length} posts, ${pages.length} pages, ${site.categories.length} categories, ${tags.length} tags -> kit/wordpress-import.xml`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) exportWxr();
