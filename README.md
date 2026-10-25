# Stargate Korea — www.stargatekorea.net

English guides to studying, living and traveling in Korea, by Stargate Corporation (주식회사 별의문).

- `content/posts/*.md` — posts (front matter: title, slug, date, category, tags, excerpt)
- `content/pages/*.md` — static pages (about, contact, privacy-policy, campus-trips)
- `site.config.mjs` — site title, categories, navigation, AdSense/GA IDs
- `node build.mjs` — builds `dist/` with WordPress-style URLs (`/post-slug/`, `/category/slug/`)
- `node export-wordpress.mjs` — writes `kit/wordpress-import.xml` for a later move to WordPress
- Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`

WordPress migration guide (Korean): [kit/README.md](kit/README.md)
