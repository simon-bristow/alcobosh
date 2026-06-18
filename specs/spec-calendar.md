# Spec — Calendar view

Month grid showing total units consumed per day, with alco-free-day markers and at-a-glance stats. Accessed via the "Cal" header tab.

## Layout

```
←   <Month YYYY>   →

M T W T F S S
[grid of day cells, 5–6 rows]

[summary card]
  Last 30 days             X.Xu
  Month total              X.Xu
  Drinking days (month)    N
  Alco free days (month)   N
```

## Month navigation

- `← / →` buttons step by one calendar month
- `→` is **disabled** when viewing the current month (no future browsing)
- Initial month = current month at mount

## Grid layout

- Monday-start (matches the rest of the app)
- 7 columns; rows pad to multiples of 7 with blank cells for leading/trailing days
- Each day cell is `aspect-square` so the grid scales with the container

## Day cell rendering

For each real calendar day, compute:
- `u = unitsByDay(drinks)[isoDate]` — sum of real drink units
- `free = freeDaysByDay(drinks)[isoDate]` — boolean, true if a free-day marker exists that day
- `isToday`, `future` from a single `today = new Date()` reference

**Background colour** (in priority):

| Condition | bg |
|---|---|
| `u >= settings.dailyWarn` | `bg-red-500/40` |
| `u > 0` | `bg-emerald-500/30` |
| free marker only | `bg-yellow-700/30` (burnt gold) |
| otherwise | `bg-white/5` |

**Text inside the cell**:
- Day number (always)
- Below: `fmtUnits(u)` if `u > 0`
- Below: gold `✓` (`text-yellow-200`) if `free && !u && !future`
- Future days: text fades to `text-white/20`

**Today**: cell gets `ring-2 ring-white/40` to highlight.

**Tap**: each non-future day cell is a `<button>`; tap calls `onPickDay(date)` → updates `viewDate` and switches `screen` back to `home`.

**Tooltip**: `<Date>: X.Xu | Alco free day | No entry`.

## Stats table (`StatsTable`)

Below the grid, a two-column comparison table — **7 days** vs **30 days** — both rolling windows anchored at today (not the displayed month). Rendered by the `StatsTable` component from two `windowStats()` results (`stats7`, `stats30`), computed in `Calendar` via `useMemo`.

Layout is a `grid-cols-[1fr_4.5rem_4.5rem]`: a label column plus two right-aligned, `tabular-nums` value columns. Header row reads `Stats | 7 days | 30 days`.

Rows:

| Row | Value | Notes |
|---|---|---|
| Total | `X.Xu` | sum of real units in the window |
| Daily average | `X.Xu` | `total / days` (averaged across **all** calendar days in the window, not just drinking days) |
| Highest day | `X.Xu` or `—` | peak single-day total among drinking days; `—` when no drinking days. Coloured red when `>= settings.dailyWarn`. |
| Lowest day | `X.Xu` or `—` | lowest single-day total among drinking days (excludes zero days); `—` when none |
| Drinking days | `N / 7` or `N / 30` | days with `u > 0` |
| Alco-free days | `N / 7` or `N / 30` | days with zero real units (`days − drinkingDays`); coloured burnt gold (`text-yellow-200`) |

Caption below: *"Rolling windows ending today."*

The previous month-scoped summary (Month total / Drinking days (month) / Alco free days (month)) was replaced by this rolling table.

## Source helpers

`units.js`:
- `unitsByDay(drinks)` → `{ [isoDate]: number }` — sums real drink units per day
- `freeDaysByDay(drinks)` → `{ [isoDate]: true }` — set of free-day dates
- `windowStats(drinks, days, today?)` → `{ days, total, avg, high, low, drinkingDays, afDays }` — rolling-window aggregate over the last `days` calendar days inclusive of today. `high`/`low` are peak/lowest **drinking-day** totals (both `0` when no drinking days); `afDays = days − drinkingDays`.

All filter via the canonical `isReal` / `isFreeDay` predicates.

## Future enhancements (not implemented)

- Swipe-left/right between months
- Pagination of months in a year-overview ribbon
- Multi-month statistics view
