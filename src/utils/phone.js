// Phone numbers are stored in E.164 (+14155550123) so "(415) 555-0123",
// "415.555.0123" and "+1 415 555 0123" all match the same person.
// Numbers without a country code are assumed to be US/Canada (+1).
export function normalizePhone(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : '';
  if (raw.startsWith('00')) return normalizePhone(`+${digits.slice(2)}`);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

// +14155550123 → (415) 555-0123; other countries stay as-is
export function formatPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '';
}

// "Choose from contacts": Chrome on Android today. iPhone Safari doesn't
// allow websites to read contacts, so the button is hidden there.
export const canPickContacts = typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in (navigator.contacts || {});

export async function pickContacts() {
  const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
  return picked.flatMap(c => (c.tel || []).map(tel => ({ name: c.name?.[0] || '', phone: normalizePhone(tel) })))
    .filter(c => c.phone);
}

// Text someone the homey link via the phone's share sheet (falls back to copying it)
export async function inviteByText(name) {
  const url = window.location.origin;
  const text = `${name ? `Hey ${name}! ` : ''}I'm using homey to share my closet and bookshelf. Join me: ${url}`;
  if (navigator.share) {
    try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
