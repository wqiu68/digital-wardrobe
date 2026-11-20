import { useState, useEffect } from 'react';
import { getBooks } from '../utils/books';
import { getFriends, getMyProfile, updateDisplayName } from '../utils/friends';
import { getMyBorrowing } from '../utils/loans';
import { sortRanked, computeScores } from '../utils/ranking';
import { CATEGORIES } from './ItemModal';
import { ScoreBadge, MiniCover } from './RankedList';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';

export function Avatar({ name, size = 32 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: '#e6d9c6', color: INK, ...serif, fontSize: size * 0.5, lineHeight: 1 }}
    >
      {initial}
    </span>
  );
}

function mostCommon(values) {
  const counts = {};
  values.filter(Boolean).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function Stat({ value, label }) {
  return (
    <div className="py-4">
      <p style={{ ...serif, fontSize: '34px', fontWeight: 400, color: INK, lineHeight: 1, fontVariantNumeric: 'lining-nums' }}>{value}</p>
      <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '6px' }}>{label}</p>
    </div>
  );
}

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-3" style={{ borderTop: '1px solid #ece5dc' }}>
      <span style={{ ...sans, fontSize: '12px', color: MUTED }}>{label}</span>
      <span style={{ ...sans, fontSize: '13px', color: INK }} className="text-right truncate">{value}</span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section
      className="rounded-2xl px-6 pt-5 pb-3"
      style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}
    >
      <h3 style={{ ...serif, fontSize: '22px', color: INK }}>{title}</h3>
      {children}
    </section>
  );
}

export default function ProfileView({ fallbackName, items, lending, onNameChange, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [books, setBooks] = useState([]);
  const [friends, setFriends] = useState([]);
  const [borrowing, setBorrowing] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyProfile().then(setProfile).catch(e => setError(e.message));
    getBooks().then(setBooks).catch(() => {});
    getFriends().then(setFriends).catch(() => {});
    getMyBorrowing().then(b => setBorrowing(b.filter(l => l.status === 'lent'))).catch(() => {});
  }, []);

  async function saveName() {
    const name = draft.trim();
    if (!name) return;
    setSaving(true);
    try {
      await updateDisplayName(name);
      setProfile(p => ({ ...p, displayName: name }));
      onNameChange?.(name);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const topCategory = CATEGORIES.find(c => c.id === mostCommon(items.map(i => i.category)))?.label;
  const topBrand = mostCommon(items.map(i => i.brand?.trim()));

  const byStatus = s => books.filter(b => b.status === s).length;
  const ranked = sortRanked(books);
  const scores = computeScores(books);
  const favorite = ranked[0];
  const favGenre = mostCommon(ranked.length ? ranked.map(b => b.genre) : books.filter(b => b.status === 'read').map(b => b.genre));
  const pagesRead = books.filter(b => b.status === 'read').reduce((n, b) => n + (Number(b.pages) || 0), 0);
  const lentOut = lending.filter(l => l.status === 'lent').length;

  const name = profile?.displayName || fallbackName || '';
  const since = profile?.joinedAt ? new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Identity */}
      <div className="flex flex-col items-center text-center mb-10">
        <Avatar name={name || profile?.email} size={84} />
        {editing ? (
          <form onSubmit={e => { e.preventDefault(); saveName(); }} className="flex items-center gap-3 mt-5">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={40}
              style={{ ...serif, fontSize: '28px', color: INK, borderColor: '#d4ccc4' }}
              className="bg-transparent border-b text-center w-56 focus:outline-none"
            />
            <button type="submit" disabled={saving} style={{ ...sans, fontSize: '12px', color: INK }} className="hover:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{ ...sans, fontSize: '12px', color: MUTED }} className="hover:opacity-60">Cancel</button>
          </form>
        ) : (
          <div className="flex items-baseline gap-3 mt-5">
            <h2 style={{ ...serif, fontSize: '34px', fontWeight: 300, color: INK, lineHeight: 1 }}>{name || '…'}</h2>
            {profile && (
              <button onClick={() => { setDraft(name); setEditing(true); }} style={{ ...sans, fontSize: '11px', color: MUTED }} className="hover:text-black transition-colors">
                Edit
              </button>
            )}
          </div>
        )}
        <p style={{ ...sans, fontSize: '12px', color: MUTED, marginTop: '10px' }}>
          {[profile?.email, since && `member since ${since}`].filter(Boolean).join(' · ')}
        </p>
        {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '10px' }}>{error}</p>}
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-3 text-center mb-8 rounded-2xl" style={{ border: '1px solid #ece4d8' }}>
        <Stat value={items.length} label={items.length === 1 ? 'piece' : 'pieces'} />
        <div style={{ borderLeft: '1px solid #ece4d8', borderRight: '1px solid #ece4d8' }}>
          <Stat value={books.length} label={books.length === 1 ? 'book' : 'books'} />
        </div>
        <Stat value={friends.length} label={friends.length === 1 ? 'friend' : 'friends'} />
      </div>

      <div className="grid sm:grid-cols-2 gap-5 items-start">
        <Card title="Bookshelf">
          <div className="grid grid-cols-3 text-center">
            <Stat value={byStatus('read')} label="read" />
            <Stat value={byStatus('reading')} label="reading" />
            <Stat value={byStatus('want')} label="want to read" />
          </div>
          {favorite && (
            <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid #ece5dc' }}>
              <MiniCover book={favorite} w={30} />
              <div className="flex-1 min-w-0">
                <p style={{ ...sans, fontSize: '11px', color: MUTED }}>Top-ranked</p>
                <p style={{ ...serif, fontSize: '17px', color: INK, lineHeight: 1.2 }} className="truncate">{favorite.title}</p>
              </div>
              <ScoreBadge score={scores[favorite.id]} size={34} />
            </div>
          )}
          <Detail label="Books ranked" value={ranked.length ? String(ranked.length) : ''} />
          <Detail label="Favorite genre" value={favGenre} />
          <Detail label="Pages read" value={pagesRead ? pagesRead.toLocaleString() : ''} />
          <Detail label="Lent to friends now" value={lentOut ? String(lentOut) : ''} />
          <Detail label="Borrowing now" value={borrowing.length ? String(borrowing.length) : ''} />
        </Card>

        <Card title="Closet">
          <div className="grid grid-cols-2 text-center">
            <Stat value={new Set(items.map(i => i.category)).size} label="categories" />
            <Stat value={new Set(items.map(i => i.brand?.trim().toLowerCase()).filter(Boolean)).size} label="brands" />
          </div>
          <Detail label="Most of your closet" value={topCategory} />
          <Detail label="Favorite brand" value={topBrand} />
        </Card>
      </div>

      <div className="flex justify-center mt-12">
        <button
          onClick={onLogout}
          style={{ ...sans, fontSize: '12px', color: MUTED, border: '1px solid #e0d9d2' }}
          className="rounded-full px-5 py-2 hover:text-black hover:border-black/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
