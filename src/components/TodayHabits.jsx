import { useState, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { getHabits, addHabit, getChecks, setCheck, streak, dayKey, todayKey, isMissingTable } from '../utils/habits';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';
export const DONE = '#5f7d5a';

export function Check({ done, size = 22 }) {
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center transition-colors"
      style={{ width: size, height: size, border: `1.5px solid ${done ? DONE : '#cfc6bb'}`, backgroundColor: done ? DONE : 'transparent' }}
    >
      {done && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>
      )}
    </span>
  );
}

export function AddHabitForm({ onAdded, autoFocus, placeholder = 'Add a habit, e.g. Read 20 pages' }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const habit = await addHabit(name);
      posthog.capture('habit_added');
      setName('');
      onAdded(habit);
    } catch (err) {
      setError(err.message || 'Could not add that habit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ border: '1.5px dashed #cfc6bb', color: MUTED, fontSize: '14px', lineHeight: 1 }}>+</span>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          autoFocus={autoFocus}
          maxLength={80}
          placeholder={placeholder}
          style={{ ...sans, fontSize: '14px', color: INK }}
          className="flex-1 min-w-0 bg-transparent py-1 focus:outline-none placeholder:text-black/30"
        />
        {name.trim() && (
          <button type="submit" disabled={busy} style={{ ...sans, fontSize: '12px', backgroundColor: INK, color: '#FAF8F5' }} className="shrink-0 rounded-full px-3.5 py-1 hover:opacity-80 disabled:opacity-40">
            Add
          </button>
        )}
      </div>
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '6px' }}>{error}</p>}
    </form>
  );
}

const STARTERS = ['Drink 120oz of water', 'Read 10 pages', 'Be active for 30 minutes'];

function StarterHabits({ onAdded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function addAll() {
    setBusy(true);
    setError('');
    try {
      const added = [];
      for (const name of STARTERS) added.push(await addHabit(name));
      posthog.capture('habit_added', { starters: true });
      onAdded(added);
    } catch (e) {
      setError(e.message || 'Could not add those.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl px-4 py-3.5 mb-4" style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}>
      <ul className="space-y-1.5 mb-3">
        {STARTERS.map(n => (
          <li key={n} className="flex items-center gap-3" style={{ ...sans, fontSize: '14px', color: INK }}><Check done={false} size={18} />{n}</li>
        ))}
      </ul>
      <button onClick={addAll} disabled={busy} style={{ ...sans, fontSize: '12px', backgroundColor: INK, color: '#FAF8F5' }} className="rounded-full px-4 py-1.5 hover:opacity-80 disabled:opacity-40">
        {busy ? 'Adding…' : 'Add these 3'}
      </button>
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{error}</p>}
    </div>
  );
}

// The daily checklist on the home page
export default function TodayHabits({ onOpenMonth, refreshKey }) {
  const [habits, setHabits] = useState(null); // null = loading
  const [checks, setChecks] = useState(new Set());
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const today = todayKey();
  const pending = useRef(0);

  async function load() {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 120); // enough history for streaks
      const [h, c] = await Promise.all([getHabits(), getChecks(dayKey(from), today)]);
      if (pending.current === 0) { setHabits(h); setChecks(c); }
    } catch (e) {
      if (isMissingTable(e)) setMissing(true);
      setHabits([]);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [refreshKey]);

  async function toggle(habit) {
    const key = `${habit.id}|${today}`;
    const done = !checks.has(key);
    const flip = on => setChecks(prev => { const next = new Set(prev); if (on) next.add(key); else next.delete(key); return next; });
    flip(done);
    setError('');
    pending.current++;
    try {
      await setCheck(habit.id, today, done);
      if (done) posthog.capture('habit_checked');
    } catch {
      flip(!done);
      setError("Couldn't save that. Try again.");
    } finally {
      pending.current--;
    }
  }

  if (missing || habits === null) return null;

  const doneCount = habits.filter(h => checks.has(`${h.id}|${today}`)).length;
  const allDone = habits.length > 0 && doneCount === habits.length;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="rounded-2xl px-6 sm:px-8 py-6 mb-8 sm:mb-10" style={{ backgroundColor: '#fff', border: '1px solid #ece4d8' }}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <div>
          <h3 style={{ ...sans, fontSize: '18px', fontWeight: 500, color: INK }}>Today</h3>
          <p style={{ ...sans, fontSize: '12px', color: MUTED, marginTop: '2px' }}>{dateLabel}</p>
        </div>
        {habits.length > 0 && (
          <p style={{ ...sans, fontSize: '12px', color: allDone ? DONE : MUTED, fontWeight: allDone ? 600 : 400 }}>
            {allDone ? 'All done today ✓' : `${doneCount} of ${habits.length} done`}
          </p>
        )}
      </div>

      {habits.length === 0 && (
        <p style={{ ...sans, fontSize: '13px', color: MUTED, marginBottom: '14px', lineHeight: 1.5 }}>
          What do you want to do every day? Start with these, or add your own below.
        </p>
      )}
      {habits.length === 0 && <StarterHabits onAdded={hs => setHabits(hs)} />}

      <ul className="space-y-1">
        {habits.map(h => {
          const done = checks.has(`${h.id}|${today}`);
          const s = streak(checks, h.id);
          return (
            <li key={h.id}>
              <button onClick={() => toggle(h)} className="w-full flex items-center gap-3 py-2 text-left group" aria-pressed={done}>
                <Check done={done} />
                <span style={{ ...sans, fontSize: '14px', color: done ? MUTED : INK, textDecoration: done ? 'line-through' : 'none', textDecorationColor: '#cfc6bb' }} className="flex-1 min-w-0 truncate group-hover:opacity-80">
                  {h.name}
                </span>
                {s >= 2 && <span style={{ ...sans, fontSize: '11px', color: MUTED }} className="shrink-0">{s}-day streak</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={habits.length ? 'mt-2' : ''}>
        <AddHabitForm onAdded={h => setHabits(prev => [...prev, h])} placeholder={habits.length ? 'Add a habit' : 'e.g. Read 20 pages'} />
      </div>
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{error}</p>}

      {habits.length > 0 && (
        <div className="mt-5 pt-4 flex justify-end" style={{ borderTop: '1px solid #f0ebe3' }}>
          <button onClick={onOpenMonth} style={{ ...sans, fontSize: '12px', color: INK }} className="hover:underline underline-offset-2">
            See your month →
          </button>
        </div>
      )}
    </section>
  );
}
