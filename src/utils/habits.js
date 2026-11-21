import { supabase, getCurrentUser } from './supabase';

// Days are the person's local calendar date as 'YYYY-MM-DD'
export function dayKey(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export const todayKey = () => dayKey(new Date());

const fromDb = r => ({ id: r.id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at });

export async function getHabits() {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromDb);
}

export async function addHabit(name) {
  const user = await getCurrentUser();
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error('Give the habit a name.');
  const { data: last } = await supabase
    .from('habits').select('sort_order').is('archived_at', null)
    .order('sort_order', { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: user.id, name: clean, sort_order: (last?.[0]?.sort_order ?? -1) + 1 })
    .select().single();
  if (error) throw error;
  return fromDb(data);
}

export async function renameHabit(id, name) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error('Give the habit a name.');
  const { error } = await supabase.from('habits').update({ name: clean }).eq('id', id);
  if (error) throw error;
}

// Keeps past check-offs, just stops showing the habit
export async function removeHabit(id) {
  const { error } = await supabase.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Set of `${habitId}|${day}` for days between from and to (inclusive)
export async function getChecks(from, to) {
  const { data, error } = await supabase
    .from('habit_checks')
    .select('habit_id, day')
    .gte('day', from)
    .lte('day', to);
  if (error) throw error;
  return new Set((data || []).map(r => `${r.habit_id}|${r.day}`));
}

export async function setCheck(habitId, day, done) {
  if (done) {
    const user = await getCurrentUser();
    const { error } = await supabase
      .from('habit_checks')
      .upsert({ habit_id: habitId, user_id: user.id, day }, { onConflict: 'habit_id,day', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('day', day);
    if (error) throw error;
  }
}

// Consecutive days done, ending today (or yesterday, so a streak isn't "broken" before you've had a chance today)
export function streak(checks, habitId, today = new Date()) {
  const d = new Date(today);
  if (!checks.has(`${habitId}|${dayKey(d)}`)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (checks.has(`${habitId}|${dayKey(d)}`)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const isMissingTable = e => /habit|schema cache|does not exist/i.test(e?.message || '');
