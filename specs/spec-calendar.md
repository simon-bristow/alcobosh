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

## Summary card

Below the grid:

- **Last 30 days** — sum of real units across the last 30 days inclusive of today (anchored at today, not the displayed month). Survives month boundary changes.
- **Month total** — sum of real units in the displayed month only.
- **Drinking days (month)** — count of distinct dates in the displayed month with `u > 0`.
- **Alco free days (month)** — count of distinct dates with `free && !(u > 0)` in the displayed month (a real drink supersedes a free-day marker).

The Last 30 days figure is passed in from `App.jsx` (`last30` memo). The rest is computed locally from the `cells` array.

## Source helpers

`units.js`:
- `unitsByDay(drinks)` → `{ [isoDate]: number }` — sums real drink units per day
- `freeDaysByDay(drinks)` → `{ [isoDate]: true }` — set of free-day dates

Both filter via the canonical `isReal` / `isFreeDay` predicates.

## Future enhancements (not implemented)

- Swipe-left/right between months
- Pagination of months in a year-overview ribbon
- Multi-month statistics view
