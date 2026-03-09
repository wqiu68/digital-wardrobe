import posthog from 'posthog-js';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'dw-v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadAccounts() {
  try { return JSON.parse(localStorage.getItem('dw:accounts') || '{}'); }
  catch { return {}; }
}

function saveAccounts(accounts) {
  localStorage.setItem('dw:accounts', JSON.stringify(accounts));
}

export async function register(username, password) {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 2) throw new Error('Username must be at least 2 characters.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');

  const accounts = loadAccounts();
  if (accounts[trimmed.toLowerCase()]) throw new Error('That username is already taken.');

  const hash = await hashPassword(password);
  accounts[trimmed.toLowerCase()] = { username: trimmed, hash, createdAt: Date.now() };
  saveAccounts(accounts);
  startSession(trimmed);
  posthog.identify(trimmed.toLowerCase());
  posthog.capture('account_created', { username: trimmed });
  return trimmed;
}

export async function login(username, password) {
  const accounts = loadAccounts();
  const account = accounts[username.trim().toLowerCase()];
  if (!account) throw new Error('Account not found.');
  const hash = await hashPassword(password);
  if (hash !== account.hash) throw new Error('Incorrect password.');
  startSession(account.username);
  posthog.identify(account.username.toLowerCase());
  posthog.capture('user_logged_in');
  return account.username;
}

function startSession(username) {
  localStorage.setItem('dw:session', JSON.stringify({ username, at: Date.now() }));
}

export function logout() {
  localStorage.removeItem('dw:session');
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem('dw:session')); }
  catch { return null; }
}
