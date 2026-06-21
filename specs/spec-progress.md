# Spec — Rolling 7-day block, AF Streak

Covers the top panel of the Home screen — a 7-day window with heatmap that can be navigated backward, plus the alcohol-free-day streak.

The Last 30 days total used to live here too — it now lives on the Cal screen (`spec-calendar.md`).

Free-day markers ("Alco free days" in UI) are filtered out of all unit totals — they only affect the streak and the inline gold "✓" cell badge.

## Rolling 7-day block

One card with three rows of content.

### Row 1 — window navigation

| Element | Behavior |
|---|---|
| `←` | Always enabled. Shifts `windowEnd` back 7 days (no backward limit). |
| Label | `Last 7 days` when `windowEnd === today`. Otherwise `7 days to <D MMM>`. Clickable when not on the current window → resets `windowEnd` to today. |
| `→` | Shown **only** when `windowEnd !== today` (i.e. after going back). Shifts `windowEnd` forward 7 days, clamped so it never lands past today. When on the current window the slot is an empty `w-9` spacer instead. |

`windowEnd` is a piece of state in `App.jsx` (default `startOfDay(today)`). Forward navigation (via `→` or the jump-to-current label) is clamped to today — the window can never show future days.

### Row 2 — 7-day total

`7-day total` label on the left, `X.X / N units` on the right. Compared against `settings.weeklyCap`.

The progress bar (`<Bar>`) uses the standard `ok/warn/over` colour thresholds based on the 7-day total vs the weekly cap.

### Row 3 — heatmap

Visually matched to the Cal month grid (`spec-calendar.md`) for consistency: a weekday-letter header row above a row of `aspect-square` cells, with the date number inside each cell and units/✓ below.

**Weekday header** — 7 letters in a `grid-cols-7`, computed per cell from each day's actual weekday (`['S','M','T','W','T','F','S'][date.getDay()]`), so they rotate as the window shifts.

**Cells** — 7 cells, chronological order: `windowEnd − 6` on the left through `windowEnd` on the right. Same colour ramp and content as the Cal cells:

| Condition | Background | Number colour |
|---|---|---|
| `u >= dailyWarn` | `bg-red-500/40` | `text-white` |
| `0 < u < dailyWarn` | `bg-emerald-500/30` | `text-white` |
| `u == 0 && free` | `bg-yellow-700/30` (burnt gold) | `text-yellow-200` |
| empty | `bg-white/5` | `text-white/80` |

Cell content (stacked, centered):
- Date number (`date.getDate()`, `text-xs`) on top — always shown
- Below: `fmtUnits(u)` (`text-[10px]`, colour-matched to the background) when `u > 0`; or a `text-yellow-200` `✓` when `free`; else blank

Rings:
- `ring-2 ring-white/40` for the cell whose date equals `viewDate`
- `ring-1 ring-white/20` for today (when in window and not selected)
- `hover:ring-2 hover:ring-white/30` on all cells

The only deviations from the Cal grid: there are never future cells (the window ends at `windowEnd ≤ today`), and Home keeps the selected-`viewDate` ring (Cal rings today only). The previous brighter-fill / intensity-opacity styling and the per-cell `M 15` label were dropped in favour of this shared look.

Tapping a cell sets `viewDate`. The 7-day window does NOT slide on cell tap — only the explicit ← / → arrows / jump-to-current label move it.

## "Logging on …" banner

When `viewDate !== today`, a small amber pill is shown above the action buttons:

> Logging on **Mon 17 Jun** — tap to switch to today

Tap calls `onJumpToToday` and resets `viewDate` to today.

## AF-day streak

Counts consecutive alcohol-free days **ending at most yesterday** (or today if it's still alcohol-free). Implementation in `units.js` `afStreak()`:

1. Build `daysWithRealDrinks` set from `drinks.filter(isReal)` keyed by ISO date — free-day markers are NOT included here, so explicitly-marked alco-free days extend the streak.
2. If today has any real drink → return 0.
3. Walk backwards day-by-day; stop when a day has any real drink.
4. Cap iterations at 365.

**Display rules** (only when viewing today, i.e. `isViewingToday`):
- If `recent.length === 0`, the empty-state shows `"N alcohol-free days so far."`
- Large emerald hero card at the bottom of Home when `streak > 0 && viewDayReal.length === 0`

If the user logs a real drink today, the streak resets to 0 (until tomorrow).

## Bar component

Single `<Bar pct={...} state={'ok'|'warn'|'over'} />`. Background track is `bg-white/10`; fill transitions width via Tailwind's `transition-all`.
