# Spec — Logging drinks

Covers quick-add tiles (with long-press for one-off ABV), the alco-free-day marker (with celebration), custom-drink modal, units calculation, edit/delete of existing entries (including date), and the global Recent-drinks list.

## Quick-add tiles

The first `HOME_TILES` (3) configured tiles render as big buttons on the Home screen (`settings.tiles.slice(0, 3)`). Tiles beyond the first 3 are reachable via the **"More ▾" dropdown** in the action row (see below). Each tile tap → one drink logged with the tile's `ml` + `abv` defaults and `name = tile.label`. The entry's `at` defaults to:

- **viewDate = today** → backend uses `serverTimestamp()` (cloud) or `new Date()` (local)
- **viewDate = past day** → noon on that day (`12:00` local time)

Defaults (from `units.js` `DEFAULT_TILES`, displayed left-to-right):

| Label | ml | ABV | Computed units |
|---|---|---|---|
| Pot | 285 | 5.0 | 1.4 |
| Bottle | 330 | 5.0 | 1.7 |
| Pint | 568 | 5.0 | 2.8 |

Tile renders show: label, `ml · ABV%`, and the precomputed unit value as `+X.Xu`. Tiles are editable in Settings — label, ml, and ABV can all be changed; new defaults persist to localStorage.

### Long-press → custom ABV

Long-pressing a tile (≥500ms hold, <10px movement) opens the **AbvQuickModal** instead of logging a default drink:

- Pre-filled with the tile's current ABV
- Live preview of `units = calcUnits(tile.ml, abv)`
- "Log drink" button writes a one-off entry using `tile.ml + tile.label + the new ABV` and the current `viewDate`
- Does NOT persist the new ABV as the tile default — that requires Settings
- Cancel dismisses without logging

Implementation in `App.jsx` `useLongPress({ onLong, ms = 500 })` hook. The hook returns pointer events + a click-wrapper; the wrapper suppresses the synthetic click that follows a long-press so the same gesture never both opens the modal and logs a default drink. The wider `onContextMenu: preventDefault` stops mobile Safari from popping the text-selection bubble during a long-press.

### Tile reorder migration

`units.js` `migrate()` runs once when settings are loaded. If the stored `tiles` array exactly matches the old default `[pot, pint, bottle]` with default ml/ABV, it's replaced with the new default `[pot, bottle, pint]`. Customized stores (and any store with a tile count ≠ 3) are left alone.

## "More ▾" dropdown (extra tiles)

When `settings.tiles` has more than `HOME_TILES` (3) entries, a native `<select>` is rendered in the action row, left of "+ Custom" and "Alco free day" (the row switches from 2 to 3 columns). It is omitted entirely when there are ≤ 3 tiles.

- The closed control shows the placeholder `More ▾` (a disabled `value=""` option).
- Options are `settings.tiles.slice(HOME_TILES)`, each labelled `<label> · <ml>ml <abv>%`.
- The select is **controlled with `value=""`**: choosing an option fires `onChange` → logs that tile via `quickAdd(tile)` on the current `viewDate`, then snaps the control straight back to the placeholder (so the same drink can be picked again).
- Dropdown tiles log their defaults; the long-press ABV override is a Home-button-only affordance.

## Alco free day

Button on the Home screen, next to "+ Custom". Logs a sentinel entry on `viewDate`:

```js
{ name: 'Free day', ml: 0, abv: 0, units: 0, freeDay: true, at: <viewDate-noon or serverTimestamp> }
```

The internal `name: 'Free day'` and `freeDay: true` fields are kept on disk for back-compat. The user-facing label is **"Alco free day"** (renamed for clarity). Predicate helpers `isFreeDay()` / `isReal()` still match the same shape.

### Celebration animation

Clicking the Alco free day button triggers a **`Celebration`** overlay:

- 16 emoji particles (🎉 ✨ 🥳 ⭐ 💚 🌿 🎊 🙌) randomly placed across the screen, each floating upward and fading via the `floatUp` CSS keyframe
- A central white `✓` pulses in via `burstPulse`
- Overlay is `pointer-events-none z-30`, auto-dismisses after 1.9s

Keyframes live in `src/index.css`. The component re-randomises particle positions on each mount.

### Button colour — burnt gold

| State | Style |
|---|---|
| Active (`viewDate` has no real drinks, not yet marked) | `bg-yellow-700/30 hover:bg-yellow-700/40 text-yellow-100` |
| Marked (free-day entry already exists on `viewDate`) | `bg-yellow-700/40 text-yellow-200 cursor-default` |
| Disabled (real drinks already logged on `viewDate`) | `bg-white/5 text-white/30 cursor-not-allowed` |

The burnt-gold theme also colours free-day cells in the home heatmap and the Cal grid (`bg-yellow-700/30` + gold `✓`), so "alco free day" reads as a single visual concept across the app.

### State machine

| viewDate's entries | Button label | Enabled? |
|---|---|---|
| no real drinks, no free-day marker | "Alco free day" | yes |
| no real drinks, has free-day marker | "Alco free day ✓" | no (already marked) |
| any real drinks | "Alco free day" | no (greyed out) |

## Custom drink

Triggered by the "+ Custom" button. Opens the `DrinkModal` with `showDate` enabled and initial values `{ name: '', ml: 330, abv: 5, at: <viewDate-noon or now> }`.

Save → adds to drinks with `units = calcUnits(ml, abv)` and the modal's chosen date.

## Units formula

UK standard unit = 10ml of pure alcohol.

```
units = (ml × abv%) / 1000
```

Implemented in `units.js` `calcUnits(ml, abv)`. Recomputed on every save (never stored stale).

Display formatting via `fmtUnits(n)` — always 1 decimal place (`2.8`, `0.0`, `10.5`).

## Drink-row component (`DrinkRow`)

Both Home lists below render through a shared `DrinkRow` component. It takes `{ d, showDay, onEdit, onDelete }`:

- Real drink: `name · ml · ABV%` + subline + Edit + Delete
- Free-day marker: `Alco free day ✓` (gold, `text-yellow-200`) + subline + Delete only (no Edit)
- Subline: `HH:MM · X.Xu` when `showDay` is false; `<DayLabel> · HH:MM · X.Xu` when true (free-day markers omit the `· X.Xu`)

`<DayLabel>` is computed by `dayLabelFor(date)`:
- Today → `Today`
- Yesterday → `Yesterday`
- Otherwise → `Sat 6 Jun` (short weekday + day + short month)

## Active-day list (Home screen)

Section above "Recent drinks". Header reads **"Today's drinks"** when `viewDate` is today, otherwise `"<selectedLabel>'s drinks"` (e.g. `Mon 15 Jun's drinks`).

Source: `viewDay` — all entries (real + free-day markers) dated on the selected `viewDate`, in `at`-desc order. Rendered with `DrinkRow showDay={false}` (the day is implied by the header, so only the time shows).

This is the primary affordance for editing a specific day: tap a cell in the rolling-7 heatmap (or a day in Cal) to set `viewDate`, then edit/delete that day's entries here.

Empty state: `"Nothing logged yet."` when `viewDate` is today, else `"Nothing logged."`.

## Recent drinks list (Home screen)

Section header: **"Recent drinks"**, below the active-day list. Global, not viewDate-scoped.

Source: `drinks.slice(0, 5)` (drinks come from the subscription sorted by `at` desc). Rendered with `DrinkRow showDay` so each row carries its `<DayLabel>` prefix.

Empty state: if no drinks at all, show either `"N alcohol-free days so far."` (if streak > 0) or `"Nothing logged yet."`.

## Edit flow

Edit opens `DrinkModal` with `showDate` enabled and `initial={drink}`. Editable fields:

- Name (optional)
- Size (ml)
- ABV (%)
- **Date** — `<input type="date">` capped at today; preserves the original time of day when saving

On save, calls `update(dataUid, id, { name, ml, abv, units, at })`. `units` is always recomputed from the new ml/abv.

Free-day entries cannot be edited (the Edit button is hidden in the recent list).

## Delete flow

No confirmation. Optimistic UI via Firestore (or localStorage) subscription — the list updates as soon as the backend acknowledges.

## Data shape

```js
{
  id: string,         // UUID
  name: string|null,  // tile label or custom name; 'Free day' on markers (kept for back-compat)
  ml: number,         // 0 for free-day markers
  abv: number,        // 0 for free-day markers
  units: number,      // 0 for free-day markers; recomputed on every write otherwise
  freeDay?: boolean,  // true on free-day markers
  at: Date            // explicit Date passed for past-day logs / edits; otherwise serverTimestamp on the backend
}
```

## Backend write contract

`firebase.js` `addDrink(uid, drink)`:
- If `drink.at` is a `Date`, that value is stored (Firestore converts to `Timestamp`)
- Otherwise `at` defaults to `serverTimestamp()`

`firebase.js` `updateDrink(uid, id, patch)`: merge-set; any `at` in `patch` overrides the stored value.

`store.js` local mode follows the same contract.
