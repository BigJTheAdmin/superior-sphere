#!/usr/bin/env bash
set -euo pipefail

# --- Customize these ---
export MYNAME="Javon Pringley"
export YEAR="$(date +%Y)"
export REPO_URL="https://github.com/BigJTheAdmin/superior-sphere"
# -----------------------

git checkout -b legal-safe-scrub || true

# Update UI link to your repo (if file exists)
[ -f src/components/SocialList.astro ] && \
  sed -i -E 's#https?://github.com/chrismwilliams/astro-cactus#'"$REPO_URL"'#g' src/components/SocialList.astro || true

# Remove Cactus marketing lines from README (keeps a backup)
if [ -f README.md ]; then
  cp README.md README.cactus-backup.md
  sed -i -E '/chrismwilliams|astro-theme-cactus|astro-cactus\.chriswilliams\.dev|Netlify|Vercel/Id' README.md
fi

# Remove demo posts/assets
rm -rf src/content/post/* 2>/dev/null || true
rm -rf public/post 2>/dev/null || true

# LICENSE: keep original MIT attribution AND add yours
cat > LICENSE <<'LIC'
MIT License

Copyright (c) 2022 Chris Williams
Copyright (c) YEAR_PLACEHOLDER MYNAME_PLACEHOLDER

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
LIC
sed -i "s/YEAR_PLACEHOLDER/${YEAR}/g; s/MYNAME_PLACEHOLDER/${MYNAME}/g" LICENSE

# Add CREDITS.md (optional but nice)
cat > CREDITS.md <<'CR'
This site began from the open-source **Astro Theme Cactus** (MIT License)
by Chris Williams. We preserve the original MIT notice in LICENSE.

Project URL: https://github.com/BigJTheAdmin/superior-sphere
Current project: REPO_URL_PLACEHOLDER
CR
sed -i "s#REPO_URL_PLACEHOLDER#${REPO_URL}#g" CREDITS.md

# Scrub remaining mentions everywhere EXCEPT LICENSE/CREDITS
grep -RIl --exclude-dir={.git,node_modules,dist,build} -iE 'chrismwilliams|astro-theme-cactus|astro-cactus' . \
  | grep -vE 'LICENSE|CREDITS\.md' \
  | xargs -r sed -i -E "s#https?://github\.com/chrismwilliams/astro-theme-cactus#${REPO_URL}#g"

echo "Remaining mentions (allowed in LICENSE/CREDITS):"
grep -RIn --exclude-dir={.git,node_modules,dist,build} -iE 'chrismwilliams|astro-theme-cactus|astro-cactus' . || true

git add -A
git commit -m "chore: clean Cactus references; keep MIT attribution (${YEAR})" || true

echo "Done. Review changes with: git diff --staged"
