import posthog from 'posthog-js';
import { supabase } from './supabase';

// We use a fake email pattern so users only need a username + password
function toEmail(username) {
  return `${username.toLowerCase()}@dw-wardrobe.app`;
}

export async function register(username, password) {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 2) throw new Error('Username must be at least 2 characters.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const { data, error } = await supabase.auth.signUp({
    email: toEmail(trimmed),
    password,
    options: { data: { username: trimmed } },
  });

  if (error) {
    if (error.message.includes('already registered')) throw new Error('That username is already taken.');
    throw new Error(error.message);
  }

  posthog.identify(trimmed.toLowerCase());
  posthog.capture('account_created', { username: trimmed });
  return trimmed;
}

export async function login(username, password) {
  const trimmed = username.trim();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(trimmed),
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) throw new Error('Incorrect username or password.');
    throw new Error(error.message);
  }

  const displayName = data.user.user_metadata?.username || trimmed;
  posthog.identify(trimmed.toLowerCase());
  posthog.capture('user_logged_in');
  return displayName;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { username: session.user.user_metadata?.username || session.user.email };
}
