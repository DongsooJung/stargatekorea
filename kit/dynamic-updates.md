# Seoul listing updates

The home page shows up to six official Visit Seoul event listings overlapping the next seven Korea-time calendar days. Only the event title, dates and original link are reproduced. Images, descriptions, prices and booking claims are not copied.

## Data and operations

- `npm run refresh:events` fetches `https://english.visitseoul.net/events` with two bounded attempts. No key or visitor data is needed. This is a website listing adapter, not the TourAPI integration.
- The adapter reads static page text without executing remote scripts. A missing or partial listing, invalid dates, unsafe URLs or a changed layout preserve the last good snapshot in `content/data/seoul-events.json`.
- A genuine successful listing fetch updates `lastSuccessAt`. An unsuccessful attempt updates only `lastAttemptAt` and status. Building the site alone never advances either timestamp.
- More than 48 hours after the last successful fetch, event suggestions are hidden and visitors get a link to the official calendar. Expired events are always removed from the seven-day suggestions. Check the organizer directly for cancellations, hours and admission.
- The existing Pages workflow runs daily at **08:17 Asia/Seoul** (`17 23 * * *` UTC), on pushes to main, and manually from Actions. It refreshes, runs tests, saves the sanitized snapshot to main, and deploys in one workflow. Bot snapshot pushes do not need to trigger a second workflow.
- The build job alone has contents-write permission. If another edit advances main before the snapshot push, the ordinary non-forced push fails and deployment stops rather than overwriting another change. Rerun from the latest main.
- The workflow summary reports source status and the last success. A source failure is a warning so the rest of the site can still deploy; it is not reported as a fresh data check. Build/test/push/deployment failures fail the workflow.
- GitHub may delay or miss scheduled runs. Keep an eye on the last-success time and Actions summary. Browser code independently rechecks Korea-time expiry on load, every minute, and on returning to a tab.
- There is no automatic email or chat notification configured. GitHub workflow notifications follow the owner's existing settings.

## Approved notices

Edit `content/data/travel-notices.json`. Each record needs `approved: true`, `id`, `title`, `summary`, an existing internal article `href`, `showFrom`, `showUntil`, `checkedOn`, `sourceName` and `sourceUrl`. Dates are `YYYY-MM-DD` in Korea time; both display bounds are inclusive. The current source allowlist is Korea.kr and the Ministry of Education; expand it deliberately for other official sources.

The initial Suneung notice summarizes the already-published explainer and the official announcement checked on November 14, 2026. It leaves the home page after November 19; the explainer URL remains available. A notice's confirmation date is editorial and never updated by the event scraper.

This repository is public. Keep private drafts, customer information, unpublished analysis and secrets outside it. `approved: false` controls website visibility, not repository access. General article scheduling and an editor dashboard are later work.

## Verification and recovery

Run `npm test` before publication. Tests cover source parsing, failed fetches, invalid dates/URLs, Korea-midnight and seven-day boundaries, stale data, approved notice windows, browser expiry, existing itineraries and internal links. For a source-layout change, inspect the official page and update the parser and a representative test fixture; do not label old data newly checked.

After deployment, confirm the new home section, mobile cards, source links, displayed check time and the existing free planner/book buttons. The first scheduled run still needs observation; a successful push-triggered run verifies the collection/deployment path but not future scheduler delivery.
