import { useState, useEffect, useRef } from 'react';
import { getHabits, getChecks, setCheck, renameHabit, removeHabit, streak, dayKey, todayKey, isMissingTable } from '../utils/habits';
import { AddHabitForm, DONE, StreakBadge } from './TodayHabits';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

function RowMenu({ habit, onRename, onRemove }) {
  const [menu, setMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  return (
    <div className="relative shrink-0">
      <button onClick={() => { setMenu(m => !m); setConfirmRemove(false); }} aria-label={`Options for ${habit.name}`} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5" style={{ color: INK }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {menu && (
        <div className="absolute left-0 top-7 z-20 w-48 rounded-xl py-1 shadow-lg" style={{ backgroundColor: '#fff', border: '1px solid #ece4d8' }}>
          {confirmRemove ? (
            <div className="px-3 py-2">
              <p style={{ ...sans, fontSize: '12px', color: INK, lineHeight: 1.4 }}>Remove this habit? Your history is kept.</p>
              <div className="flex gap-3 mt-2">
                <button onClick={() => { setMenu(false); onRemove(habit.id); }} style={{ ...sans, fontSize: '12px', color: '#c0392b', fontWeight: 600 }}>Remove</button>
                <button onClick={() => setConfirmRemove(false)} style={{ ...sans, fontSize: '12px', color: MUTED }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => { setMenu(false); onRename(habit); }} style={{ ...sans, fontSize: '13px', color: INK }} className="w-full text-left px-3 py-1.5 hover:bg-black/5">Rename</button>
              <button onClick={() => setConfirmRemove(true)} style={{ ...sans, fontSize: '13px', color: '#c0392b' }} className="w-full text-left px-3 py-1.5 hover:bg-black/5">Remove</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// One grid for every habit: a row per habit, a column per day of the month.
// On narrow screens the name sits above its row so all the days still fit.
function HabitGrid({ habits, year, month, checks, onToggle, onRename, onRemove }) {
  const [editing, setEditing] = useState(null); // habit id being renamed
  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  const today = todayKey();
  const n = daysIn(year, month);
  const days = Array.from({ length: n }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return { key: dayKey(date), num: i + 1, wd: date.getDay() };
  });
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const row = 'sm:grid sm:grid-cols-[minmax(150px,210px)_1fr] sm:items-center sm:gap-4';

  const has = (id, d) => checks.has(`${id}|${d}`);
  const countable = h => {
    const created = dayKey(new Date(h.createdAt));
    return days.filter(d => d.key <= today && (d.key >= created || has(h.id, d.key)));
  };

  // How much of each day got done, across every habit that existed that day
  const dayShare = days.map(d => {
    if (d.key > today) return null;
    const live = habits.filter(h => dayKey(new Date(h.createdAt)) <= d.key || has(h.id, d.key));
    return live.length ? live.filter(h => has(h.id, d.key)).length / live.length : null;
  });
  const perfect = dayShare.filter(x => x === 1).length;

  // On phones the month scrolls sideways; start with today in view
  const todayIdx = days.findIndex(d => d.key === today);
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const idx = todayIdx >= 0 ? todayIdx : n - 1;
    el.scrollLeft = Math.max(0, (idx + 1) / n * el.scrollWidth - el.clientWidth * 0.8);
  }, [year, month, todayIdx, n, habits.length]);

  async function saveName(e) {
    e?.preventDefault();
    const h = habits.find(x => x.id === editing);
    if (h && draft.trim() && draft.trim() !== h.name) await onRename(h.id, draft);
    setEditing(null);
  }

  const cell = { ...sans, fontSize: '9px' };

  return (
    <div className="rounded-2xl py-5" style={{ backgroundColor: '#fff', border: '1px solid #ece4d8' }}>
     <div ref={scroller} className="overflow-x-auto scrollbar-hide px-4 sm:px-6">
     <div className="min-w-[620px] sm:min-w-0">
      {/* Day numbers */}
      <div className={`${row} mb-2`}>
        <span className="hidden sm:block" />
        <div className="grid gap-[3px]" style={cols}>
          {days.map(d => (
            <span key={d.key} className="text-center" style={{ ...cell, color: d.key === today ? INK : d.wd === 0 || d.wd === 6 ? '#c4bab0' : MUTED, fontWeight: d.key === today ? 700 : 400 }}>
              {d.num}
            </span>
          ))}
        </div>
      </div>

      {habits.map(h => {
        const c = countable(h);
        const done = c.filter(d => has(h.id, d.key)).length;
        const pct = c.length ? Math.round((done / c.length) * 100) : 0;
        const s = streak(checks, h.id);
        const created = dayKey(new Date(h.createdAt));
        return (
          <div key={h.id} className={`${row} py-2.5`} style={{ borderTop: '1px solid #f3eee7' }}>
            <div className="sticky left-0 w-[min(300px,calc(100vw-90px))] sm:w-auto flex items-center gap-1 mb-1.5 sm:mb-0 min-w-0">
              <div className="flex-1 min-w-0">
                {editing === h.id ? (
                  <form onSubmit={saveName}>
                    <input value={draft} onChange={e => setDraft(e.target.value)} onBlur={saveName} autoFocus maxLength={80}
                      style={{ ...sans, fontSize: '13px', color: INK, borderColor: '#d4ccc4' }} className="w-full bg-transparent border-b py-0.5 focus:outline-none" />
                  </form>
                ) : (
                  <button onClick={() => { setDraft(h.name); setEditing(h.id); }} style={{ ...sans, fontSize: '13px', fontWeight: 500, color: INK, lineHeight: 1.3 }} className="block max-w-full truncate text-left hover:underline underline-offset-2 decoration-black/30" title="Tap to rename">{h.name}</button>
                )}
                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '2px' }}>
                  <p style={{ ...sans, fontSize: '11px', color: MUTED }}>
                    {c.length ? <><span style={{ color: pct >= 80 ? DONE : MUTED, fontWeight: pct >= 80 ? 600 : 400 }}>{pct}%</span> · {done}/{c.length} days</> : 'Not started'}
                  </p>
                  {s >= 2 && <StreakBadge days={s} compact />}
                </div>
              </div>
              <RowMenu habit={h} onRename={x => { setDraft(x.name); setEditing(x.id); }} onRemove={onRemove} />
            </div>
            <div className="grid gap-[3px]" style={cols}>
              {days.map(d => {
                const isDone = has(h.id, d.key);
                const future = d.key > today;
                const before = d.key < created && !isDone;
                return (
                  <button
                    key={d.key}
                    disabled={future}
                    onClick={() => onToggle(h.id, d.key, !isDone)}
                    aria-label={`${h.name}, ${new Date(year, month, d.num).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${isDone ? 'done' : 'not done'}`}
                    title={`${new Date(year, month, d.num).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${isDone ? ' · done' : ''}`}
                    className="aspect-square rounded-[4px] transition-colors enabled:hover:opacity-70"
                    style={{
                      backgroundColor: isDone ? DONE : future || before ? 'transparent' : '#efe9e1',
                      boxShadow: d.key === today ? `0 0 0 1.5px ${INK}` : future || before ? 'inset 0 0 0 1px #f0ebe3' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Every habit combined: darker = more of the day's habits done */}
      {habits.length > 1 && (
        <div className={`${row} pt-3 mt-1`} style={{ borderTop: '1px solid #e8e1d8' }}>
          <div className="sticky left-0 w-[min(300px,calc(100vw-90px))] sm:w-auto mb-1.5 sm:mb-0">
            <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: INK }}>Every habit</p>
            <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '1px' }}>
              {perfect ? `${perfect} perfect ${perfect === 1 ? 'day' : 'days'}` : 'No perfect days yet'}
            </p>
          </div>
          <div className="grid gap-[3px]" style={cols}>
            {dayShare.map((share, i) => (
              <span
                key={days[i].key}
                title={share == null ? '' : `${days[i].num}: ${Math.round(share * 100)}% done`}
                className="aspect-square rounded-full"
                style={{
                  backgroundColor: share == null ? 'transparent' : share === 0 ? '#efe9e1' : `rgba(95,125,90,${0.25 + share * 0.75})`,
                  boxShadow: share == null ? 'inset 0 0 0 1px #f0ebe3' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}
     </div>
     </div>
    </div>
  );
}

// Month overview: every habit in one grid. Tap any past day to fix it.
export default function HabitsView() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [habits, setHabits] = useState(null);
  const [checks, setChecks] = useState(new Set());
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(0);

  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();

  async function load() {
    try {
      // The viewed month plus enough before it for streaks
      const from = new Date(ym.y, ym.m, 1);
      from.setDate(from.getDate() - 120);
      const to = new Date(Math.max(new Date(ym.y, ym.m + 1, 0), now));
      const [h, c] = await Promise.all([getHabits(), getChecks(dayKey(from), dayKey(to))]);
      if (pending.current === 0) { setHabits(h); setChecks(c); }
    } catch (e) {
      if (isMissingTable(e)) setMissing(true);
      else setError(e.message || 'Could not load habits.');
      setHabits([]);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [ym.y, ym.m]);

  async function toggle(habitId, day, done) {
    const key = `${habitId}|${day}`;
    const flip = on => setChecks(prev => { const next = new Set(prev); if (on) next.add(key); else next.delete(key); return next; });
    flip(done);
    pending.current++;
    try {
      await setCheck(habitId, day, done);
    } catch {
      flip(!done);
      setError("Couldn't save that. Try again.");
    } finally {
      pending.current--;
    }
  }

  async function rename(id, name) {
    try {
      await renameHabit(id, name);
      setHabits(hs => hs.map(h => (h.id === id ? { ...h, name: name.trim() } : h)));
    } catch (e) { setError(e.message); }
  }

  async function remove(id) {
    try {
      await removeHabit(id);
      setHabits(hs => hs.filter(h => h.id !== id));
    } catch (e) { setError(e.message); }
  }

  const shift = d => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Whole-month score across habits
  const today = todayKey();
  let possible = 0, done = 0;
  (habits || []).forEach(h => {
    const created = dayKey(new Date(h.createdAt));
    for (let i = 1; i <= daysIn(ym.y, ym.m); i++) {
      const d = dayKey(new Date(ym.y, ym.m, i));
      if (d > today || (d < created && !checks.has(`${h.id}|${d}`))) continue;
      possible++;
      if (checks.has(`${h.id}|${d}`)) done++;
    }
  });

  if (missing) {
    return <p className="text-center py-24" style={{ ...sans, fontSize: '14px', color: MUTED }}>Habits are almost ready. The database update is still on its way.</p>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h2 style={{ ...sans, fontSize: '28px', fontWeight: 300, color: INK, lineHeight: 1.1 }}>Habits</h2>
          {possible > 0 && (
            <p style={{ ...sans, fontSize: '12px', color: MUTED, marginTop: '6px' }}>
              {Math.round((done / possible) * 100)}% of check-offs {isCurrent ? 'so far this month' : `in ${new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: 'long' })}`} · {done} done
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5" style={{ color: INK }}>‹</button>
          <span style={{ ...sans, fontSize: '14px', color: INK, minWidth: '9.5em' }} className="text-center">{monthLabel}</span>
          <button onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 disabled:opacity-20" style={{ color: INK }}>›</button>
        </div>
      </div>

      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}

      {habits === null ? (
        <p className="text-center py-24" style={{ ...sans, fontSize: '14px', color: '#c9b99a' }}>loading your habits…</p>
      ) : (
        <>
          {habits.length > 0 && (
            <HabitGrid habits={habits} year={ym.y} month={ym.m} checks={checks} onToggle={toggle} onRename={rename} onRemove={remove} />
          )}
          <div className="mt-8 max-w-md rounded-2xl px-5 py-4" style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}>
            {habits.length === 0 && <p style={{ ...sans, fontSize: '13px', color: INK, marginBottom: '10px' }}>No habits yet. Add one to start tracking.</p>}
            <AddHabitForm onAdded={h => setHabits(hs => [...hs, h])} />
          </div>
          <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '16px' }}>Tap any square to mark that day done or not done.</p>
        </>
      )}
    </div>
  );
}
