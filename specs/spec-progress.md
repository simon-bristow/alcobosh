# Spec — Day, Week, Rolling Totals, AF Streak panels

Covers the stacked panels on the Home screen — the selected-day total (with prev/next nav), the combined week block (total + clickable 7-day heatmap), the rolling 7-day / 30-day totals, and the alcohol-free-day counter.

Free-day markers are filtered out of all unit totals — they only affect the streak and the inline "Free day ✓" indicator.

## Day panel (top)

Renders a card with:

- **Prev / Next arrows** (`←` / `→`) flanking the day label
- **Day label** — `Today` / `Yesterday` / `Sat 6 Jun` (short weekday + day + short month). Clickable when not on today → jumps to today.
- **Day total** — sum of real units on the selected day vs `settings.dailyWarn`
- **Bar** color state (same thresholds as week):
  - `dayUnits >= dailyWarn` → red
  - `dayUnits >= dailyWarn × 0.75` → amber
  - else → emerald
- Inline messages below the bar:
  - over → `Over daily limit.` (red)
  - warn → `Approaching daily limit.` (amber)
  - free-day marker exists & no real drinks → `Free day ✓` (emerald)

Next arrow disabled when `viewDate === today` (no future browsing).

## Combined week block

One card containing the week-navigation row, weekly total, and the 7-day heatmap of the visible week.

### Header (week navigation)

Three buttons in a row, matching the Day panel pattern:

- **Prev arrow** (`←`) — always enabled; shifts `viewDate` by −7 days
- **Week label** — `This week` (when viewDate is in the current week) OR `Week of D MMM` (otherwise). Clickable when not on the current week → jumps `viewDate` to today's start.
- **Next arrow** (`→`) — disabled when `viewDate` is in the current week; shifts `viewDate` by +7 days, clamping to today if the new value would be in the future

Implemented via `shiftWeek(delta)` in `App.jsx` — same shape as `shiftDay`, but multiplies the delta by 7. Forward jumps clamp to today: if today is Thu and viewDate is the prior Fri, `shiftWeek(+1)` lands on today (Thu), not the next Fri.

### Sub-header (week total)

Below the nav row: `Week total` label on the left, `X.X / N units` on the right (real units only).

### Bar

Single `<Bar pct={...} state={...} />`. Same color thresholds as the day bar but scaled to `settings.weeklyCap`.

### 7-day heatmap (clickable)

7 columns Mon–Sun. Each cell is a `<button>` that, when tapped, calls `onPickDay(day)` → updates `viewDate` so the Day panel and week heatmap re-anchor to the selected day. Future days are disabled.

Visual rules per cell:

| Condition | Background |
|---|---|
| `u >= dailyWarn` | `bg-red-500/70` |
| `0 < u < dailyWarn` | `bg-emerald-500` (opacity ramps `0.3 → 1.0` by intensity) |
| `u == 0 && free` | `bg-emerald-500/15` |
| empty | `bg-white/5` |
| future | additional `opacity-30 cursor-default` |
| selected `viewDate` | additional `ring-2 ring-white/40` |
| hover (non-future) | `hover:ring-2 hover:ring-white/30` |

Cell content:
- If `u > 0` → `fmtUnits(u)` rendered inside the cell in white text (`text-[11px] font-medium`).
- Else if `free` → emerald `✓`.
- Else → empty.

The day-of-week letter (`M T W T F S S`) sits below each cell as a small label.

Tooltip: `<Date>: X.Xu | Free day | no entry`.

## Rolling totals row (below the week block)

Two side-by-side cards, both showing real-drink totals only:

| Card | Window |
|---|---|
| Last 7 days | drinks where `at >= startOfDay(now − 6 days)` (7 days inclusive of today) |
| Last 30 days | drinks where `at >= startOfDay(now − 29 days)` (30 days inclusive of today) |

These are **global** — they don't follow `viewDate`. They always show rolling activity from "now". Computed in `App.jsx` `rolling` memo and passed into Home as `{ t7, t30 }`.

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
