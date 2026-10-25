# Stargate Korea — www.stargatekorea.net

English guides to studying, living and traveling in Korea, by Stargate Corporation (주식회사 별의문).

- `content/posts/*.md` — posts (front matter: title, slug, date, category, tags, excerpt)
- `content/pages/*.md` — static pages (about, contact, privacy-policy, campus-trips)
- `site.config.mjs` — site title, categories, navigation, AdSense/GA IDs
- `node build.mjs` — builds `dist/` with WordPress-style URLs (`/post-slug/`, `/category/slug/`)
- `node export-wordpress.mjs` — writes `kit/wordpress-import.xml` for a later move to WordPress
- Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`

WordPress migration guide (Korean): [kit/README.md](kit/README.md)

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
