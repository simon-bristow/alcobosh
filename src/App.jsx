import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  calcUnits,
  fmtUnits,
  sameDay,
  startOfDay,
  isoDate,
  afStreak,
  loadSettings,
  saveSettings,
  isReal,
  isFreeDay,
  unitsByDay,
  freeDaysByDay,
  windowStats,
  rangeStats,
  bucketUnits,
  pickGranularity,
  firstDrinkDate,
  makeTile,
  MAX_TILES,
  HOME_TILES,
} from './units'
import { initStore, subscribe, add, update, remove, isConfigured, startPair, completePair } from './store'

export default function App() {
  const [session, setSession] = useState(null)
  const [drinks, setDrinks] = useState([])
  const [settings, setSettings] = useState(loadSettings())
  const [screen, setScreen] = useState('home') // home | calendar | settings
  const [customOpen, setCustomOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [abvEditTile, setAbvEditTile] = useState(null)
  const [viewDate, setViewDate] = useState(() => startOfDay(new Date()))
  const [windowEnd, setWindowEnd] = useState(() => startOfDay(new Date()))
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    const unsub = initStore(setSession)
    return unsub
  }, [])

  useEffect(() => {
    if (!session) return
    const unsub = subscribe(session.dataUid, setDrinks)
    return unsub
  }, [session])

  const now = new Date()
  const isViewingToday = sameDay(viewDate, now)

  // Returns the timestamp to use for a new entry. Today → undefined so the
  // backend uses serverTimestamp(). Past days → noon on that day.
  function entryTimestamp() {
    if (isViewingToday) return undefined
    const at = new Date(viewDate)
    at.setHours(12, 0, 0, 0)
    return at
  }

  const viewDay = useMemo(() => drinks.filter((d) => sameDay(d.at, viewDate)), [drinks, viewDate])
  const viewDayReal = viewDay.filter(isReal)
  const viewDayFreeMarker = viewDay.find(isFreeDay)
  const streak = useMemo(() => afStreak(drinks, now), [drinks])

  // 5 most recent drinks (drinks are returned sorted at desc by the subscription).
  const recent = useMemo(() => drinks.slice(0, 5), [drinks])

  // Rolling 7-day window: 7 cells ending at windowEnd (default today).
  const rolling7 = useMemo(() => {
    const unitsMap = unitsByDay(drinks)
    const freeMap = freeDaysByDay(drinks)
    const end = startOfDay(windowEnd)
    const days = []
    let total = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const k = isoDate(d)
      const u = unitsMap[k] || 0
      total += u
      days.push({ date: d, units: u, free: !!freeMap[k] })
    }
    return { days, total, end }
  }, [drinks, windowEnd])

  const today = startOfDay(now)
  const isCurrent7 = sameDay(windowEnd, today)

  function shiftWindowBack() {
    const next = new Date(windowEnd)
    next.setDate(next.getDate() - 7)
    next.setHours(0, 0, 0, 0)
    setWindowEnd(next)
  }

  function shiftWindowForward() {
    const next = new Date(windowEnd)
    next.setDate(next.getDate() + 7)
    next.setHours(0, 0, 0, 0)
    const todayStart = startOfDay(new Date())
    setWindowEnd(next > todayStart ? todayStart : next)
  }

  function jumpToCurrent7() {
    setWindowEnd(startOfDay(new Date()))
  }

  async function quickAdd(tile, abvOverride) {
    if (!session) return
    const abv = abvOverride ?? tile.abv
    await add(session.dataUid, {
      name: tile.label,
      ml: tile.ml,
      abv,
      units: calcUnits(tile.ml, abv),
      at: entryTimestamp(),
    })
  }

  async function logFreeDay() {
    if (!session || viewDayFreeMarker) return
    await add(session.dataUid, {
      name: 'Free day',
      ml: 0,
      abv: 0,
      units: 0,
      freeDay: true,
      at: entryTimestamp(),
    })
    setCelebrate(true)
  }

  return (
    <div className="min-h-full flex flex-col max-w-md mx-auto px-4 pb-8">
      <Header screen={screen} setScreen={setScreen} />

      {screen === 'home' && (
        <Home
          settings={settings}
          viewDate={viewDate}
          isViewingToday={isViewingToday}
          onPickDay={(d) => setViewDate(startOfDay(d))}
          onJumpToToday={() => setViewDate(startOfDay(new Date()))}
          streak={streak}
          viewDay={viewDay}
          viewDayReal={viewDayReal}
          viewDayFreeMarker={viewDayFreeMarker}
          recent={recent}
          rolling7={rolling7}
          isCurrent7={isCurrent7}
          onShiftBack={shiftWindowBack}
          onShiftForward={shiftWindowForward}
          onJumpToCurrent7={jumpToCurrent7}
          onQuickAdd={quickAdd}
          onLongPressTile={setAbvEditTile}
          onCustom={() => setCustomOpen(true)}
          onFreeDay={logFreeDay}
          onEdit={setEditing}
          onDelete={(id) => remove(session.dataUid, id)}
        />
      )}

      {screen === 'calendar' && (
        <Calendar
          drinks={drinks}
          settings={settings}
          onPickDay={(d) => { setViewDate(d); setScreen('home') }}
        />
      )}

      {screen === 'history' && <History drinks={drinks} settings={settings} />}

      {screen === 'settings' && (
        <Settings
          settings={settings}
          onChange={(s) => { setSettings(s); saveSettings(s) }}
          session={session}
        />
      )}

      {customOpen && (
        <DrinkModal
          title="Custom drink"
          showDate
          initial={{ name: '', ml: 330, abv: 5, at: entryTimestamp() || new Date() }}
          onCancel={() => setCustomOpen(false)}
          onSave={async (d) => {
            await add(session.dataUid, { ...d, units: calcUnits(d.ml, d.abv) })
            setCustomOpen(false)
          }}
        />
      )}

      {editing && (
        <DrinkModal
          title="Edit drink"
          showDate
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async (d) => {
            await update(session.dataUid, editing.id, {
              ...d,
              units: calcUnits(d.ml, d.abv),
            })
            setEditing(null)
          }}
        />
      )}

      {abvEditTile && (
        <AbvQuickModal
          tile={abvEditTile}
          onCancel={() => setAbvEditTile(null)}
          onLog={async (abv) => {
            await quickAdd(abvEditTile, abv)
            setAbvEditTile(null)
          }}
        />
      )}

      {celebrate && <Celebration onDone={() => setCelebrate(false)} />}
    </div>
  )
}

function Header({ screen, setScreen }) {
  return (
    <header className="flex items-center justify-between pt-4 pb-4 gap-2">
      <button
        onClick={() => setScreen('home')}
        className="text-xl font-semibold tracking-tight shrink-0 py-2"
      >
        Alcobosh
      </button>
      <nav className="flex gap-1 text-sm">
        <TabBtn active={screen === 'home'} onClick={() => setScreen('home')}>Home</TabBtn>
        <TabBtn active={screen === 'calendar'} onClick={() => setScreen('calendar')}>Cal</TabBtn>
        <TabBtn active={screen === 'history'} onClick={() => setScreen('history')}>Trends</TabBtn>
        <TabBtn active={screen === 'settings'} onClick={() => setScreen('settings')}><span className="text-[1.3em] leading-none">⚙︎</span></TabBtn>
      </nav>
    </header>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2.5 rounded-lg touch-manipulation ${
        active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white active:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function dayLabel(date, isToday) {
  if (isToday) return 'Today'
  const yest = startOfDay(new Date())
  yest.setDate(yest.getDate() - 1)
  if (sameDay(date, yest)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function dayLabelFor(date) {
  const today = startOfDay(new Date())
  return dayLabel(date, sameDay(date, today))
}

// Long-press detector.
function useLongPress({ onLong, ms = 500 }) {
  const timer = useRef(null)
  const suppressClick = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  const events = {
    onPointerDown: (e) => {
      cancel()
      startPos.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 }
      timer.current = setTimeout(() => { suppressClick.current = true; onLong() }, ms)
    },
    onPointerMove: (e) => {
      if (!timer.current) return
      const dx = Math.abs((e.clientX ?? 0) - startPos.current.x)
      const dy = Math.abs((e.clientY ?? 0) - startPos.current.y)
      if (dx > 10 || dy > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => e.preventDefault(),
  }

  const wrapClick = (handler) => (e) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    handler(e)
  }

  return { events, wrapClick }
}

function Home({
  settings, viewDate, isViewingToday, onPickDay, onJumpToToday,
  streak, viewDay, viewDayReal, viewDayFreeMarker, recent, rolling7, isCurrent7,
  onShiftBack, onShiftForward, onJumpToCurrent7,
  onQuickAdd, onLongPressTile, onCustom, onFreeDay, onEdit, onDelete,
}) {
  const sevenTotal = rolling7.total
  const pct = Math.min(100, (sevenTotal / settings.weeklyCap) * 100)
  const weekState =
    sevenTotal >= settings.weeklyCap ? 'over' : sevenTotal >= settings.weeklyCap * 0.75 ? 'warn' : 'ok'

  const showFreeDayBtn = viewDayReal.length === 0
  const freeDayMarked = !!viewDayFreeMarker
  const selectedLabel = dayLabel(viewDate, isViewingToday)
  const todayKey = isoDate(new Date())

  const homeTiles = settings.tiles.slice(0, HOME_TILES)
  const extraTiles = settings.tiles.slice(HOME_TILES)

  return (
    <>
      {/* Rolling-7-day block: nav + total + heatmap */}
      <section className="rounded-2xl bg-white/5 p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <button
            onClick={onShiftBack}
            aria-label="Previous 7 days"
            className="rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1 text-sm shrink-0"
          >←</button>

          <button
            onClick={onJumpToCurrent7}
            disabled={isCurrent7}
            className="text-sm text-white/80 disabled:cursor-default flex-1 text-center truncate"
            title={isCurrent7 ? '' : 'Jump to last 7 days'}
          >
            {isCurrent7
              ? 'Last 7 days'
              : `7 days to ${rolling7.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
          </button>

          {isCurrent7 ? (
            <div className="w-9 shrink-0" aria-hidden="true" />
          ) : (
            <button
              onClick={onShiftForward}
              aria-label="Next 7 days"
              className="rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1 text-sm shrink-0"
            >→</button>
          )}
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-white/50">7-day total</span>
          <span className="text-sm text-white/60">{fmtUnits(sevenTotal)} / {settings.weeklyCap} units</span>
        </div>
        <Bar pct={pct} state={weekState} />
        <div className="grid grid-cols-7 gap-1 mt-4 mb-1">
          {rolling7.days.map((cell, i) => (
            <div key={i} className="text-[10px] text-white/40 text-center">
              {['S','M','T','W','T','F','S'][cell.date.getDay()]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {rolling7.days.map((cell, i) => {
            const u = cell.units
            const free = cell.free
            const isViewedDay = sameDay(cell.date, viewDate)
            const isToday = isoDate(cell.date) === todayKey

            let bg = 'bg-white/5'
            let textColor = 'text-white/80'
            let unitColor = 'text-white/60'
            if (u >= settings.dailyWarn) { bg = 'bg-red-500/40'; textColor = 'text-white'; unitColor = 'text-red-100' }
            else if (u > 0) { bg = 'bg-emerald-500/30'; textColor = 'text-white'; unitColor = 'text-emerald-200' }
            else if (free) { bg = 'bg-yellow-700/30'; textColor = 'text-yellow-200'; unitColor = 'text-yellow-200/80' }

            return (
              <button
                key={i}
                type="button"
                onClick={() => onPickDay?.(cell.date)}
                className={`aspect-square rounded flex flex-col items-center justify-center ${bg} ${isViewedDay ? 'ring-2 ring-white/40' : isToday ? 'ring-1 ring-white/20' : ''} hover:ring-2 hover:ring-white/30 touch-manipulation`}
                title={`${cell.date.toDateString()}: ${u > 0 ? fmtUnits(u) + 'u' : free ? 'Alco free day' : 'no entry'}`}
              >
                <div className={`text-xs ${textColor}`}>{cell.date.getDate()}</div>
                {u > 0 ? (
                  <div className={`text-[10px] ${unitColor}`}>{fmtUnits(u)}</div>
                ) : free ? (
                  <div className="text-[10px] text-yellow-200">✓</div>
                ) : null}
              </button>
            )
          })}
        </div>
        {!isConfigured && (
          <p className="text-xs text-amber-300/80 mt-3">
            Local mode — Firebase not configured. Add your config in <code>src/firebase.js</code> to sync.
          </p>
        )}
      </section>

      {/* Quick-add tiles — first HOME_TILES show as buttons */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        {homeTiles.map((t) => (
          <Tile key={t.id} tile={t} onTap={() => onQuickAdd(t)} onLongPress={() => onLongPressTile(t)} />
        ))}
      </section>

      {!isViewingToday && (
        <button
          onClick={onJumpToToday}
          className="mt-3 w-full text-center text-xs text-amber-200/90 bg-amber-700/15 hover:bg-amber-700/25 rounded-lg py-2"
          title="Tap to switch back to today"
        >
          Logging on <span className="font-medium">{selectedLabel}</span> — tap to switch to today
        </button>
      )}

      <div className={`mt-3 grid ${extraTiles.length ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
        {extraTiles.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const t = extraTiles.find((x) => x.id === e.target.value)
              if (t) onQuickAdd(t)
            }}
            aria-label="More drinks"
            className="rounded-2xl bg-white/5 hover:bg-white/10 py-3 px-2 text-sm text-center appearance-none cursor-pointer"
          >
            <option value="" disabled>More ▾</option>
            {extraTiles.map((t) => (
              <option key={t.id} value={t.id}>{t.label} · {t.ml}ml {t.abv}%</option>
            ))}
          </select>
        )}
        <button
          onClick={onCustom}
          className="rounded-2xl bg-white/5 hover:bg-white/10 py-3 text-sm"
        >+ Custom</button>
        <button
          onClick={onFreeDay}
          disabled={!showFreeDayBtn || freeDayMarked}
          className={`rounded-2xl py-3 text-sm transition ${
            freeDayMarked
              ? 'bg-yellow-700/40 text-yellow-200 cursor-default'
              : showFreeDayBtn
                ? 'bg-yellow-700/30 hover:bg-yellow-700/40 text-yellow-100'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
        >{freeDayMarked ? 'Alco free day ✓' : 'Alco free day'}</button>
      </div>

      <section className="mt-6">
        <h2 className="text-sm text-white/60 mb-2">
          {isViewingToday ? 'Today’s drinks' : `${selectedLabel}’s drinks`}
        </h2>
        {viewDay.length === 0 ? (
          <p className="text-sm text-white/40">Nothing logged{isViewingToday ? ' yet' : ''}.</p>
        ) : (
          <ul className="space-y-2">
            {viewDay.map((d) => (
              <DrinkRow key={d.id} d={d} showDay={false} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm text-white/60 mb-2">Recent drinks</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-white/40">
            {streak > 0
              ? `${streak} alcohol-free day${streak === 1 ? '' : 's'} so far.`
              : 'Nothing logged yet.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((d) => (
              <DrinkRow key={d.id} d={d} showDay onEdit={onEdit} onDelete={onDelete} />
            ))}
          </ul>
        )}
      </section>

      {isViewingToday && streak > 0 && viewDayReal.length === 0 && (
        <section className="mt-6 rounded-2xl bg-emerald-500/10 p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-300">{streak}</div>
          <div className="text-xs text-emerald-200/80">alcohol-free day{streak === 1 ? '' : 's'}</div>
        </section>
      )}
    </>
  )
}

function DrinkRow({ d, showDay, onEdit, onDelete }) {
  const free = isFreeDay(d)
  const parts = []
  if (showDay) parts.push(dayLabelFor(d.at))
  if (!free) parts.push(`${fmtUnits(d.units)}u`)
  const subline = parts.join(' · ')
  return (
    <li className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 gap-2">
      <div className="min-w-0">
        <div className={`text-sm truncate ${free ? 'text-yellow-200' : ''}`}>
          {free ? 'Alco free day ✓' : `${d.name || 'Drink'} · ${d.ml}ml · ${d.abv}%`}
        </div>
        {subline && <div className="text-xs text-white/50">{subline}</div>}
      </div>
      <div className="flex gap-1 shrink-0">
        {!free && (
          <button onClick={() => onEdit(d)} className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10">Edit</button>
        )}
        <button onClick={() => onDelete(d.id)} className="text-xs px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-200">Delete</button>
      </div>
    </li>
  )
}

function Tile({ tile, onTap, onLongPress }) {
  const { events, wrapClick } = useLongPress({ onLong: onLongPress })
  return (
    <button
      {...events}
      onClick={wrapClick(onTap)}
      className="rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 p-4 text-left transition select-none touch-manipulation"
    >
      <div className="text-lg font-semibold">{tile.label}</div>
      <div className="text-xs text-white/60">{tile.ml}ml · {tile.abv}%</div>
      <div className="text-xs text-emerald-300 mt-1">+{fmtUnits(calcUnits(tile.ml, tile.abv))}u</div>
    </button>
  )
}

function Bar({ pct, state }) {
  const color =
    state === 'over' ? 'bg-red-500' : state === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'
  return (
    <div className="h-3 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// columns: [{ key, header, stats }] — one value column per stats object.
function StatsTable({ columns, settings, caption }) {
  const u = (n) => `${fmtUnits(n)}u`
  const dayVal = (s, n) => (s.drinkingDays > 0 ? u(n) : '—')
  const rows = [
    { label: 'Total', val: (s) => u(s.total) },
    { label: 'Daily average', val: (s) => u(s.avg) },
    { label: 'Highest day', val: (s) => dayVal(s, s.high), cls: (s) => (s.high >= settings.dailyWarn ? 'text-red-300' : 'text-white/80') },
    { label: 'Lowest day', val: (s) => dayVal(s, s.low) },
    { label: 'Drinking days', val: (s) => `${s.drinkingDays} / ${s.days}` },
    { label: 'Alco-free days', val: (s) => `${s.afDays} / ${s.days}`, cls: () => 'text-yellow-200' },
  ]
  const gridCols = `1fr ${columns.map(() => 'minmax(3.5rem,auto)').join(' ')}`

  return (
    <div className="mt-4 rounded-2xl bg-white/5 p-4">
      <div className="grid gap-y-2 gap-x-3 text-xs items-center" style={{ gridTemplateColumns: gridCols }}>
        <div className="text-white/40 font-medium">Stats</div>
        {columns.map((c) => (
          <div key={c.key} className="text-right text-white/50 font-medium">{c.header}</div>
        ))}
        {rows.map((r) => (
          <Fragment key={r.label}>
            <div className="text-white/60">{r.label}</div>
            {columns.map((c) => (
              <div key={c.key} className={`text-right tabular-nums ${r.cls ? r.cls(c.stats) : 'text-white/80'}`}>{r.val(c.stats)}</div>
            ))}
          </Fragment>
        ))}
      </div>
      {caption && <p className="text-[10px] text-white/30 mt-3">{caption}</p>}
    </div>
  )
}

const HISTORY_PRESETS = [
  { key: '30d', label: '30 days' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
]

function History({ drinks, settings }) {
  const today = startOfDay(new Date())
  const [preset, setPreset] = useState('6m')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(today); d.setDate(d.getDate() - 29); return toLocalDateString(d)
  })
  const [customEnd, setCustomEnd] = useState(() => toLocalDateString(today))

  const range = useMemo(() => {
    if (preset === 'custom') {
      const a = parseLocalDate(customStart)
      const b = parseLocalDate(customEnd)
      return a <= b ? { start: a, end: b } : { start: b, end: a }
    }
    const end = today
    if (preset === 'all') {
      return { start: firstDrinkDate(drinks) || end, end }
    }
    const start = new Date(end)
    if (preset === '30d') start.setDate(start.getDate() - 29)
    else if (preset === '3m') start.setMonth(start.getMonth() - 3)
    else if (preset === '6m') start.setMonth(start.getMonth() - 6)
    else if (preset === '12m') start.setMonth(start.getMonth() - 12)
    return { start: startOfDay(start), end }
  }, [preset, customStart, customEnd, drinks, today])

  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1)
  const granularity = pickGranularity(days)
  const buckets = useMemo(() => bucketUnits(drinks, range.start, range.end, granularity), [drinks, range, granularity])
  const stats = useMemo(() => rangeStats(drinks, range.start, range.end), [drinks, range])

  const fmtD = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const presetHeader = preset === 'custom' ? 'Range' : HISTORY_PRESETS.find((p) => p.key === preset)?.label

  return (
    <div className="mt-2 space-y-4">
      <div className="flex flex-wrap gap-2">
        {HISTORY_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              preset === p.key ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >{p.label}</button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date" value={customStart} max={customEnd}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 min-w-0 bg-white/5 rounded px-2 py-2"
          />
          <span className="text-white/40">→</span>
          <input
            type="date" value={customEnd} max={toLocalDateString(today)}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 min-w-0 bg-white/5 rounded px-2 py-2"
          />
        </div>
      )}

      <section className="rounded-2xl bg-white/5 p-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-white/60">{fmtUnits(stats.total)} units</span>
          <span className="text-[11px] text-white/40">by {granularity}</span>
        </div>
        <div className="text-[11px] text-white/40 mb-3">{fmtD(range.start)} – {fmtD(range.end)}</div>
        <BarChart buckets={buckets} settings={settings} granularity={granularity} />
      </section>

      <StatsTable
        columns={[{ key: 'range', header: presetHeader, stats }]}
        settings={settings}
        caption="For the selected range."
      />
    </div>
  )
}

function BarChart({ buckets, settings, granularity }) {
  const max = Math.max(1, ...buckets.map((b) => b.value))
  const cap = granularity === 'day' ? settings.dailyWarn : granularity === 'week' ? settings.weeklyCap : null
  const n = buckets.length
  const labelEvery = Math.max(1, Math.ceil(n / 6))

  if (n === 0) return <p className="text-sm text-white/40">No data in this range.</p>

  return (
    <div>
      <div className="relative flex items-end gap-px h-40 border-b border-white/10">
        {cap && cap <= max && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-white/25"
            style={{ top: `${(1 - cap / max) * 100}%` }}
            title={`Cap ${fmtUnits(cap)}u`}
          />
        )}
        {buckets.map((b, i) => {
          const h = b.value > 0 ? Math.max(2, (b.value / max) * 100) : 0
          const over = cap && b.value > cap
          return (
            <div key={i} className="flex-1 flex items-end h-full min-w-0" title={`${b.label}: ${fmtUnits(b.value)}u`}>
              <div className={`w-full rounded-t ${over ? 'bg-red-500/70' : 'bg-emerald-500/70'}`} style={{ height: `${h}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex gap-px mt-1">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 min-w-0 text-[9px] text-white/40 text-center whitespace-nowrap">
            {i % labelEvery === 0 ? b.label : ''}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-white/30 mt-2">
        <span>peak {fmtUnits(max)}u{cap ? ` · cap ${fmtUnits(cap)}u` : ''}</span>
        <span>{n} {granularity === 'day' ? 'days' : granularity === 'week' ? 'weeks' : 'months'}</span>
      </div>
    </div>
  )
}

function Calendar({ drinks, settings, onPickDay }) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const unitsMap = useMemo(() => unitsByDay(drinks), [drinks])
  const freeMap = useMemo(() => freeDaysByDay(drinks), [drinks])

  const stats7 = useMemo(() => windowStats(drinks, 7), [drinks])
  const stats30 = useMemo(() => windowStats(drinks, 30), [drinks])

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const firstWeekday = monthStart.getDay()
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1

  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const isCurrentMonth = month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm"
        >←</button>
        <div className="text-sm font-medium">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={isCurrentMonth}
          className="rounded bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm disabled:opacity-30 disabled:hover:bg-white/5"
        >→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-[10px] text-white/40 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />
          const k = isoDate(cell)
          const u = unitsMap[k] || 0
          const free = freeMap[k]
          const isToday = sameDay(cell, today)
          const future = cell > today && !isToday

          let bg = 'bg-white/5'
          let textColor = 'text-white/80'
          let unitColor = 'text-white/60'
          if (u >= settings.dailyWarn) { bg = 'bg-red-500/40'; textColor = 'text-white'; unitColor = 'text-red-100' }
          else if (u > 0) { bg = 'bg-emerald-500/30'; textColor = 'text-white'; unitColor = 'text-emerald-200' }
          else if (free) { bg = 'bg-yellow-700/30'; textColor = 'text-yellow-200'; unitColor = 'text-yellow-200/80' }
          if (future) { textColor = 'text-white/20'; unitColor = 'text-white/20' }

          return (
            <button
              key={i}
              onClick={() => !future && onPickDay?.(startOfDay(cell))}
              disabled={future}
              className={`aspect-square rounded flex flex-col items-center justify-center ${bg} ${isToday ? 'ring-2 ring-white/40' : ''} ${future ? 'cursor-default' : 'hover:ring-2 hover:ring-white/30'}`}
              title={`${cell.toDateString()}: ${u > 0 ? fmtUnits(u) + 'u' : free ? 'Alco free day' : 'No entry'}`}
            >
              <div className={`text-xs ${textColor}`}>{cell.getDate()}</div>
              {u > 0 ? (
                <div className={`text-[10px] ${unitColor}`}>{fmtUnits(u)}</div>
              ) : free && !future ? (
                <div className="text-[10px] text-yellow-200">✓</div>
              ) : null}
            </button>
          )
        })}
      </div>

      <StatsTable
        columns={[
          { key: '7', header: '7 days', stats: stats7 },
          { key: '30', header: '30 days', stats: stats30 },
        ]}
        settings={settings}
        caption="Rolling windows ending today."
      />

      <p className="text-[11px] text-white/30 mt-3 text-center">Tap a day to jump to it</p>
    </div>
  )
}

function Settings({ settings, onChange, session }) {
  const [pairCode, setPairCode] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [pairMsg, setPairMsg] = useState('')

  function patch(p) { onChange({ ...settings, ...p }) }
  function updateTile(id, p) {
    onChange({ ...settings, tiles: settings.tiles.map((t) => (t.id === id ? { ...t, ...p } : t)) })
  }
  function addTile() {
    if (settings.tiles.length >= MAX_TILES) return
    onChange({ ...settings, tiles: [...settings.tiles, makeTile()] })
  }
  function removeTile(id) {
    if (settings.tiles.length <= 1) return
    onChange({ ...settings, tiles: settings.tiles.filter((t) => t.id !== id) })
  }
  function moveTile(id, dir) {
    const tiles = [...settings.tiles]
    const i = tiles.findIndex((t) => t.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= tiles.length) return
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
    onChange({ ...settings, tiles })
  }

  async function genCode() {
    setPairMsg('')
    try { setGeneratedCode(await startPair(session.uid)) }
    catch (e) { setPairMsg(e.message) }
  }

  async function redeem() {
    setPairMsg('')
    try {
      await completePair(pairCode.trim())
      setPairMsg('Paired — reloading…')
      setTimeout(() => location.reload(), 600)
    } catch (e) { setPairMsg(e.message) }
  }

  return (
    <div className="space-y-6 mt-2">
      <section className="rounded-2xl bg-white/5 p-4 space-y-3">
        <h2 className="text-sm font-medium">Limits</h2>
        <Field label="Weekly cap (units)" value={settings.weeklyCap} onChange={(v) => patch({ weeklyCap: v })} />
        <Field label="Daily warn at (units)" value={settings.dailyWarn} onChange={(v) => patch({ dailyWarn: v })} />
      </section>

      <section className="rounded-2xl bg-white/5 p-4 space-y-3">
        <h2 className="text-sm font-medium">Quick-add tiles</h2>
        <p className="text-xs text-white/40">
          The top {HOME_TILES} (★) show as buttons on Home. The rest appear in the Home “More ▾” dropdown. Reorder to choose which show.
        </p>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1rem_minmax(0,1fr)_3rem_2.5rem_auto] gap-1 items-center text-[10px] text-white/40 px-0.5">
            <span />
            <span>Drink</span>
            <span className="text-center">ml</span>
            <span className="text-center">%</span>
            <span />
          </div>
          {settings.tiles.map((t, i) => {
            const onHome = i < HOME_TILES
            return (
              <div key={t.id} className="grid grid-cols-[1rem_minmax(0,1fr)_3rem_2.5rem_auto] gap-1 items-center">
                <span className={`text-xs text-center ${onHome ? 'text-yellow-300' : 'text-white/30'}`}>{onHome ? '★' : i + 1}</span>
                <input
                  className="min-w-0 bg-white/5 rounded px-2 py-1.5 text-sm"
                  value={t.label}
                  onChange={(e) => updateTile(t.id, { label: e.target.value })}
                />
                <input
                  className="min-w-0 bg-white/5 rounded px-1 py-1.5 text-sm text-center"
                  type="number" inputMode="numeric" value={t.ml}
                  onChange={(e) => updateTile(t.id, { ml: Number(e.target.value) })}
                />
                <input
                  className="min-w-0 bg-white/5 rounded px-1 py-1.5 text-sm text-center"
                  type="number" inputMode="decimal" step="0.1" value={t.abv}
                  onChange={(e) => updateTile(t.id, { abv: Number(e.target.value) })}
                />
                <div className="flex gap-0.5">
                  <button onClick={() => moveTile(t.id, -1)} disabled={i === 0} aria-label="Move up" className="text-[11px] px-1.5 py-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30">▲</button>
                  <button onClick={() => moveTile(t.id, 1)} disabled={i === settings.tiles.length - 1} aria-label="Move down" className="text-[11px] px-1.5 py-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30">▼</button>
                  <button onClick={() => removeTile(t.id)} disabled={settings.tiles.length <= 1} aria-label="Remove tile" className="text-[11px] px-1.5 py-1.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-200 disabled:opacity-30">✕</button>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={addTile}
          disabled={settings.tiles.length >= MAX_TILES}
          className="w-full rounded-lg bg-white/5 hover:bg-white/10 py-2 text-sm disabled:opacity-30 disabled:hover:bg-white/5"
        >
          + Add tile {settings.tiles.length >= MAX_TILES ? `(max ${MAX_TILES})` : `(${settings.tiles.length}/${MAX_TILES})`}
        </button>
      </section>

      <section className="rounded-2xl bg-white/5 p-4 space-y-3">
        <h2 className="text-sm font-medium">Sync</h2>
        {!isConfigured ? (
          <p className="text-xs text-amber-300/80">Add Firebase config in <code>src/firebase.js</code> to enable cloud sync.</p>
        ) : (
          <>
            <div className="text-xs text-white/60">Mode: {session?.mode} · uid: {session?.uid?.slice(0, 8)}…</div>
            <div className="space-y-2">
              <button onClick={genCode} className="w-full rounded bg-white/10 hover:bg-white/15 py-2 text-sm">Generate pair code (this device)</button>
              {generatedCode && (<div className="text-center text-2xl font-mono tracking-widest py-2">{generatedCode}</div>)}
            </div>
            <div className="flex gap-2">
              <input placeholder="Enter code from other device" className="flex-1 bg-white/5 rounded px-2 py-2 text-sm" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
              <button onClick={redeem} className="rounded bg-emerald-500/20 hover:bg-emerald-500/30 px-3 text-sm">Pair</button>
            </div>
            {pairMsg && <p className="text-xs text-white/60">{pairMsg}</p>}
          </>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input type="number" step="0.1" className="w-24 bg-white/5 rounded px-2 py-1 text-sm text-right" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

// Convert a Date to YYYY-MM-DD using local time (matching what <input type="date"> expects).
function toLocalDateString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function DrinkModal({ title, initial, showDate, onCancel, onSave }) {
  const initialAt = useMemo(() => initial.at instanceof Date ? initial.at : new Date(), [initial])
  const [name, setName] = useState(initial.name || '')
  const [ml, setMl] = useState(initial.ml)
  const [abv, setAbv] = useState(initial.abv)
  const [dateStr, setDateStr] = useState(() => toLocalDateString(initialAt))
  const units = calcUnits(Number(ml) || 0, Number(abv) || 0)

  function buildAt() {
    const [y, m, d] = dateStr.split('-').map(Number)
    const at = new Date(initialAt)
    at.setFullYear(y, m - 1, d)
    return at
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-10 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1d24] p-5 space-y-3">
        <h2 className="font-semibold">{title}</h2>
        <label className="block">
          <span className="text-xs text-white/60">Name (optional)</span>
          <input className="mt-1 w-full bg-white/5 rounded px-2 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wine" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-white/60">Size (ml)</span>
            <input type="number" className="mt-1 w-full bg-white/5 rounded px-2 py-2 text-sm" value={ml} onChange={(e) => setMl(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">ABV (%)</span>
            <input type="number" step="0.1" className="mt-1 w-full bg-white/5 rounded px-2 py-2 text-sm" value={abv} onChange={(e) => setAbv(Number(e.target.value))} />
          </label>
        </div>
        {showDate && (
          <label className="block">
            <span className="text-xs text-white/60">Date</span>
            <input type="date" className="mt-1 w-full bg-white/5 rounded px-2 py-2 text-sm" value={dateStr} max={toLocalDateString(new Date())} onChange={(e) => setDateStr(e.target.value)} />
          </label>
        )}
        <div className="text-sm text-emerald-300">= {fmtUnits(units)} units</div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 rounded bg-white/5 hover:bg-white/10 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onSave({ name: name || null, ml: Number(ml), abv: Number(abv), at: buildAt() })}
            className="flex-1 rounded bg-emerald-500/30 hover:bg-emerald-500/40 py-2 text-sm"
          >Save</button>
        </div>
      </div>
    </div>
  )
}

function AbvQuickModal({ tile, onCancel, onLog }) {
  const [abv, setAbv] = useState(tile.abv)
  const units = calcUnits(tile.ml, Number(abv) || 0)
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-10 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1d24] p-5 space-y-3">
        <h2 className="font-semibold">{tile.label} · custom ABV</h2>
        <p className="text-xs text-white/60">
          One-off log with a different strength. Size stays at {tile.ml}ml. To change the tile’s default, use Settings.
        </p>
        <label className="block">
          <span className="text-xs text-white/60">ABV (%)</span>
          <input type="number" step="0.1" autoFocus className="mt-1 w-full bg-white/5 rounded px-2 py-2 text-base" value={abv} onChange={(e) => setAbv(Number(e.target.value))} />
        </label>
        <div className="text-sm text-emerald-300">= {fmtUnits(units)} units</div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 rounded bg-white/5 hover:bg-white/10 py-2 text-sm">Cancel</button>
          <button onClick={() => onLog(Number(abv))} className="flex-1 rounded bg-emerald-500/30 hover:bg-emerald-500/40 py-2 text-sm">Log drink</button>
        </div>
      </div>
    </div>
  )
}

function Celebration({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1900)
    return () => clearTimeout(t)
  }, [onDone])

  const particles = useMemo(() => {
    const emojis = ['🎉', '✨', '🥳', '⭐', '💚', '🌿', '🎊', '🙌']
    return Array.from({ length: 16 }).map((_, i) => ({
      key: i,
      e: emojis[i % emojis.length],
      left: 6 + Math.random() * 88,
      delay: Math.random() * 0.35,
      duration: 1.3 + Math.random() * 0.6,
      size: 22 + Math.random() * 18,
    }))
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden" aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl"
        style={{ animation: 'burstPulse 0.6s ease-out forwards' }}
      >✓</div>
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute bottom-1/3 select-none"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animation: `floatUp ${p.duration}s ease-out ${p.delay}s forwards`,
          }}
        >{p.e}</span>
      ))}
    </div>
  )
}
