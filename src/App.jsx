import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calcUnits,
  fmtUnits,
  weekBounds,
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

  const { start: weekStart, end: weekEnd } = weekBounds(viewDate)
  const viewWeek = useMemo(
    () => drinks.filter((d) => d.at >= weekStart && d.at < weekEnd),
    [drinks, weekStart, weekEnd],
  )
  const viewDay = useMemo(() => viewWeek.filter((d) => sameDay(d.at, viewDate)), [viewWeek, viewDate])
  const viewDayReal = viewDay.filter(isReal)
  const viewDayFreeMarker = viewDay.find(isFreeDay)

  const weekUnits = viewWeek.filter(isReal).reduce((s, d) => s + d.units, 0)
  const dayUnits = viewDayReal.reduce((s, d) => s + d.units, 0)
  const streak = useMemo(() => afStreak(drinks, now), [drinks])

  // 5 most recent drinks (drinks are returned sorted at desc by the subscription).
  const recent = useMemo(() => drinks.slice(0, 5), [drinks])

  // Rolling totals across the last 7 / 30 days (real drinks only).
  const rolling = useMemo(() => {
    const cutoff = (n) => {
      const d = new Date(now)
      d.setDate(d.getDate() - n)
      d.setHours(0, 0, 0, 0)
      return d
    }
    const c7 = cutoff(6)  // 7 days inclusive of today
    const c30 = cutoff(29)
    let t7 = 0, t30 = 0
    drinks.filter(isReal).forEach((d) => {
      if (d.at >= c30) t30 += d.units
      if (d.at >= c7) t7 += d.units
    })
    return { t7, t30 }
  }, [drinks])

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

  function shiftDay(delta) {
    const next = new Date(viewDate)
    next.setDate(next.getDate() + delta)
    next.setHours(0, 0, 0, 0)
    const today = startOfDay(new Date())
    if (next > today) return
    setViewDate(next)
  }

  return (
    <div className="min-h-full flex flex-col max-w-md mx-auto px-4 pb-8">
      <Header screen={screen} setScreen={setScreen} />

      {screen === 'home' && (
        <Home
          settings={settings}
          viewDate={viewDate}
          isViewingToday={isViewingToday}
          onPrevDay={() => shiftDay(-1)}
          onNextDay={() => shiftDay(+1)}
          onJumpToToday={() => setViewDate(startOfDay(new Date()))}
          onPickDay={(d) => setViewDate(startOfDay(d))}
          weekUnits={weekUnits}
          dayUnits={dayUnits}
          streak={streak}
          viewDay={viewDay}
          viewDayReal={viewDayReal}
          viewDayFreeMarker={viewDayFreeMarker}
          viewWeek={viewWeek}
          weekStart={weekStart}
          recent={recent}
          rolling={rolling}
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
        <TabBtn active={screen === 'settings'} onClick={() => setScreen('settings')}>⚙︎</TabBtn>
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
  settings, viewDate, isViewingToday, onPrevDay, onNextDay, onJumpToToday, onPickDay,
  weekUnits, dayUnits, streak, viewDay, viewDayReal, viewDayFreeMarker,
  viewWeek, weekStart, recent, rolling,
  onQuickAdd, onLongPressTile, onCustom, onFreeDay, onEdit, onDelete,
}) {
  const pct = Math.min(100, (weekUnits / settings.weeklyCap) * 100)
  const dayPct = Math.min(100, (dayUnits / settings.dailyWarn) * 100)
  const dayState =
    dayUnits >= settings.dailyWarn ? 'over' : dayUnits >= settings.dailyWarn * 0.75 ? 'warn' : 'ok'
  const weekState =
    weekUnits >= settings.weeklyCap ? 'over' : weekUnits >= settings.weeklyCap * 0.75 ? 'warn' : 'ok'

  const showFreeDayBtn = viewDayReal.length === 0
  const freeDayMarked = !!viewDayFreeMarker
  const label = dayLabel(viewDate, isViewingToday)

  const daysInWeek = useMemo(() => {
    const acc = {}
    viewWeek.filter(isReal).forEach((d) => { acc[isoDate(d.at)] = (acc[isoDate(d.at)] || 0) + d.units })
    return acc
  }, [viewWeek])
  const freeInWeek = useMemo(() => {
    const acc = {}
    viewWeek.filter(isFreeDay).forEach((d) => { acc[isoDate(d.at)] = true })
    return acc
  }, [viewWeek])

  return (
    <>
      {/* Today (or selected day) with prev/next arrows */}
      <section className="rounded-2xl bg-white/5 p-5">
        <div className="flex items-center justify-between mb-2 gap-2">
          <button
            onClick={onPrevDay}
            aria-label="Previous day"
            className="rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1 text-sm shrink-0"
          >←</button>

          <button
            onClick={onJumpToToday}
            disabled={isViewingToday}
            className="text-sm text-white/80 disabled:cursor-default flex-1 text-center truncate"
            title={isViewingToday ? '' : 'Jump to today'}
          >
            {label}
          </button>

          <button
            onClick={onNextDay}
            disabled={isViewingToday}
            aria-label="Next day"
            className="rounded-lg bg-white/5 hover:bg-white/10 px-3 py-1 text-sm shrink-0 disabled:opacity-30 disabled:hover:bg-white/5"
          >→</button>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-white/50">Day total</span>
          <span className={`text-sm ${dayState === 'over' ? 'text-red-400' : dayState === 'warn' ? 'text-amber-300' : 'text-white/60'}`}>
            {fmtUnits(dayUnits)} / {settings.dailyWarn} units
          </span>
        </div>
        <Bar pct={dayPct} state={dayState} />
        {dayState === 'over' && <p className="text-xs text-red-300 mt-2">Over daily limit.</p>}
        {dayState === 'warn' && <p className="text-xs text-amber-200 mt-2">Approaching daily limit.</p>}
        {freeDayMarked && viewDayReal.length === 0 && (
          <p className="text-xs text-emerald-300 mt-2">Free day ✓</p>
        )}
      </section>

      {/* Combined week block: total + heatmap */}
      <section className="mt-4 rounded-2xl bg-white/5 p-5">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-white/60">
            {isViewingToday ? 'This week' : `Week of ${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
          </span>
          <span className="text-sm text-white/60">{fmtUnits(weekUnits)} / {settings.weeklyCap} units</span>
        </div>
        <Bar pct={pct} state={weekState} />
        <div className="grid grid-cols-7 gap-1 mt-4">
          {Array.from({ length: 7 }).map((_, i) => {
            const day = new Date(weekStart)
            day.setDate(day.getDate() + i)
            const k = isoDate(day)
            const u = daysInWeek[k] || 0
            const free = freeInWeek[k]
            const isViewedDay = sameDay(day, viewDate)
            const intensity = Math.min(1, u / settings.dailyWarn)
            const bg = u === 0
              ? free ? 'bg-emerald-500/15' : 'bg-white/5'
              : u >= settings.dailyWarn
                ? 'bg-red-500/70'
                : 'bg-emerald-500'
            const today = startOfDay(new Date())
            const future = day > today
            return (
              <div key={i} className="text-center">
                <button
                  type="button"
                  onClick={() => !future && onPickDay?.(day)}
                  disabled={future}
                  className={`w-full h-12 rounded ${bg} ${isViewedDay ? 'ring-2 ring-white/40' : ''} ${future ? 'opacity-30 cursor-default' : 'hover:ring-2 hover:ring-white/30'} flex items-center justify-center text-[11px] leading-none touch-manipulation`}
                  style={u > 0 && u < settings.dailyWarn ? { opacity: 0.3 + intensity * 0.7 } : undefined}
                  title={`${day.toDateString()}: ${u > 0 ? fmtUnits(u) + 'u' : free ? 'Free day' : 'no entry'}`}
                >
                  {u > 0 ? (
                    <span className="font-medium text-white">{fmtUnits(u)}</span>
                  ) : free ? (
                    <span className="text-emerald-300">✓</span>
                  ) : null}
                </button>
                <div className="text-[10px] text-white/40 mt-1">{['M','T','W','T','F','S','S'][i]}</div>
              </div>
            )
          })}
        </div>
        {!isConfigured && (
          <p className="text-xs text-amber-300/80 mt-3">
            Local mode — Firebase not configured. Add your config in <code>src/firebase.js</code> to sync.
          </p>
        )}
      </section>

      {/* Rolling totals: last 7 days / last 30 days */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-[11px] text-white/50">Last 7 days</div>
          <div className="text-lg font-semibold mt-0.5">{fmtUnits(rolling?.t7 ?? 0)}<span className="text-xs text-white/50"> u</span></div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-[11px] text-white/50">Last 30 days</div>
          <div className="text-lg font-semibold mt-0.5">{fmtUnits(rolling?.t30 ?? 0)}<span className="text-xs text-white/50"> u</span></div>
        </div>
      </section>

      {/* Quick-add tiles */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        {settings.tiles.map((t) => (
          <Tile key={t.id} tile={t} onTap={() => onQuickAdd(t)} onLongPress={() => onLongPressTile(t)} />
        ))}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={onCustom}
          className="rounded-2xl bg-white/5 hover:bg-white/10 py-3 text-sm"
        >+ Custom</button>
        <button
          onClick={onFreeDay}
          disabled={!showFreeDayBtn || freeDayMarked}
          className={`rounded-2xl py-3 text-sm transition ${
            freeDayMarked
              ? 'bg-orange-700/40 text-orange-200 cursor-default'
              : showFreeDayBtn
                ? 'bg-orange-700/30 hover:bg-orange-700/40 text-orange-100'
                : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
        >{freeDayMarked ? 'Free day ✓' : 'Free day'}</button>
      </div>

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
            {recent.map((d) => {
              const free = isFreeDay(d)
              return (
                <li key={d.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 gap-2">
                  <div className="min-w-0">
                    <div className={`text-sm truncate ${free ? 'text-emerald-300' : ''}`}>
                      {free ? 'Free day ✓' : `${d.name || 'Drink'} · ${d.ml}ml · ${d.abv}%`}
                    </div>
                    <div className="text-xs text-white/50">
                      {dayLabelFor(d.at)} · {d.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {!free && ` · ${fmtUnits(d.units)}u`}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!free && (
                      <button onClick={() => onEdit(d)} className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10">Edit</button>
                    )}
                    <button onClick={() => onDelete(d.id)} className="text-xs px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-200">Delete</button>
                  </div>
                </li>
              )
            })}
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

function Calendar({ drinks, settings, onPickDay }) {
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const unitsMap = useMemo(() => unitsByDay(drinks), [drinks])
  const freeMap = useMemo(() => freeDaysByDay(drinks), [drinks])

  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const firstWeekday = monthStart.getDay()
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1

  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthTotal = cells.reduce((s, c) => (c ? s + (unitsMap[isoDate(c)] || 0) : s), 0)
  const realDays = cells.filter((c) => c && (unitsMap[isoDate(c)] || 0) > 0).length
  const freeDayCount = cells.filter((c) => c && freeMap[isoDate(c)] && !(unitsMap[isoDate(c)] > 0)).length
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
          else if (free) { bg = 'bg-emerald-500/10'; textColor = 'text-emerald-300'; unitColor = 'text-emerald-300/80' }
          if (future) { textColor = 'text-white/20'; unitColor = 'text-white/20' }

          return (
            <button
              key={i}
              onClick={() => !future && onPickDay?.(startOfDay(cell))}
              disabled={future}
              className={`aspect-square rounded flex flex-col items-center justify-center ${bg} ${isToday ? 'ring-2 ring-white/40' : ''} ${future ? 'cursor-default' : 'hover:ring-2 hover:ring-white/30'}`}
              title={`${cell.toDateString()}: ${u > 0 ? fmtUnits(u) + 'u' : free ? 'Free day' : 'No entry'}`}
            >
              <div className={`text-xs ${textColor}`}>{cell.getDate()}</div>
              {u > 0 ? (
                <div className={`text-[10px] ${unitColor}`}>{fmtUnits(u)}</div>
              ) : free && !future ? (
                <div className="text-[10px] text-emerald-300">✓</div>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-white/5 p-4 text-xs space-y-1">
        <div className="flex justify-between"><span className="text-white/60">Month total</span><span>{fmtUnits(monthTotal)}u</span></div>
        <div className="flex justify-between"><span className="text-white/60">Drinking days</span><span>{realDays}</span></div>
        <div className="flex justify-between"><span className="text-white/60">Free days marked</span><span>{freeDayCount}</span></div>
      </div>

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
        {settings.tiles.map((t) => (
          <div key={t.id} className="grid grid-cols-[1fr_5rem_5rem] gap-2 items-center">
            <input className="bg-white/5 rounded px-2 py-1 text-sm" value={t.label} onChange={(e) => updateTile(t.id, { label: e.target.value })} />
            <input className="bg-white/5 rounded px-2 py-1 text-sm" type="number" value={t.ml} onChange={(e) => updateTile(t.id, { ml: Number(e.target.value) })} />
            <input className="bg-white/5 rounded px-2 py-1 text-sm" type="number" step="0.1" value={t.abv} onChange={(e) => updateTile(t.id, { abv: Number(e.target.value) })} />
          </div>
        ))}
        <p className="text-xs text-white/40">Label · ml · ABV%</p>
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
