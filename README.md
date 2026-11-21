# Stargate Korea — www.stargatekorea.net

English guides to studying, living and traveling in Korea, by Stargate Corporation (주식회사 별의문).

- `content/posts/*.md` — posts (front matter: title, slug, date, category, tags, excerpt)
- `content/pages/*.md` — static pages (about, contact, privacy-policy, campus-trips)
- `site.config.mjs` — site title, categories, navigation, AdSense/GA IDs
- `node build.mjs` — builds `dist/` with WordPress-style URLs (`/post-slug/`, `/category/slug/`)
- `node export-wordpress.mjs` — writes `kit/wordpress-import.xml` for a later move to WordPress
- Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`

WordPress migration guide (Korean): [kit/README.md](kit/README.md)

## Personalized Seoul planning and conversion measurement

The home planner uses `static/personalization.mjs`, a shared editorial rules module. Days, pace, party, interest, spending style and season determine the route, advice, reading links and optional next offer. Its 1,440 valid preference combinations do not imply 1,440 individually researched itineraries. The recommendations are not live availability checks or per-visitor AI generations. There is no AI key, model bill or visitor text sent to a model. Free plans can be downloaded, printed, shared by preference URL, or remembered on the visitor's own device by choice.

The standard PDF and custom brief are distinct offers. The existing store product remains KRW 9,900, with a fixed USD display equivalent. Family or slower theme-focused requests receive a custom-brief enquiry recommendation. The enquiry carries all six preferences and optional notes into a local email draft; visitors review and send it themselves. Quote writing, replies, custom delivery and payment confirmation are not automated by this site.

`static/conversions.mjs` reuses the existing Stargate analytics service at `https://stargate.stargate8225.workers.dev/api/analytics/`. It records allowlisted action labels without preferences, query strings, draft text or payment data. Actions are deduplicated by label within a page load; they are action counts, not unique customers. Only `www.stargatekorea.net` sends these events. Do Not Track and `?preview=1` suppress this action tracking (the existing visitor counter is independent).

Two measurements were added so the funnel can be read page by page. A **page view** is recorded once per page load with the page path and no other detail, and a **click** now also carries the destination it led to (`target_url`), so a click on "See the PDF guide" and a click on "Ask for a custom brief" are separable. The page view reuses the same visitor id as the visitor counter, and the counter counts each browser once per Korea day, so the visitor total keeps its meaning while the new view counts land in the page-by-page store.

For owner review, POST `{ "p_page_path": "/" }` to `get_site_button_click_counts` **with the header `Origin: https://www.stargatekorea.net`**. The analytics service keeps one store per site and picks the store from the Origin header, so a request without that header answers with another Stargate site's data. Review `route_generated`, `plan_download`, `matched_book_open` and `matched_custom_open`; review `/books/` for `book_sample_download` and `book_checkout_open`, and `/custom-guide/` for `enquiry_prepared` and `enquiry_email_open`. Compare checkout opens against completed paid orders in the store separately. A click or prepared email is never a purchase or received enquiry. No new affiliate commission is enabled.

Run `npm test` before publishing. It builds the site and checks all preference combinations, route variation, shorter family/slow days, untrusted query handling, conversion data minimization, published links, checkout destination and the separation of paid PDF from public sample. Browser checks should include desktop and mobile, preference links, download, remember/forget, book suitability and the enquiry draft. Use `?preview=1&days=5&party=family&interest=food&pace=slow&budget=lean&season=winter#plan` for a production preview without action counts.

## Customer planning desk and PDF export

The preparation desk adds profile-specific checklist items and an estimate calculator. Accommodation is the combined nightly amount for all rooms, counted once for the group; food and local transport are per person per sightseeing day; activities and contingency are whole-stay group amounts. All prices are the visitor's own inputs. No market price, transport fare or exchange-rate feed is used. The optional book or custom brief is excluded from the calculation.

`static/plan-pdf.mjs` generates the free personalized PDF locally with the pinned `pdf-lib` dependency. The library is copied with its license into `dist/vendor/` at build time and loaded only when exporting, rather than from a third-party CDN. Each PDF contains a cover, one page per selected day, and a preparation/budget page with interactive checkboxes. It snapshots the choices at the export click so a later form edit cannot change a pending export. The paid standard edition stays separate and private in the store.

Remembering a plan now saves and updates its preferences, budget and completed checklist in the browser until the visitor forgets it. Shared URLs still contain only allowlisted trip preferences. The `/book-help/` page translates store labels, answers four purchase/file situations and prepares an optional support email locally. It never submits an order, sends an email, or accesses payment records. Compare the offers at `/books/#guide-options`.

Additional allowlisted action counts are `plan_pdf_download`, `planning_desk_open`, `budget_calculated`, `checklist_updated`, `purchase_help_open`, `support_answer_view`, `support_draft_prepared` and `support_email_open`. They never include estimate values, checkbox values, order references or draft text. The first four appear on `/`; support counts appear on `/book-help/`. No sales confirmation is inferred from them.

The test suite includes the real client modules in a controlled DOM for save/restore/forget, recalculation after profile changes, export snapshot consistency, reset, support drafts and inert text handling. PDFs are reopened to validate their page count and canonical interactive field values. This is in addition to route-combination and published-link tests, and does not replace visual browser QA.

## Content factory — dated pages from the official listing

`npm run factory` turns the official Visit Seoul snapshot into pages that match how people actually search for a trip: a dated roundup for the current week (and the weeks that already have listings), a refreshed event block inside each monthly guide, and a weekly archive that links every roundup.

- `scripts/factory.mjs` — the engine. Calendar helpers, listing selection, markdown generation and the marker-block refresh are pure functions, so they are covered by `tests/factory.test.mjs`.
- `content/posts/seoul-week-of-YYYY-MM-DD.md` — one roundup per week. The slug is stable for the life of the week, so the URL never changes.
- `content/pages/seoul-in-{month}.md` — twelve evergreen month guides. The editorial text is written by hand and never overwritten; only the block between `<!-- factory:month-events -->` and `<!-- /factory:month-events -->` is replaced.
- `content/pages/seoul-weekly.md` — the archive index. Its list block is replaced on every run.
- `npm run submit:indexnow` — submits the live sitemap to IndexNow after a deploy, so Bing and other partners learn about new URLs immediately. The key lives in `static/indexnow-key.txt` and is public on purpose.

Rules the factory follows:

- **No invented facts.** Every listing comes from the official snapshot. Event titles are escaped before they enter markdown, and only `https://english.visitseoul.net/events/…` links are published.
- **Deterministic and idempotent.** The same data always produces the same file, and a run that changes nothing writes nothing, so the daily job does not create empty commits.
- **A week stops being promoted when it ends.** The roundup page stays online as an archive with a "this roundup has passed" notice and `noindex,follow`, and it is removed from the home page, the RSS feed and the sitemap.
- **Auto-published, with the source visible.** The Pages workflow refreshes the listing, runs the factory, runs the tests, commits the result and deploys in one run. The home page and each monthly guide show where the listings came from and when they were checked.

Run `npm test` before publishing. The suite covers the calendar rules, window selection, markdown escaping, marker replacement, idempotency, expiry handling and the order of steps in the deploy workflow.

### Which runner executes the factory

The daily Pages workflow already runs the factory on GitHub's own servers: it refreshes the listing, then runs `npm test`, and the `pretest` hook executes `scripts/factory.mjs` before the site is built. The deployed site therefore always carries the dated pages generated from that morning's official snapshot, and the run does not depend on any desktop being awake.

The workflow file additionally contains an explicit factory step, a wider commit list and the IndexNow submission, but changing a workflow file needs a GitHub token with the `workflow` scope. Until that scope is granted, the scheduled desktop task commits the generated pages back to the repository, submits them to IndexNow and verifies that the deployment succeeded.

## Edited neighborhood days and calendar files

Each suggested day can be changed to another neighborhood in the editorial catalog or moved earlier/later. Selecting an already used neighborhood swaps the two days, preserving a distinct route for every day. Family/slow limits still apply. A new main-planner submission or “Reset suggested days” rebuilds the suggestions from the current profile.

The visible route is kept in the address bar, saved preferences, PDF, text outline, product/help links and quote draft. The optional `routes` URL value contains allowlisted catalog IDs only. Unknown IDs and duplicates are filtered; no arbitrary address or free text is inserted. Old preference-only links and saved profiles remain valid. The preview flag is retained when the page updates its address, so QA does not enable action tracking accidentally.

The optional first sightseeing date lives in the preparation desk. It selects an existing month guide and creates an RFC 5545 `.ics` file with one tentative, transparent, all-day suggestion per day. Civil dates use UTC date arithmetic to avoid timezone or DST shifts; long UTF-8 lines are folded without splitting a character. Calendar files include itinerary dates, but exclude budget figures, order references and enquiry text. Downloading a file never accesses or changes a calendar account. Shared preference links and PDF reopen links exclude the private start date. Remembering/forgetting or clearing the desk also handles the local date.

Action labels `route_edited`, `calendar_download` and `month_guide_open` are fixed and contain no route values or dates. Browser checks should cover a reload from an existing preference URL after editing, a saved route, a shared route, exported PDF/ICS contents, and both desktop/mobile layouts. Automated tests also cover duplicate swaps, route validation, leap days, year boundaries, line folding and quote-draft continuity.

### The self-improvement loop

`npm run self-improve` is the second half of the factory. It audits every published page, repairs what it can, and records what it found so the next run starts from the last state instead of from zero.

- `scripts/monetization-audit.mjs` — reads `dist/` and checks, for every page a visitor can land on, that the page offers a next step **inside the content** and that the offer carries a conversion label. Navigation and footer links do not count: they appear on every page and prove nothing. Legal pages, the custom guide page itself and the separate Campus Trips product are out of scope, and the reasons are written down in the script.
- `scripts/self-improve.mjs` — runs the audit, re-inserts the offer block into a generated page that lost it, carries unresolved findings forward with their age, closes the ones that are fixed, and writes `content/data/self-improvement.json`. That file holds page paths and counts only, and the build never publishes it as a page.
- `tests/monetization.test.mjs` — turns the audit into a gate. A page that reaches a visitor without a next step, or an offer that cannot be measured, fails the build.

The Pages workflow runs the loop on every deploy: refresh the listing → generate the dated pages → measure the guides → audit and repair → test → commit → deploy → submit to IndexNow. The log accumulates in the repository, so a regression that is fixed on one day is recorded as closed on the next.

Data note: every analytics read must carry the header `Origin: https://www.stargatekorea.net`. The service keeps one store per site and chooses the store from that header, so a request without it answers with another Stargate site's data — including click counts on generic paths such as `/`. Only site-specific paths are used for decisions, and the limitation is recorded next to the log.

## Measuring the twelve month guides

`npm run measure:guides` reads the live analytics service for this site only and writes `content/data/guide-metrics.json`: for every month guide, every weekly roundup and the funnel pages, the views, the clicks, the action labels behind those clicks and a verdict. The file holds paths and counts only, and the build never publishes it as a page.

- `views` — page views recorded for that path in the last 30 days.
- `clicks` — offer clicks recorded for that path, with the destination each click led to.
- `verdict` — `no-data` (nothing measured yet), `read-not-acting` (read but never acted on), `acting` (clicked without a recorded view) or `working`.
- `action` — what the loop should do next: `collect-data`, `strengthen-offer` or `keep-separate`.

The merge rule is deliberate and conservative. **The twelve month guides are not merged.** Each one is a separate search-intent asset, so a guide is only a merge candidate when it was read at least 10 times in 30 days, was never clicked, and overlaps the intent of the page it would join. A guide with no views is missing data, not a defect, and must not push the loop into deleting an asset. Everything else is strengthened instead.

Baseline note: this site's analytics store was empty before November 21, 2026. The records under `/probe-*` paths and the `probe_*` labels are diagnostic probes made while the measurement was being repaired, not visitor activity, and the file says so in its `notes` field.

What was strengthened instead, on 2026-11-21: every month guide now ends with a **month index** that links all twelve guides, marks the month being read and carries the `month_guide_open` label. The twelve pages used to be twelve islands that never pointed at each other; they are now one cluster that can pass a reader from January to December and then to the offer. `tests/analytics.test.mjs` holds the rule in place: all twelve guides must link to all twelve months, and pages that are not month guides must not carry the block.

## Economy — /economy/

영어 경제·정책 검증 섹션입니다. 글은 `content/economy/*.md`에 넣으면 `/economy/{slug}/`로 발행됩니다.
판정·신뢰도 기준은 `/economy/methodology/`(`content/pages/economy-methodology.md`)에 있습니다.

```markdown
---
title: "Korea's Jeonse Market Is Splitting in Two"
slug: korea-jeonse-market-splitting-in-two
date: 2026-11-02T09:00:00+09:00
section: policy-check            # policy-check | macro-notes | industry-watch | regulation-watch
verdict: partial                 # effective | partial | too-early | ineffective | backfire (생략 가능)
data_as_of: "October 2026"
excerpt: "One-sentence summary shown on cards and in search results."
korean_original: https://blog.stargateedu.co.kr/...   # 한국어 원문 (생략 가능)
figures:                         # 핵심 숫자 표 — confidence: verified | reference | estimate
  - { label: "Seoul apartment price change", value: "+0.20% (week to Sep 7)", confidence: verified, source: "https://..." }
sources:
  - { title: "Korea Real Estate Board weekly survey", url: "https://...", accessed: "2026-10-26" }
draft: true                      # true면 발행 안 함
---

본문(Markdown)...
```

- 검증된 값만 `verified`로 표시하고, 판정은 `verified` 값에만 근거합니다.
- 반대 증거와 비용 부담 계층을 본문에 반드시 포함합니다.
