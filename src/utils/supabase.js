import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The signed-in user, cached. auth.getUser() makes a network call while holding
// a browser lock, so firing many at once (e.g. on page load) makes them fight
// over the lock ("Lock broken by another request with the 'steal' option").
// Row-level security still checks the real session on every query.
let cachedUser;
let pending = null;
supabase.auth.onAuthStateChange((_event, session) => { cachedUser = session?.user ?? null; });

export async function getCurrentUser() {
  if (cachedUser !== undefined) return cachedUser;
  pending ??= supabase.auth.getSession().then(({ data: { session } }) => {
    cachedUser = session?.user ?? null;
    pending = null;
    return cachedUser;
  });
  return pending;
}
