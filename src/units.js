// UK standard unit: 10ml of pure alcohol.
// units = (ml × abv%) / 1000
export function calcUnits(ml, abv) {
  return (ml * abv) / 1000
}

export function fmtUnits(n) {
  return (Math.round(n * 10) / 10).toFixed(1)
}

// Monday-start week. Returns { start, end } as Date objects (local time).
export function weekBounds(d = new Date()) {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function isoDate(d) {
  return startOfDay(d).toISOString().slice(0, 10)
}

// A "free day" marker is a drinks entry with units === 0 and freeDay === true.
// Doesn't count against caps and counts as an alcohol-free day for the streak.
export function isFreeDay(drink) {
  return drink?.freeDay === true || (drink?.units === 0 && drink?.name === 'Free day')
}

export function isReal(drink) {
  return !isFreeDay(drink) && (drink?.units ?? 0) > 0
}

// Returns count of consecutive alcohol-free days ending yesterday (or today
// if no real drinks today). Free-day markers do NOT break the streak.
export function afStreak(drinks, today = new Date()) {
  const daysWithRealDrinks = new Set(
    drinks.filter(isReal).map((d) => isoDate(d.at)),
  )
  const cursor = startOfDay(today)
  if (daysWithRealDrinks.has(isoDate(cursor))) return 0
  let count = 0
  const c = new Date(cursor)
  while (true) {
    c.setDate(c.getDate() - 1)
    if (daysWithRealDrinks.has(isoDate(c))) break
    count++
    if (count > 365) break
  }
  return count
}

export const DEFAULT_TILES = [
  { id: 'pot', label: 'Pot', ml: 285, abv: 5.0 },
  { id: 'bottle', label: 'Bottle', ml: 330, abv: 5.0 },
  { id: 'pint', label: 'Pint', ml: 568, abv: 5.0 },
]

// Up to this many quick-add tiles can be configured. The first 3 (HOME_TILES)
// render as buttons on Home; the rest appear in the Home "More" dropdown.
export const MAX_TILES = 10
export const HOME_TILES = 3

export function makeTile() {
  return { id: crypto.randomUUID(), label: 'Drink', ml: 330, abv: 5 }
}

export const DEFAULT_SETTINGS = {
  weeklyCap: 10,
  dailyWarn: 2,
  tiles: DEFAULT_TILES,
}

const SETTINGS_KEY = 'alcbosh:settings'

// One-time migration: if the user's stored tile order matches the OLD default
// (pot, pint, bottle) exactly, replace it with the new default (pot, bottle, pint).
function migrate(settings) {
  const tiles = settings.tiles
  if (!Array.isArray(tiles) || tiles.length !== 3) return settings
  const oldOrder = ['pot', 'pint', 'bottle']
  const idsMatchOld = tiles.every((t, i) => t.id === oldOrder[i])
  const stillDefaultMl = tiles[0].ml === 285 && tiles[1].ml === 568 && tiles[2].ml === 330
  const stillDefaultAbv = tiles.every((t) => t.abv === 5.0)
  if (idsMatchOld && stillDefaultMl && stillDefaultAbv) {
    return { ...settings, tiles: DEFAULT_TILES }
  }
  return settings
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return migrate({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// Sum of real-drink units per day, keyed by ISO date (YYYY-MM-DD).
export function unitsByDay(drinks) {
  const m = {}
  drinks.forEach((d) => {
    if (!isReal(d)) return
    const k = isoDate(d.at)
    m[k] = (m[k] || 0) + (d.units || 0)
  })
  return m
}

export function freeDaysByDay(drinks) {
  const m = {}
  drinks.forEach((d) => {
    if (!isFreeDay(d)) return
    m[isoDate(d.at)] = true
  })
  return m
}

// Stats over an explicit inclusive [start, end] date range.
// total/avg/high/low are in units; drinkingDays/afDays are counts.
// `high`/`low` are the peak and lowest single-day totals among drinking days
// (days with units > 0); both 0 when there were no drinking days.
// `afDays` counts every day in the range with zero real units.
export function rangeStats(drinks, start, end) {
  const unitsMap = unitsByDay(drinks)
  const s = startOfDay(start)
  const e = startOfDay(end)
  const days = Math.max(0, Math.round((e - s) / 86400000) + 1)
  let total = 0
  let drinkingDays = 0
  let high = 0
  let low = Infinity
  const cur = new Date(s)
  for (let i = 0; i < days; i++) {
    const u = unitsMap[isoDate(cur)] || 0
    total += u
    if (u > 0) {
      drinkingDays++
      if (u > high) high = u
      if (u < low) low = u
    }
    cur.setDate(cur.getDate() + 1)
  }
  return {
    days,
    total,
    avg: days > 0 ? total / days : 0,
    high: drinkingDays > 0 ? high : 0,
    low: drinkingDays > 0 ? low : 0,
    drinkingDays,
    afDays: days - drinkingDays,
  }
}

// Rolling-window stats over the last `days` calendar days (inclusive of today).
export function windowStats(drinks, days, today = new Date()) {
  const end = startOfDay(today)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return rangeStats(drinks, start, end)
}

// Earliest dated entry (real or free-day), as a startOfDay; null if none.
export function firstDrinkDate(drinks) {
  let min = null
  drinks.forEach((d) => {
    if (!d.at) return
    if (!min || d.at < min) min = d.at
  })
  return min ? startOfDay(min) : null
}

// Picks a chart bucket granularity from the range length in days.
export function pickGranularity(days) {
  if (days <= 35) return 'day'
  if (days <= 100) return 'week'
  return 'month'
}

// Buckets real-unit totals across [start, end] at day/week/month granularity.
// Returns [{ start: Date, key, label, value }] in chronological order.
export function bucketUnits(drinks, start, end, granularity) {
  const unitsMap = unitsByDay(drinks)
  const s = startOfDay(start)
  const e = startOfDay(end)
  const bucketStart = (d) => {
    if (granularity === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
    if (granularity === 'week') return weekBounds(d).start
    return startOfDay(d)
  }
  const labelOf = (d) =>
    granularity === 'month'
      ? d.toLocaleDateString(undefined, { month: 'short' })
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

  const buckets = []
  let curKey = null
  const cur = new Date(s)
  while (cur <= e) {
    const bs = bucketStart(cur)
    const key = isoDate(bs)
    if (key !== curKey) {
      buckets.push({ start: bs, key, label: labelOf(bs), value: 0 })
      curKey = key
    }
    buckets[buckets.length - 1].value += unitsMap[isoDate(cur)] || 0
    cur.setDate(cur.getDate() + 1)
  }
  return buckets
}
