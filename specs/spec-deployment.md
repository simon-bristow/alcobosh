# Spec — Deployment

## Hosting

GitHub Pages, repo `simon-bristow/alcobosh` (renamed from `alcbosh` in 2026 — GitHub redirects the old URL but the remote should be updated). Served at:

**<https://simon-bristow.github.io/alcobosh/>**

## Vite base path

`vite.config.js` sets `base: '/alcobosh/'`. This makes Vite emit asset URLs as `/alcobosh/assets/...` so they resolve correctly under the GH Pages subpath.

References inside `index.html` use **bare absolute paths** (`/favicon.svg`, `/manifest.webmanifest`) — Vite injects the base prefix automatically. Do NOT prefix them with `/alcobosh/` manually or you'll get `/alcobosh/alcobosh/favicon.svg`.

Anything fetched from JS that needs to honor the base prefix should use `import.meta.env.BASE_URL`.

## CI workflow

`.github/workflows/deploy.yml` triggers on every push to `main`. Two jobs:

1. **build**: checkout → `actions/setup-node@v4` with node 20 + npm cache → `npm ci` → `npm run build` → `actions/upload-pages-artifact@v3` with `path: dist`
2. **deploy**: `actions/deploy-pages@v4` against the `github-pages` environment

Concurrency group `pages` with `cancel-in-progress: true` prevents overlapping deploys.

## Pages settings

In `Settings → Pages` on GitHub:
- **Source**: GitHub Actions (not "Deploy from a branch")
- Custom domain: none

## PWA manifest

`public/manifest.webmanifest`:
- `start_url` and `scope` are `/alcobosh/` (matches the subpath)
- `display: standalone` — runs without browser chrome when installed
- Theme/background colors match the app's `#0b0d12` body background
- Icons reference `favicon.svg` and `apple-touch-icon.svg`
- `name` and `short_name` are `Alcobosh`

`index.html` adds Apple-specific meta tags so iOS "Add to Home Screen" produces a fullscreen dark-status-bar launch:

- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `apple-mobile-web-app-title: Alcobosh`

### iOS safe-area inset

Because `status-bar-style: black-translucent` lets the app draw under the iOS status bar, the body has `padding-top/right/bottom/left: env(safe-area-inset-*)` in `src/index.css`. This pushes the top nav clear of the notch so tabs are tappable in standalone PWA mode.

The tab buttons themselves use `px-3.5 py-2.5 touch-manipulation` to give a comfortable ≥44px hit area on iOS.

## Local dev

```
npm install
npm run dev   # serves at http://localhost:5174/alcobosh/ (with the launch.json config) or 5173/alcobosh/ default
```

## PAT scope gotcha

The user's personal access token does **not** have the `workflow` scope. Pushing changes to `.github/workflows/*` will be rejected. Workflow files must be edited via the GitHub web UI (or the token's scopes extended). Source-only commits push fine.

## Firebase config in source

Firebase web API keys are designed to be public — they're embedded in client JS regardless. Committing `firebaseConfig` to a public repo is safe; security comes from Firestore rules + Anonymous auth, not from hiding the key.

If you wanted to lock the key down further, restrict it to specific HTTP referrers in Google Cloud Console (e.g. `simon-bristow.github.io/*` and `localhost:*`).

## Storage keys

The localStorage keys (`alcbosh:settings`, `alcbosh:drinks`, `alcbosh:dataUid`) intentionally keep the legacy `alcbosh:` prefix even after the rename to Alcobosh — changing them would orphan existing user data and force re-pairing.
