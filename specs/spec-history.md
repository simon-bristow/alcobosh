# Spec — History / Trends screen

Charts of alcohol consumption over time for a chosen date range, with a stats table for that range below. Reached via the **"Trends"** nav tab (`screen === 'history'`).

## Range selector

A row of preset chips plus an optional custom range:

| Preset | Range (end = today) |
|---|---|
| 30 days | today − 29 days |
| 3 months | today − 3 calendar months |
| 6 months | today − 6 calendar months |
| 12 months | today − 12 calendar months |
| All time | from the earliest dated entry (`units.js` `firstDrinkDate`), or today if none |
| Custom | two `<input type="date">` (from / to); reordered if from > to, end capped at today |

Default preset is **6 months**. Preset state + `customStart`/`customEnd` strings live in the `History` component. The active chip is highlighted emerald.

## Chart (`BarChart`)

A bar chart of **real-unit totals per bucket** across the range. Granularity is auto-picked by range length (`units.js` `pickGranularity`):

- `≤ 35 days` → **day** buckets
- `≤ 100 days` → **week** buckets (Monday-aligned)
- else → **month** buckets

Buckets come from `units.js` `bucketUnits(drinks, start, end, granularity)` → `[{ start, key, label, value }]` in chronological order.

Rendering (HTML/flex bars, no chart lib):
- Bars are `flex-1` so they fill the width; height = `value / max × 100%` (min 2% when non-zero). `max = max(1, …bucket values)`.
- Bar colour is `bg-emerald-500/70`, or `bg-red-500/70` when the bucket exceeds the cap.
- **Cap line**: a dashed horizontal line at the cap for day buckets (`settings.dailyWarn`) and week buckets (`settings.weeklyCap`); none for month buckets.
- X-axis labels are sparse — every `ceil(n / 6)`-th bucket label is shown.
- Footer: `peak X.Xu · cap X.Xu` on the left, `N days|weeks|months` on the right.
- Empty range → "No data in this range."

The card header shows the range total (`X.X units`), the granularity (`by day|week|month`), and the literal date span (`D MMM YYYY – D MMM YYYY`).

## Stats table

Below the chart, the shared `StatsTable` (see `spec-calendar.md`) is rendered with a **single column** for the selected range:

```
columns={[{ key: 'range', header: <preset label or "Range">, stats: rangeStats(drinks, start, end) }]}
caption="For the selected range."
```

`units.js` `rangeStats(drinks, start, end)` returns the same shape as `windowStats` (`{ days, total, avg, high, low, drinkingDays, afDays }`) so the same table renders Total / Daily average / Highest day / Lowest day / Drinking days / Alco-free days. `Drinking days` / `Alco-free days` denominators use `stats.days` (the range length).

## Shared helpers (`units.js`)

- `rangeStats(drinks, start, end)` — inclusive-range aggregate (also the basis for `windowStats`, which is now `rangeStats` over the last N days).
- `bucketUnits(drinks, start, end, granularity)` — per-bucket real-unit totals.
- `pickGranularity(days)` — day/week/month selector.
- `firstDrinkDate(drinks)` — earliest entry date (for All time).

## Future enhancements (not implemented)

- Toggle metric (units vs drinking-days vs AF-days)
- Overlay a moving average / trend line
- Tap a bar to drill into that bucket
- Export the range as CSV
