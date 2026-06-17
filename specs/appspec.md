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

1. **Home** (`home`) — selected-day panel with prev/next arrows, combined week block (total + clickable heatmap with per-day units), rolling 7-day / 30-day totals, quick-add tiles (long-press for custom ABV), Free Day button (with celebration), recent-drinks list, AF-day streak. The Home tab itself is labelled "Home" in the nav even though the internal screen value remains `home`.
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
| Long-press threshold | 500ms (≤10px movement) | `App.jsx` `useLongPress()` |
| Free-day shape | `{ freeDay: true, units: 0, ml: 0, abv: 0, name: 'Free day' }` | `App.jsx` `logFreeDay()` |
| Recent-drinks list size | 5 most recent | `App.jsx` `recent = drinks.slice(0, 5)` |
| Rolling totals windows | last 7 days, last 30 days (inclusive of today) | `App.jsx` `rolling` memo |
| Celebration duration | ~1.9s | `Celebration` component + CSS `floatUp` keyframe |

All defaults are overridable in Settings; user choices persist to localStorage as `alcbosh:settings`.

## View date

`App.jsx` keeps a `viewDate` state (default: today's midnight). Prev/next arrows on the Today panel shift it by ±1 day; jumping to today's label resets it. Many derived values follow `viewDate`:

- "Day total" bar uses `viewDate`'s drinks
- The combined week block uses `weekBounds(viewDate)`
- Quick-add tiles, Custom Drink, Free Day all default new entries to `viewDate` (noon on past days, serverTimestamp on today)

The **recent drinks list, rolling 7d/30d totals, and AF streak** are global — they don't follow `viewDate`. The home-page heatmap and the Calendar page both call `onPickDay(date)` to set `viewDate` (Cal also switches screen back to Home).

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
