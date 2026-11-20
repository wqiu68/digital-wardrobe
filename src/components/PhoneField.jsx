import { useState, useEffect } from 'react';
import { getMyPhone, setMyPhone } from '../utils/friends';
import { formatPhone } from '../utils/phone';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';

// Your own (private) phone number, so friends can find you.
//   variant="banner": only shows when no number is saved (Friends page nudge)
//   variant="inline": always shows, with Add / Change (Profile page)
export default function PhoneField({ variant = 'inline' }) {
  const [phone, setPhone] = useState(null); // null = loading
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [missingTable, setMissingTable] = useState(false);

  useEffect(() => {
    getMyPhone().then(setPhone).catch(e => {
      setPhone('');
      // Before the database update runs, stay out of the way
      if (/phone_numbers|schema cache|does not exist/i.test(e.message || '')) setMissingTable(true);
    });
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      setPhone(await setMyPhone(draft));
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save your number.');
    } finally {
      setSaving(false);
    }
  }

  if (phone === null || missingTable) return null;
  if (variant === 'banner' && phone && !editing) return null;

  const form = (
    <form onSubmit={save} className="flex items-center gap-3 flex-wrap">
      <input
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        autoFocus={variant === 'inline'}
        value={draft}
        onChange={e => { setDraft(e.target.value); setError(''); }}
        placeholder="(555) 555-5555"
        style={{ ...sans, fontSize: '13px', color: INK, borderColor: '#d4ccc4' }}
        className="flex-1 min-w-40 bg-transparent border-b py-1.5 focus:outline-none placeholder:text-black/25"
      />
      <button type="submit" disabled={saving || (!draft.trim() && !phone)} style={{ ...sans, fontSize: '12px', backgroundColor: INK, color: '#FAF8F5' }} className="rounded-full px-4 py-1.5 hover:opacity-80 disabled:opacity-30">
        {saving ? 'Saving…' : 'Save'}
      </button>
      {variant === 'inline' && (
        <button type="button" onClick={() => { setEditing(false); setError(''); }} style={{ ...sans, fontSize: '12px', color: MUTED }} className="hover:text-black">Cancel</button>
      )}
    </form>
  );

  if (variant === 'banner') {
    return (
      <div className="rounded-2xl px-5 py-4 mb-10" style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}>
        <p style={{ ...sans, fontSize: '13px', color: INK, fontWeight: 500 }}>Add your phone number so friends can find you</p>
        <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '2px', marginBottom: '10px' }}>Only used for finding friends. Nobody can see it.</p>
        {form}
        {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center">
      {editing ? (
        <div className="w-full max-w-xs">{form}</div>
      ) : phone ? (
        <p style={{ ...sans, fontSize: '12px', color: MUTED }}>
          {formatPhone(phone)} ·{' '}
          <button onClick={() => { setDraft(formatPhone(phone)); setEditing(true); }} className="hover:text-black underline-offset-2 hover:underline">Change</button>
        </p>
      ) : (
        <button onClick={() => { setDraft(''); setEditing(true); }} style={{ ...sans, fontSize: '12px', color: INK }} className="hover:underline underline-offset-2">
          + Add phone number <span style={{ color: MUTED }}>so friends can find you</span>
        </button>
      )}
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{error}</p>}
      {editing && <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '8px' }}>Private. Only used so friends can find you. Clear it and save to remove.</p>}
    </div>
  );
}
