#!/usr/bin/env bash
# Build everything that gets served, into one directory.
#
# The app is at the root and the landing page is under /lp, which is what lets
# the page link straight to `/` and to the licence page inside the app. They are
# separate projects with separate dependencies; only their output shares a site.
#
#   scripts/build-site.sh     # -> apps/web/dist
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

npm --prefix apps/web run build
npm --prefix apps/lp run build

rm -rf apps/web/dist/lp
cp -r apps/lp/dist apps/web/dist/lp
echo "site -> apps/web/dist (app at /, landing page at /lp/)"
