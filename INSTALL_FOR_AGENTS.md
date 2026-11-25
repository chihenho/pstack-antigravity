# Installing `pstack-antigravity` for Antigravity

When a user asks you to install `https://github.com/chihenho/pstack-antigravity`, follow these steps:

1. **Check prerequisites**: Verify `git` and `node` (>= 18) are available.
2. **Clone or pull**:
   - Target repo path: `~/.gemini/antigravity/scratch/pstack-antigravity`
   - If `.git` exists there, run `git pull --ff-only`; otherwise run `git clone https://github.com/chihenho/pstack-antigravity.git` into that directory.
3. **Sync and install**:
   - Run `node sync.mjs --lang zh` if the user's request is in Chinese (or asks for Chinese descriptions); otherwise run `node sync.mjs` (English default).
   - `sync.mjs` sparse-clones `pstack/` from `cursor/plugins`, transforms skills and subagents for Antigravity, and installs to `~/.gemini/config/plugins/pstack/`.
4. **Verify via Antigravity Language Server RPC**:
   - Query `GetAllPlugins` (filtered — never print raw `SKILL.md` contents) to confirm `pstack` is discovered with `disabled == false`, `21` top-level skills, and `2` subagents (`poteto-agent`, `comment-sicko`).
5. **Reply to user**:
   - Report the upstream `pstack` version and commit SHA synced.
   - Give the user the direct plugin management link `[pstack](customization://pstack)`.
