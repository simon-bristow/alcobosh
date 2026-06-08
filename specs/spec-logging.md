# Spec — Logging drinks

Covers quick-add tiles (with long-press for one-off ABV), free-day marker (with celebration), custom-drink modal, units calculation, edit/delete of existing entries (including date), and the global Recent-drinks list.

## Quick-add tiles

Three tiles rendered on the Today screen. Each is a single tap → one drink logged with the tile's `ml` + `abv` defaults and `name = tile.label`. The entry's `at` defaults to:

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

`units.js` `migrate()` runs once when settings are loaded. If the stored `tiles` array exactly matches the old default `[pot, pint, bottle]` with default ml/ABV, it's replaced with the new default `[pot, bottle, pint]`. Customized stores are left alone.

## Free day

Button on the Today screen, next to "+ Custom". Logs a sentinel entry on `viewDate`:

```js
{ name: 'Free day', ml: 0, abv: 0, units: 0, freeDay: true, at: <viewDate-noon or serverTimestamp> }
```

### Celebration animation

Clicking the Free Day button triggers a **`Celebration`** overlay:

- 16 emoji particles (🎉 ✨ 🥳 ⭐ 💚 🌿 🎊 🙌) randomly placed across the screen, each floating upward and fading via the `floatUp` CSS keyframe
- A central white `✓` pulses in via `burstPulse`
- Overlay is `pointer-events-none z-30`, auto-dismisses after 1.9s

Keyframes live in `src/index.css`. The component re-randomises particle positions on each mount.

### State machine

| viewDate's entries | Button label | Enabled? | Style |
|---|---|---|---|
| no real drinks, no free-day marker | "Free day" | yes | `bg-orange-700/30 hover:/40 text-orange-100` |
| no real drinks, has free-day marker | "Free day ✓" | no (already marked) | `bg-orange-700/40 text-orange-200 cursor-default` |
| any real drinks | "Free day" | no (greyed out) | `bg-white/5 text-white/30 cursor-not-allowed` |

The button uses dark orange as a deliberate non-emerald colour so it doesn't blend into the green quick-add tiles or the green "Free day ✓" badge inside the Day Total card. The celebration animation still uses mixed emoji including green hearts/leaves.

The Day Total card also shows a small green "Free day ✓" line below the bar when the marker exists and no real drinks have been logged on that day.

`isFreeDay(drink)` and `isReal(drink)` helpers in `units.js` are the canonical predicates. Free-day entries never contribute to weekly/daily unit totals.

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

## Recent drinks list (Today screen)

Section header: **"Recent drinks"** (not "Today's drinks" — global, not viewDate-scoped).

Source: `drinks.slice(0, 5)` (drinks come from the subscription sorted by `at` desc).

Each row shows:
- Real drink: `name · ml · ABV%` + `<DayLabel> · HH:MM · X.Xu` + Edit + Delete
- Free-day marker: `Free day ✓` (green) + `<DayLabel> · HH:MM` + Delete only (no Edit)

`<DayLabel>` is computed by `dayLabelFor(date)`:
- Today → `Today`
- Yesterday → `Yesterday`
- Otherwise → `Sat 6 Jun` (short weekday + day + short month)

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
  name: string|null,  // tile label or custom name; 'Free day' for markers
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
