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

For owner review, POST `{ "p_page_path": "/" }` to `get_site_button_click_counts` using the site origin. Review `route_generated`, `plan_download`, `matched_book_open` and `matched_custom_open`; review `/books/` for `book_sample_download` and `book_checkout_open`, and `/custom-guide/` for `enquiry_prepared` and `enquiry_email_open`. Compare checkout opens against completed paid orders in the store separately. A click or prepared email is never a purchase or received enquiry. No new affiliate commission is enabled.

Run `npm test` before publishing. It builds the site and checks all preference combinations, route variation, shorter family/slow days, untrusted query handling, conversion data minimization, published links, checkout destination and the separation of paid PDF from public sample. Browser checks should include desktop and mobile, preference links, download, remember/forget, book suitability and the enquiry draft. Use `?preview=1&days=5&party=family&interest=food&pace=slow&budget=lean&season=winter#plan` for a production preview without action counts.

## Customer planning desk and PDF export

The preparation desk adds profile-specific checklist items and an estimate calculator. Accommodation is the combined nightly amount for all rooms, counted once for the group; food and local transport are per person per sightseeing day; activities and contingency are whole-stay group amounts. All prices are the visitor's own inputs. No market price, transport fare or exchange-rate feed is used. The optional book or custom brief is excluded from the calculation.

`static/plan-pdf.mjs` generates the free personalized PDF locally with the pinned `pdf-lib` dependency. The library is copied with its license into `dist/vendor/` at build time and loaded only when exporting, rather than from a third-party CDN. Each PDF contains a cover, one page per selected day, and a preparation/budget page with interactive checkboxes. It snapshots the choices at the export click so a later form edit cannot change a pending export. The paid standard edition stays separate and private in the store.

Remembering a plan now saves and updates its preferences, budget and completed checklist in the browser until the visitor forgets it. Shared URLs still contain only allowlisted trip preferences. The `/book-help/` page translates store labels, answers four purchase/file situations and prepares an optional support email locally. It never submits an order, sends an email, or accesses payment records. Compare the offers at `/books/#guide-options`.

Additional allowlisted action counts are `plan_pdf_download`, `planning_desk_open`, `budget_calculated`, `checklist_updated`, `purchase_help_open`, `support_answer_view`, `support_draft_prepared` and `support_email_open`. They never include estimate values, checkbox values, order references or draft text. The first four appear on `/`; support counts appear on `/book-help/`. No sales confirmation is inferred from them.

The test suite includes the real client modules in a controlled DOM for save/restore/forget, recalculation after profile changes, export snapshot consistency, reset, support drafts and inert text handling. PDFs are reopened to validate their page count and canonical interactive field values. This is in addition to route-combination and published-link tests, and does not replace visual browser QA.

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
