#!/usr/bin/env bash
# Stargate Korea — one-shot WordPress setup with WP-CLI (Hostinger hPanel > Advanced > SSH Access).
# Run from the WordPress root (usually ~/domains/stargatekorea.net/public_html) after uploading wordpress-import.xml there.
set -euo pipefail

# 1) Basic settings — identical URL structure to the static site
wp option update blogname "Stargate Korea"
wp option update blogdescription "Study, live and travel in Korea — guides from Seoul"
wp option update timezone_string "Asia/Seoul"
wp option update date_format "F j, Y"
wp option update default_comment_status closed
wp rewrite structure '/%postname%/' --hard
wp rewrite flush --hard

# 2) Plugins: SEO + sitemap, cache, contact form, code snippets for AdSense/GA, Site Kit
wp plugin install wordpress-importer seo-by-rank-math litespeed-cache contact-form-7 insert-headers-and-footers google-site-kit --activate

# 3) Theme: lightweight and fast (Kadence); custom tokens go in Appearance > Customize > Additional CSS (kit/additional.css)
wp theme install kadence --activate

# 4) Remove sample content, then import everything from the static site
wp post delete 1 2 3 --force 2>/dev/null || true
wp import wordpress-import.xml --authors=create

# 5) Front page shows latest posts; Privacy Policy page linked for AdSense
wp option update show_on_front posts
PRIVACY_ID=$(wp post list --post_type=page --name=privacy-policy --field=ID)
[ -n "$PRIVACY_ID" ] && wp option update wp_page_for_privacy_policy "$PRIVACY_ID"

# 6) Main menu (same order as the static site)
wp menu create "Main" || true
for c in study-in-korea living-in-korea travel-korea korean-culture; do
  wp menu item add-term Main category "$(wp term get category "$c" --by=slug --field=term_id)"
done
for p in campus-trips about; do
  wp menu item add-post Main "$(wp post list --post_type=page --name=$p --field=ID)"
done
wp menu location assign Main primary || true

# 7) Footer menu
wp menu create "Footer" || true
for p in about contact privacy-policy; do
  wp menu item add-post Footer "$(wp post list --post_type=page --name=$p --field=ID)"
done

wp cache flush
echo "Done. Next: Rank Math setup wizard, AdSense code in WPCode, redirects (see README)."
