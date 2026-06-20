# Spec — Settings

Three configurable sections. All values persist to `localStorage["alcbosh:settings"]` via `saveSettings()`. Persistence is **per-device** — settings do not sync across paired devices.

## 1. Limits

| Field | Default | Effect |
|---|---|---|
| Weekly cap (units) | 10 | Drives the week progress bar's denominator and color thresholds |
| Daily warn at (units) | 2 | Drives the daily progress bar's denominator, warn message, and heatmap red threshold |

Both are number inputs with `step="0.1"`.

## 2. Quick-add tiles

A list of **1 to `MAX_TILES` (10)** tiles. Each tile is a card with a label input on the top row plus ml / ABV% inputs below. Editing any field updates the tile immediately (next quick-add uses new values) and persists.

Per-tile row controls:
- `★` / index badge — the first `HOME_TILES` (3) tiles show a gold `★` (they render as Home buttons); positions 4+ show their index number (they appear in the Home “More ▾” dropdown).
- `▲` / `▼` — reorder the tile up/down (disabled at the ends). **Reordering is how you choose which 3 appear on Home** — move a tile into the top 3.
- `✕` — remove the tile (disabled when only 1 tile remains).

Below the list, an **+ Add tile (N/10)** button appends a new tile (`units.js` `makeTile()` → `{ id: uuid, label: 'Drink', ml: 330, abv: 5 }`); disabled at `MAX_TILES`.

Tile IDs are stable (defaults `pot`/`bottle`/`pint`; new tiles get a UUID); renaming the label does not change the ID. **Home reads `settings.tiles.slice(0, HOME_TILES)` for its buttons and `slice(HOME_TILES)` for the dropdown** — see `spec-logging.md`.

A one-time migration in `units.js` `loadSettings()` rewrites the old default order `[pot, pint, bottle]` to `[pot, bottle, pint]`; it is a no-op once the tile count is not exactly 3 (i.e. after the user adds/removes any tile).

For one-off ABV overrides without changing the tile default, long-press a Home tile (see `spec-logging.md`).

## 3. Sync

Depends on `isConfigured` from `firebase.js`:

### Not configured

Shows: *"Add Firebase config in `src/firebase.js` to enable cloud sync."* No interactive controls.

### Configured

- **Mode + uid**: shows `cloud · uid: <first 8 chars>…` for debugging
- **Generate pair code** button: creates a 6-digit code under `pairCodes/{code}` valid for 5 minutes, displays it in big mono font
- **Enter code from other device** input + **Pair** button: redeems a code → stores the source device's uid as `localStorage["alcbosh:dataUid"]` → reloads the page so subscriptions re-bind

Status messages (errors, "Paired — reloading…") render below the pair input.

## Implementation notes

- Settings are loaded synchronously at `App.jsx` mount via `useState(loadSettings())`.
- Every change calls `onChange(newSettings)` → `setSettings + saveSettings`. There's no debounce; localStorage writes are cheap.
- Pair-code redemption deletes the code doc on success (single-use).
