# Alcobosh — App Spec

Personal alcohol unit tracker. Tuned for the user's typical drinks (Pot 285ml, Bottle 330ml, Pint 568ml, all ~5% ABV). Data syncs across devices via Firebase; falls back to localStorage if Firebase isn't configured.

> **Naming note:** the user-facing app is "Alcobosh", but the localStorage keys still use the legacy `alcbosh:*` prefix (settings, drinks, dataUid). Do not change these — existing data depends on the old keys.

## Stack

- **React 19** + **Vite 8** (no framework, no router)
- **Tailwind CSS v3**
- **Firebase Web SDK** — Anonymous auth + Firestore
- Hosted on **GitHub Pages** at <https://simon-bristow.github.io/alcobosh/>

## Screens

Single-page app with a top-nav switching between three views:

1. **Home** (`home`) — rolling 7-day block (total + clickable heatmap, today on the right edge), Last 30 days card, quick-add tiles (long-press for custom ABV), Custom + Free Day buttons (with celebration), an amber "Logging on …" banner when a non-today cell is selected, recent-drinks list, AF-day streak. The Home tab is labelled "Home" in the nav even though the internal screen value is `home`.
2. **Cal** (`calendar`) — month grid showing units per day; tap a day to jump back to Home with that date selected
3. **Settings** (`settings`, ⚙︎ icon) — limits, tile editor, device-pairing UI

## Core constants

| Thing | Value | Where |
|---|---|---|
| Weekly cap | 10 units | `units.js` `DEFAULT_SETTINGS.weeklyCap` |
| Daily warn | 2 units | `units.js` `DEFAULT_SETTINGS.dailyWarn` |
| Week start | Monday | `units.js` `weekBounds()` |
| Unit formula | `(ml × ABV%) / 1000` | `units.js` `calcUnits()` |
| Default tiles | Pot 285/5, Bottle 330/5, Pint 568/5 | `units.js` `DEFAULT_TILES` |
| Tile limits | 1–10 configured; first 3 on Home, rest in dropdown | `units.js` `MAX_TILES` (10), `HOME_TILES` (3) |
| Long-press threshold | 500ms (≤10px movement) | `App.jsx` `useLongPress()` |
| Free-day shape | `{ freeDay: true, units: 0, ml: 0, abv: 0, name: 'Free day' }` | `App.jsx` `logFreeDay()` |
| Recent-drinks list size | 5 most recent | `App.jsx` `recent = drinks.slice(0, 5)` |
| Rolling 7-day window | 7 days inclusive of today (anchored at today, does not slide) | `App.jsx` `rolling7` memo |
| Last 30 days | sum of real units in last 30 days inclusive of today | `App.jsx` `last30` memo |
| Celebration duration | ~1.9s | `Celebration` component + CSS `floatUp` keyframe |

All defaults are overridable in Settings; user choices persist to localStorage as `alcbosh:settings`.

## View date

`App.jsx` keeps a `viewDate` state (default: today's midnight). It only controls the date used for new entries (quick-add, Custom Drink, Free Day all read it). It is set by:

- Tapping a cell in the home page's rolling-7 heatmap
- Tapping a day cell in the Cal screen (which also switches the screen back to Home)
- Tapping the amber "Logging on …" banner (resets to today)

When `viewDate !== today`, the amber banner is visible above the action buttons so it's always clear which date the next log will land on.

The **rolling-7-day heatmap, recent drinks list, last-30-day total, and AF streak** are all anchored at today — they do NOT follow `viewDate`. Only the logging actions and the highlight-ring on the heatmap follow it.

## State flow

```
initStore() ─┬─► Firebase configured?
             │     yes → signInAnonymously → onAuth(user) → dataUid = localStorage["alcbosh:dataUid"] || user.uid
             │     no  → mode: 'local', dataUid: 'local'
             │
             └─► subscribe(dataUid) ─► drinks list re-renders on every Firestore (or local) change
```

## Files

| Path | Role |
|---|---|
| `src/App.jsx` | Single root component; holds session, drinks, settings, current screen, viewDate, modal state, celebration trigger |
| `src/units.js` | Units math, week-bounds, AF-streak, settings persistence + migration, free-day predicates, per-day aggregations |
| `src/store.js` | Storage abstraction — switches between Firestore and localStorage |
| `src/firebase.js` | Firebase init, auth, Firestore CRUD (respects explicit `at` dates), pairing primitives |
| `src/index.css` | Tailwind directives + dark body background + celebration keyframes (`floatUp`, `burstPulse`) |
| `public/favicon.svg` | Pint glass with green fill |
| `public/manifest.webmanifest` | PWA manifest for home-screen install |
| `.github/workflows/deploy.yml` | Builds + deploys to Pages on every push to `main` |

## Constraints

- **No backend code** — everything client-side; Firestore is the only server-side dependency.
- **No router** — `screen` state in `App.jsx` swaps views.
- **One drink per log** — no batched entries.
- **No login UI** — anonymous auth is automatic; pairing is the only user-visible auth action.
- **Pre-1.0** — breaking changes are fine; no migrations beyond the tile-order one in `units.js`.
