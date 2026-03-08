#!/usr/bin/env bash
# Run this in the cloud workspace (e.g. /workspace/ecommerco.ai) where the "work" branch exists.
# First set your token:  export GITHUB_TOKEN=ghp_your_token_here
# Then:  bash push-work-to-github.sh

set -e
REPO="alkhudarigroupuae/ecommerco.ai"
USER="alkhudarigroupuae"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: Set GITHUB_TOKEN first:  export GITHUB_TOKEN=ghp_your_token"
  exit 1
fi

git remote set-url origin "https://${USER}:${GITHUB_TOKEN}@github.com/${REPO}.git"
git push -u origin work
echo "Done. Consider:  unset GITHUB_TOKEN"
# Optional: remove token from remote after push (keeps URL without secret)
git remote set-url origin "https://github.com/${REPO}.git"
