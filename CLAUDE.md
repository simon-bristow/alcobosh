# Alcobosh — Project Instructions

## Spec Maintenance (IMPORTANT)

Whenever any file under `src/`, `index.html`, `vite.config.js`, `.github/workflows/`, or `public/manifest.webmanifest` is modified, **always update the relevant spec files** in `specs/` before pushing.

### Which spec to update

| Change area | Spec file |
|---|---|
| App overview, stack, flow, constraints, viewDate, file map | `specs/appspec.md` |
| Quick-add tiles, long-press ABV, free day + celebration, custom drink, recent list, edit/delete (incl. date) | `specs/spec-logging.md` |
| Day panel (with prev/next nav), combined week block (total + heatmap), AF streak | `specs/spec-progress.md` |
| Calendar view, month grid, monthly stats, day-cell tap-to-jump | `specs/spec-calendar.md` |
| Settings UI, tile editor, limits, persistence | `specs/spec-settings.md` |
| Firebase, auth, Firestore model, device pairing, local fallback | `specs/spec-sync.md` |
| Vite base, GH Pages, Actions workflow, PWA manifest | `specs/spec-deployment.md` |

When a change spans multiple areas, update each spec; if the change affects app-wide flow, also touch `appspec.md`.

If a change introduces a concept that doesn't fit any existing spec, create a new `specs/spec-<topic>.md` and add a row to the table above.

## Deployment

- Auto-deploys on every push to `main` via `.github/workflows/deploy.yml`
- Live at <https://simon-bristow.github.io/alcobosh/>
- Repo: `simon-bristow/alcobosh` (renamed from `alcbosh` in 2026)
- Pages source must be set to **GitHub Actions** in repo settings (not "Deploy from a branch")
- The user's PAT does NOT have `workflow` scope — workflow file edits must be done via the GitHub web UI; source-only commits push fine
- LocalStorage keys retain the legacy `alcbosh:*` prefix (settings, drinks, dataUid) for back-compat — do NOT change them

## Stack

- React 19 + Vite 8 (no router, no framework beyond React)
- Tailwind CSS v3
- Firebase Web SDK (Anonymous auth + Firestore)
- Single-page app; all state in `App.jsx`

## Firebase

- Project ID: `alcbosh-59fc9`
- Config lives in `src/firebase.js` (web API key is public by design)
- Firestore rules live in `firestore.rules` — keep this file in sync with the published rules in the Firebase console

## Versioning

Pre-1.0 — breaking changes are fine, no migration logic required. Not currently bumping a version number per-commit (unlike Sub Manager). If a visible version becomes useful, add it to the Settings screen and document a bump rule here.
