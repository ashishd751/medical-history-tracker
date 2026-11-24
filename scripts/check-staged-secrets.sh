#!/usr/bin/env bash
# Pre-commit guard for a PUBLIC repository (section 18).
# Blocks: real medical samples, signing material, archives (which may hold real data),
# and any commit made with the wrong git identity.
set -euo pipefail

fail=0
staged=$(git diff --cached --name-only --diff-filter=ACMR)

while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    private-samples/*)
      echo "✖ Blocked: '$f' is under private-samples/ (real medical data must never be committed)."
      fail=1
      ;;
    *.keystore | *.jks | *.p12 | *.mobileprovision | *.p8 | *.pem)
      echo "✖ Blocked: '$f' looks like signing material or a private key."
      fail=1
      ;;
    *.zip)
      echo "✖ Blocked: '$f' is an archive; backups contain real medical data."
      fail=1
      ;;
  esac
done <<<"$staged"

email=$(git config --get user.email || true)
if [ "$email" != "ashishd751@gmail.com" ]; then
  echo "✖ Blocked: git user.email is '${email:-<unset>}'."
  echo "  This repository must commit as ashishd751@gmail.com (see docs/DECISIONS.md)."
  echo "  Fix: git config --local user.email ashishd751@gmail.com"
  fail=1
fi

exit "$fail"
