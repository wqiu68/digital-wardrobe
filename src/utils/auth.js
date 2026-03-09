import posthog from 'posthog-js';
import { supabase } from './supabase';

export async function register(email, password) {
  if (!email.includes('@')) throw new Error('Please enter a valid email address.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already registered')) throw new Error('An account with this email already exists.');
    throw new Error(error.message);
  }

  posthog.identify(email);
  posthog.capture('account_created', { email });
  return email;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login credentials')) throw new Error('Incorrect email or password.');
    throw new Error(error.message);
  }

  posthog.identify(email);
  posthog.capture('user_logged_in');
  return data.user.email;
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

export async function logout() {
  await supabase.auth.signOut();
}
