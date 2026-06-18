# Spec — Rolling 7-day block, Last 30 days, AF Streak

Covers the panels at the top of the Home screen — a rolling 7-day total with heatmap, the last-30-day total, and the alcohol-free-day counter.

The earlier "Day panel" (with prev/next day arrows and the daily-warn bar) was removed; the rolling heatmap is the single source of per-day state on Home. The "viewDate" concept is preserved but is now only set implicitly (tap a cell, or pick a day in Cal); it controls which date new entries are logged against.

Free-day markers are filtered out of all unit totals — they only affect the streak and the inline "✓" cell badge.

## Rolling 7-day block (top)

One card with:

- **Header**: `Last 7 days` on the left, `X.X / N units` on the right (always compared against `settings.weeklyCap`).
- **Bar**: same `<Bar pct={...} state={...} />` component; states use the weekly thresholds (`>= cap` red, `>= 0.75 × cap` amber, else emerald).
- **Heatmap**: 7 cells in chronological order — `today − 6` on the left through `today` on the right. The window does NOT slide — it's always anchored at today.

### Cell rendering

| Condition | Background |
|---|---|
| `u >= dailyWarn` | `bg-red-500/70` |
| `0 < u < dailyWarn` | `bg-emerald-500` (opacity `0.3 → 1.0` by intensity) |
| `u == 0 && free` | `bg-emerald-500/15` |
| empty | `bg-white/5` |

- Ring `ring-2 ring-white/40` for the cell whose date equals `viewDate`
- Ring `ring-1 ring-white/20` for today (subtler, so it's still findable when a past day is selected)
- All cells are clickable: tap sets `viewDate` to that day. The window does not shift; the ring moves.

Cell content:
- `u > 0` → white `fmtUnits(u)` text
- `free && u === 0` → emerald `✓`
- else → blank

Day-of-week letter (`M/T/W/T/F/S/S`) is computed per cell from the date — it rotates as the calendar advances.

## "Logging on …" banner

When `viewDate !== today`, a small amber pill is shown above the action buttons:

> Logging on **Mon 17 Jun** — tap to switch to today

Tap calls `onJumpToToday` and resets `viewDate` to today. This is the single explicit indicator that subsequent quick-add / custom / free-day actions will land on a date other than today.

When `viewDate === today` the banner is hidden.

## Last 30 days card

A single full-width card below the rolling-7 block:

- `Last 30 days` label on the left
- `X.X u` total on the right (real drinks only, last 30 calendar days inclusive of today)

The previous "Last 7 days" stat card was removed — it's redundant with the new rolling-7 block's header total.

## AF-day streak

Counts consecutive alcohol-free days **ending at most yesterday** (or today if it's still alcohol-free). Implementation in `units.js` `afStreak()`:

1. Build `daysWithRealDrinks` set from `drinks.filter(isReal)` keyed by ISO date — free-day markers are NOT included here, so explicitly-marked free days extend the streak.
2. If today has any real drink → return 0.
3. Walk backwards day-by-day; stop when a day has any real drink.
4. Cap iterations at 365.

**Display rules** (only when viewing today, i.e. `isViewingToday`):
- If `recent.length === 0`, the empty-state shows `"N alcohol-free days so far."`
- Large emerald hero card at the bottom of Home when `streak > 0 && viewDayReal.length === 0`

If the user logs a real drink today, the streak resets to 0 (until tomorrow).

## Bar component

Single `<Bar pct={...} state={'ok'|'warn'|'over'} />`. Background track is `bg-white/10`; fill transitions width via Tailwind's `transition-all`.
