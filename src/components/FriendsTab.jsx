import { useState, useEffect } from 'react';
import { CATEGORIES } from './ItemModal';
import {
  getFriends,
  getPendingRequests,
  getOutgoingRequests,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  getFriendItems,
} from '../utils/friends';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

// ─── Read-only item card (no drag / edit / delete) ────────────────────────────

function ReadOnlyItemCard({ item }) {
  const cat = CATEGORIES.find(c => c.id === item.category);
  let hostname = '';
  try { hostname = new URL(item.sourceUrl).hostname.replace(/^www\./, ''); } catch {}

  return (
    <div className="group">
      <div className="aspect-[3/4] w-full overflow-hidden relative mb-3" style={{ backgroundColor: '#f5f0eb' }}>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-15">{cat?.emoji}</span>
            </div>
          )
        }
      </div>
      <div>
        <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="truncate">{item.name}</p>
        {(item.brand || item.color) && (
          <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px', letterSpacing: '0.02em' }} className="truncate">
            {[item.brand, item.color].filter(Boolean).join(' · ')}
          </p>
        )}
        {item.size && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e', marginTop: '2px' }}>Size {item.size}</p>}
        {hostname && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...sans, fontSize: '11px', color: '#c9b99a', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            className="hover:opacity-70 transition-opacity"
          >
            <span>↗</span>{hostname}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Friend's closet ─────────────────────────────────────────────────────────

function FriendClosetView({ friend, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeOccasion, setActiveOccasion] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    getFriendItems(friend.userId)
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [friend.userId]);

  const counts = {};
  items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });

  const filtered = items.filter(i => {
    const matchCat = activeCategory === 'ALL' || i.category === activeCategory;
    const occasions = i.occasions?.length ? i.occasions : ['everyday', 'work', 'athletic'];
    const matchOccasion = activeOccasion === 'ALL' || occasions.includes(activeOccasion);
    return matchCat && matchOccasion;
  });

  const tabs = [{ id: 'ALL', label: 'All' }, ...CATEGORIES];

  return (
    <div>
      {/* Back + title */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          style={{ ...sans, fontSize: '11px', color: '#b0a89e', letterSpacing: '0.05em' }}
          className="hover:opacity-60 transition-opacity flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M9 2L4 7l5 5"/>
          </svg>
          Friends
        </button>
        <h2 style={{ ...serif, fontSize: '22px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic' }}>
          {friend.displayName || friend.email}'s Closet
        </h2>
        {!loading && (
          <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{items.length} {items.length === 1 ? 'piece' : 'pieces'}</span>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 overflow-x-auto scrollbar-hide mb-8" style={{ borderBottom: '1px solid #e8e3de' }}>
        {tabs.map(cat => {
          const count = cat.id === 'ALL' ? items.length : (counts[cat.id] || 0);
          if (cat.id !== 'ALL' && count === 0) return null;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 px-4 py-3 transition-all"
              style={{
                ...sans,
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: isActive ? '#1a1713' : '#b0a89e',
                borderBottom: isActive ? '1px solid #1a1713' : '1px solid transparent',
                marginBottom: '-1px',
                background: 'none',
              }}
            >
              {cat.label} {count > 0 && <span style={{ opacity: 0.5 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Occasion filter */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <span style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.2em', textTransform: 'uppercase', marginRight: '4px' }}>
          Occasion
        </span>
        {[
          { id: 'ALL',      label: 'All'          },
          { id: 'everyday', label: 'Everyday'     },
          { id: 'work',     label: 'Work & Formal'},
          { id: 'athletic', label: 'Athletic'     },
        ].map(o => (
          <button
            key={o.id}
            onClick={() => setActiveOccasion(o.id)}
            style={{
              ...sans,
              fontSize: '10px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '5px 12px',
              backgroundColor: activeOccasion === o.id ? '#1a1713' : 'transparent',
              color: activeOccasion === o.id ? '#FAF8F5' : '#a09890',
              border: `1px solid ${activeOccasion === o.id ? '#1a1713' : '#e0d9d2'}`,
            }}
            className="transition-all hover:border-black/30"
          >
            {o.label}
          </button>
        ))}
      </div>

      {error && <p style={{ ...sans, fontSize: '13px', color: '#c0392b' }}>{error}</p>}

      {loading ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}>loading closet…</p>
      ) : filtered.length === 0 ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}>
          {items.length === 0 ? `${friend.displayName || 'They'} hasn't added anything yet.` : 'Nothing in this category.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
          {filtered.map(item => (
            <ReadOnlyItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Friends tab (list + add friend) ─────────────────────────────────────────

export default function FriendsTab({ onPendingCountChange }) {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    try {
      const [f, p, o] = await Promise.all([getFriends(), getPendingRequests(), getOutgoingRequests()]);
      setFriends(f);
      setPendingRequests(p);
      setOutgoingRequests(o);
      onPendingCountChange?.(p.length);
    } catch (e) {
      console.error('Friends load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true);
    setAddError('');
    setAddSuccess('');
    try {
      const profile = await sendFriendRequest(addEmail.trim());
      setAddSuccess(`Friend request sent to ${profile.display_name || profile.email}.`);
      setAddEmail('');
      await loadAll();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRespond(id, accept) {
    try {
      await respondToRequest(id, accept);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRemove(friendshipId, name) {
    if (!confirm(`Remove ${name || 'this friend'}?`)) return;
    try {
      await removeFriend(friendshipId);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  }

  // Viewing a specific friend's closet
  if (selectedFriend) {
    return (
      <FriendClosetView
        friend={selectedFriend}
        onBack={() => setSelectedFriend(null)}
      />
    );
  }

  return (
    <div className="max-w-lg">

      {/* ── Add a friend ── */}
      <div className="mb-12">
        <h2 style={{ ...serif, fontSize: '20px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic', marginBottom: '16px' }}>
          Add a Friend
        </h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="email"
            value={addEmail}
            onChange={e => { setAddEmail(e.target.value); setAddError(''); setAddSuccess(''); }}
            placeholder="Enter their email address"
            style={{ ...sans, fontSize: '13px', color: '#1a1713', borderColor: '#d4ccc4', flex: 1 }}
            className="bg-transparent border-b py-1.5 focus:outline-none placeholder:text-black/20"
          />
          <button
            type="submit"
            disabled={adding || !addEmail.trim()}
            style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
            className="px-5 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {adding ? '…' : 'Invite'}
          </button>
        </form>
        {addError && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '8px' }}>{addError}</p>}
        {addSuccess && <p style={{ ...sans, fontSize: '12px', color: '#7a9e7e', marginTop: '8px' }}>{addSuccess}</p>}
      </div>

      {loading ? (
        <p style={{ ...serif, fontSize: '18px', color: '#c9b99a', fontStyle: 'italic' }}>loading…</p>
      ) : (
        <>
          {/* ── Incoming friend requests ── */}
          {pendingRequests.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-4">
                <h3 style={{ ...serif, fontSize: '16px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic' }}>
                  Friend Requests
                </h3>
                <span style={{ ...sans, fontSize: '11px', color: '#c9b99a', fontWeight: 600 }}>{pendingRequests.length}</span>
                <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
              </div>
              <div className="flex flex-col" style={{ borderTop: '1px solid #f0ebe3' }}>
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #f0ebe3' }}>
                    <div>
                      <p style={{ ...sans, fontSize: '13px', color: '#1a1713', fontWeight: 500 }}>{req.displayName || req.email}</p>
                      {req.displayName && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{req.email}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespond(req.id, true)}
                        style={{ ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
                        className="px-4 py-1.5 hover:opacity-80 transition-opacity"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, false)}
                        style={{ ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b0a89e', border: '1px solid #e8e3de' }}
                        className="px-4 py-1.5 hover:opacity-70 transition-opacity"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Friends list ── */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <h3 style={{ ...serif, fontSize: '16px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic' }}>
                My Friends
              </h3>
              <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{friends.length}</span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
            </div>
            {friends.length === 0 ? (
              <p style={{ ...serif, fontSize: '16px', color: '#c9b99a', fontStyle: 'italic' }}>
                No friends yet. Invite someone above.
              </p>
            ) : (
              <div className="flex flex-col" style={{ borderTop: '1px solid #f0ebe3' }}>
                {friends.map(f => (
                  <div key={f.friendshipId} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #f0ebe3' }}>
                    <div>
                      <p style={{ ...sans, fontSize: '13px', color: '#1a1713', fontWeight: 500 }}>{f.displayName || f.email}</p>
                      {f.displayName && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{f.email}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedFriend(f)}
                        style={{ ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a1713', borderBottom: '1px solid #1a1713' }}
                        className="hover:opacity-60 transition-opacity"
                      >
                        View Closet
                      </button>
                      <button
                        onClick={() => handleRemove(f.friendshipId, f.displayName || f.email)}
                        style={{ color: '#d4ccc4' }}
                        className="hover:opacity-60 transition-opacity"
                        title="Remove friend"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <path d="M2 2l8 8M10 2l-8 8"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pending outgoing requests ── */}
          {outgoingRequests.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <h3 style={{ ...serif, fontSize: '16px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic' }}>
                  Sent
                </h3>
                <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
              </div>
              <div className="flex flex-col" style={{ borderTop: '1px solid #f0ebe3' }}>
                {outgoingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #f0ebe3' }}>
                    <div>
                      <p style={{ ...sans, fontSize: '13px', color: '#b0a89e' }}>{req.displayName || req.email}</p>
                      {req.displayName && <p style={{ ...sans, fontSize: '11px', color: '#d4ccc4' }}>{req.email}</p>}
                    </div>
                    <span style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
