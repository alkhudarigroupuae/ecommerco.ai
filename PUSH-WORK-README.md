# Push `work` branch from cloud workspace (no auth there)

Use this when you're in **Cursor cloud / Codespaces** at `/workspace/ecommerco.ai` and `git push` fails (no GitHub auth).

## One-time in that workspace

1. Create a Personal Access Token: https://github.com/settings/tokens (scope: **repo**).

2. In the **cloud terminal** (same session as your repo):
   ```bash
   cd /workspace/ecommerco.ai   # or wherever the repo with branch "work" is
   export GITHUB_TOKEN=ghp_your_token_here
   git remote set-url origin "https://alkhudarigroupuae:${GITHUB_TOKEN}@github.com/alkhudarigroupuae/ecommerco.ai.git"
   git push -u origin work
   ```

3. (Optional) Clear the token from the remote so it's not stored:
   ```bash
   git remote set-url origin https://github.com/alkhudarigroupuae/ecommerco.ai.git
   unset GITHUB_TOKEN
   ```

## Or use the script

Copy `push-work-to-github.sh` into that workspace, then:

```bash
export GITHUB_TOKEN=ghp_your_token_here
bash push-work-to-github.sh
```

The script sets the remote with the token, pushes, then clears the token from the remote URL.
