# Repository Guidelines

## Project Structure & Module Organization
- `backend/server.py` — threaded HTTP server that exposes `/notes`, `/ai/describe`, `/proxy-map` and serves the frontend from `public/`.
- `backend/public/` — static single-page client (`index.html`, `script.js`, `styles.css`, CSV assets, `og-preview.png`).
- `backend/data/notes.json` — mutable storage for saved descriptions and links; treat as user-owned state.
- `backend/run_app.command` — macOS helper for local launches; production instances run the server directly.
- Ops artifacts live outside the repo tree: `~/.config/systemd/user/surma_altai.service` and `/etc/nginx/sites-available/surma_altai`.

## Build, Test, and Development Commands
- `python3 server.py` (from `backend/`) — start the backend on `localhost:8080`.
- `./run_app.command` — interactive macOS launcher; mirrors the command above but also opens the browser.
- `systemctl --user restart surma_altai.service` — reload deployed service after code or data changes.
- `curl http://localhost:8080/notes` — quick health check for storage endpoint.

## Coding Style & Naming Conventions
- Python: follow PEP 8 (4-space indentation, snake_case, explicit imports). Prefer standard library; keep dependencies zero.
- Frontend JS: modern ES modules, const/let, camelCase for variables/functions, PascalCase for components if introduced.
- HTML/CSS: semantic tags, BEM-like class names only when the component grows; keep meta tags and OG/Twitter data in `<head>`.
- Environment variables live in `.env`/`gpt5-pro.env`; one `KEY=value` per line.

## Testing Guidelines
- Automated tests are not present; validate changes by launching `python3 server.py` and exercising filters, `/notes`, `/ai/describe`.
- For GPT integration, export `YANDEX_GPT_API_KEY`, `YANDEX_GPT_MODEL_URI`, `YANDEX_GPT_FOLDER_ID` and confirm responses via `curl -X POST /ai/describe`.
- Map rendering must be checked in the browser because remote APIs apply regional restrictions; confirm fallbacks.

## Commit & Pull Request Guidelines
- Commit messages use imperative mood with a concise scope (e.g., `Add OG preview image`, `Fix proxy-map error handling`).
- Reference ticket IDs or context in the body when relevant; avoid bundling unrelated changes.
- Pull requests should summarise user-facing impact, list manual tests (browser + curl), and attach screenshots for UI updates or map changes.
- Flag deployment follow-ups (systemd reload, nginx edits) so operators know which commands to run post-merge.

## Deployment & Ops Notes
- Production runs under the user-level systemd unit `surma_altai.service`; ensure `EnvironmentFile=gpt5-pro.env` stays in sync with secrets.
- Public access is served through nginx on `surma.su` (HTTP only while 443 is reserved for VPN). Update configs atomically and run `sudo nginx -t && sudo systemctl reload nginx`.
