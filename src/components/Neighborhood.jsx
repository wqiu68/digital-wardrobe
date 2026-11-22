import { useState, useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import HomeArt from './HomeArt';
import { SKIN, HAIR, SHIRT, lookFor } from '../utils/look';
import Village from './Village';
import FriendFeed from './FriendFeed';
import { LEVELS, PAINTS, EXTRAS, POINTS, DEFAULT_HOME, getHomes, getMyPoints, buyUpgrade, setPaint, getReadingNow, isMissingHomes, setMyLook, facePhoto } from '../utils/homes';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';
const GRASS = '#e4ead9';

// ─── Your home: points + shop ───────────────────────────────────────────────

function ShopItem({ label, swatch, price, state, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors"
      style={{ ...sans, border: `1.5px solid ${selected ? INK : '#ece4d8'}`, backgroundColor: selected ? '#fff' : '#fbf8f3' }}
    >
      {swatch && <span className="shrink-0 w-4 h-4 rounded-full" style={{ backgroundColor: swatch, border: '1px solid rgba(0,0,0,.08)' }} />}
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: '12.5px', color: INK }}>{label}</span>
        <span className="block" style={{ fontSize: '10.5px', color: state === 'in use' ? '#5f7d5a' : MUTED, fontWeight: state === 'in use' ? 600 : 400 }}>
          {state || `${price} pts`}
        </span>
      </span>
    </button>
  );
}

// Pick your person's colors, or put your own face on them
function Swatches({ colors, value, onPick, label }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ ...sans, fontSize: '11.5px', color: MUTED, width: '42px' }} className="shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <button key={c} onClick={() => onPick(i)} aria-label={`${label} ${i + 1}`} aria-pressed={value === c}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px #FAF8F5, 0 0 0 3.5px ${INK}` : 'inset 0 0 0 1px rgba(0,0,0,.08)' }} />
        ))}
      </div>
    </div>
  );
}

function LookEditor({ seed, look, photo, onLook, onPhoto }) {
  const file = useRef(null);
  const [error, setError] = useState('');
  const cur = lookFor(seed, look);
  async function upload(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError('');
    try { onPhoto(await facePhoto(f)); } catch (err) { setError(err.message); }
  }
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <span style={{ ...sans, fontSize: '11.5px', color: MUTED, width: '42px' }} className="shrink-0">Face</span>
        {photo && <img src={photo} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: '1px solid #ece4d8' }} />}
        <button onClick={() => file.current?.click()} style={{ ...sans, fontSize: '12px', color: INK, border: '1px solid #e0d9d2' }} className="rounded-full px-3 py-1 hover:border-black/40">
          {photo ? 'Change photo' : 'Add your photo'}
        </button>
        {photo && <button onClick={() => onPhoto(null)} style={{ ...sans, fontSize: '12px', color: MUTED }} className="hover:text-black">Use drawn face</button>}
        <input ref={file} type="file" accept="image/*" onChange={upload} className="hidden" />
      </div>
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b' }}>{error}</p>}
      {!photo && <Swatches label="Skin" colors={SKIN} value={cur.skin} onPick={i => onLook({ ...look, skin: i })} />}
      {!photo && (
        <div className="flex items-center gap-3">
          <Swatches label="Hair" colors={HAIR} value={cur.hair} onPick={i => onLook({ ...look, hair: i })} />
          <div className="flex rounded-full p-0.5 ml-auto" style={{ border: '1px solid #e0d9d2' }}>
            {[['Short', false], ['Long', true]].map(([l, v]) => (
              <button key={l} onClick={() => onLook({ ...look, long: v })} style={{ ...sans, fontSize: '11px', color: cur.long === v ? '#FAF8F5' : INK, backgroundColor: cur.long === v ? INK : 'transparent' }} className="rounded-full px-2.5 py-0.5">{l}</button>
            ))}
          </div>
        </div>
      )}
      <Swatches label="Shirt" colors={SHIRT} value={cur.shirt} onPick={i => onLook({ ...look, shirt: i })} />
    </div>
  );
}

function MyHome({ seed, home, onHome, onClose }) {
  const [points, setPoints] = useState(null);
  const [pick, setPick] = useState(null); // item id being previewed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [look, setLook] = useState(home.look || {});
  const [photo, setPhoto] = useState(home.photo || null);
  const [savingLook, setSavingLook] = useState(false);

  useEffect(() => {
    getMyPoints().then(setPoints).catch(e => { if (isMissingHomes(e)) setMissing(true); else setError(e.message); });
  }, []);

  const owned = new Set(home.owned);
  const nextLevel = LEVELS.find(l => l.level === home.level + 1);
  const paint = PAINTS.find(p => p.id === pick);
  const extra = EXTRAS.find(x => x.id === pick);
  const isLevel = nextLevel && pick === nextLevel.id;

  // Show the change on the house before buying
  const base = { ...home, look, photo };
  const preview = !pick ? base
    : isLevel ? { ...base, level: nextLevel.level }
    : paint ? { ...base, paint: paint.id }
    : extra ? { ...base, owned: [...home.owned, extra.id] }
    : base;
  const lookChanged = JSON.stringify(look) !== JSON.stringify(home.look || {}) || (photo || null) !== (home.photo || null);

  async function saveLook() {
    setSavingLook(true);
    setError('');
    try {
      onHome(await setMyLook(look, photo));
      posthog.capture('avatar_updated', { photo: !!photo });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingLook(false);
    }
  }

  const item = isLevel ? nextLevel : paint || extra;
  const have = item && (paint ? paint.id === 'cream' || owned.has(paint.id) : extra ? owned.has(extra.id) : false);
  const balance = points?.balance ?? 0;

  async function act() {
    if (!item || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = have ? await setPaint(item.id) : await buyUpgrade(item.id);
      if (!have) posthog.capture('home_upgrade_bought', { item: item.id });
      onHome(next);
      setPick(null);
      setPoints(await getMyPoints());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  let action = null;
  if (item) {
    if (have && paint) action = home.paint === paint.id ? { label: 'In use', disabled: true } : { label: `Paint it ${paint.label.toLowerCase()}` };
    else if (have) action = { label: 'Already in your yard', disabled: true };
    else if (balance < item.price) action = { label: `${item.price - balance} more points to go`, disabled: true };
    else action = { label: `Buy for ${item.price} pts` };
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} />
      <section
        className="fixed z-50 inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] sm:max-h-[88vh] sm:rounded-2xl overflow-y-auto shadow-2xl"
        style={{ backgroundColor: '#FAF8F5', paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Your home"
      >
        <div className="relative" style={{ backgroundColor: GRASS }}>
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-3 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/70 hover:bg-white" style={{ color: INK }}>✕</button>
          <div className="mx-auto max-w-[320px] pt-6">
            <HomeArt home={preview} seed={seed} waving className="w-full h-auto" />
          </div>
          <div style={{ backgroundColor: '#ddd5c8', height: '8px' }} />
        </div>

        <div className="px-5 sm:px-7 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 style={{ ...sans, fontSize: '18px', fontWeight: 500, color: INK }}>Your home</h2>
              {points && (
                <p style={{ ...sans, fontSize: '11.5px', color: MUTED, marginTop: '2px', lineHeight: 1.5 }}>
                  {points.books} books read · {points.pieces} closet pieces · {points.checks} habit check-offs
                </p>
              )}
            </div>
            <div className="text-right">
              <p style={{ ...sans, fontSize: '26px', fontWeight: 600, color: INK, lineHeight: 1 }}>{points ? balance : '…'}</p>
              <p style={{ ...sans, fontSize: '10px', color: MUTED, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '4px' }}>points</p>
            </div>
          </div>
          <p style={{ ...sans, fontSize: '11.5px', color: MUTED, marginTop: '10px' }}>
            Earn {POINTS.book} for every book you finish, {POINTS.piece} for each piece in your closet, and {POINTS.check} for every habit you check off.
          </p>

          {missing ? (
            <p style={{ ...sans, fontSize: '13px', color: '#c0392b', marginTop: '18px' }}>The shop needs a database update first.</p>
          ) : (
            <>
              <div className="flex items-center justify-between" style={{ margin: '22px 0 10px' }}>
                <h3 style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Your look · free</h3>
                {lookChanged && (
                  <button onClick={saveLook} disabled={savingLook} style={{ ...sans, fontSize: '12px', backgroundColor: INK, color: '#FAF8F5' }} className="rounded-full px-3.5 py-1 hover:opacity-85 disabled:opacity-40">
                    {savingLook ? 'Saving…' : 'Save look'}
                  </button>
                )}
              </div>
              <LookEditor seed={seed} look={look} photo={photo} onLook={setLook} onPhoto={setPhoto} />

              <h3 style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED, margin: '22px 0 8px' }}>Bigger house</h3>
              <div className="grid grid-cols-2 gap-2">
                {nextLevel
                  ? <ShopItem label={nextLevel.label} price={nextLevel.price} selected={pick === nextLevel.id} onClick={() => setPick(p => (p === nextLevel.id ? null : nextLevel.id))} />
                  : <p style={{ ...sans, fontSize: '12px', color: MUTED }}>You have the biggest house on the block.</p>}
              </div>

              <h3 style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED, margin: '18px 0 8px' }}>Paint</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAINTS.map(p => (
                  <ShopItem key={p.id} label={p.label} swatch={p.color} price={p.price}
                    state={home.paint === p.id ? 'in use' : p.id === 'cream' || owned.has(p.id) ? 'owned' : null}
                    selected={pick === p.id} onClick={() => setPick(x => (x === p.id ? null : p.id))} />
                ))}
              </div>

              <h3 style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED, margin: '18px 0 8px' }}>Yard</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXTRAS.map(x => (
                  <ShopItem key={x.id} label={x.label} price={x.price} state={owned.has(x.id) ? 'in your yard' : null}
                    selected={pick === x.id} onClick={() => setPick(p => (p === x.id ? null : x.id))} />
                ))}
              </div>
            </>
          )}
          {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '12px' }}>{error}</p>}
        </div>

        {action && (
          <div className="sticky bottom-0 px-5 sm:px-7 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: '#FAF8F5', borderTop: '1px solid #ece4d8' }}>
            <span style={{ ...sans, fontSize: '12px', color: MUTED }}>Previewing {item.label.toLowerCase()}</span>
            <button onClick={act} disabled={busy || action.disabled} style={{ ...sans, fontSize: '12.5px', backgroundColor: INK, color: '#FAF8F5' }} className="rounded-full px-5 py-2 hover:opacity-85 disabled:opacity-40">
              {busy ? '…' : action.label}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

// ─── Village + recent activity ──────────────────────────────────────────────

export default function Neighborhood({ me, friends, scope, onOpenFriend, onInvite }) {
  const [homes, setHomes] = useState({});
  const [reading, setReading] = useState({});
  const [mine, setMine] = useState(false);
  const [tab, setTab] = useState('village');
  const ids = friends.map(f => f.userId);
  const key = ids.join(',');

  useEffect(() => {
    if (!me) return;
    getHomes([me, ...ids]).then(setHomes).catch(() => {});
    getReadingNow(ids).then(setReading).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, key]);

  const homeOf = id => homes[id] || DEFAULT_HOME;

  // You sit in the middle of the ring, friends either side, the empty lot last
  const friendLots = friends.map(f => ({
    id: f.userId, seed: f.userId, name: f.displayName || f.email, home: homeOf(f.userId),
    sub: reading[f.userId] ? `📖 ${reading[f.userId]}` : null,
    onClick: () => onOpenFriend(f),
  }));
  const meLot = { id: me, seed: me, name: 'You', you: true, home: homeOf(me), sub: 'Upgrade your home →', onClick: () => setMine(true) };
  const half = Math.ceil(friendLots.length / 2);
  const lots = [...friendLots.slice(0, half), meLot, ...friendLots.slice(half), { id: 'invite', name: 'Invite a friend', invite: true, onClick: onInvite }];

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{ ...sans, fontSize: '12px', fontWeight: tab === id ? 600 : 400, color: tab === id ? '#FAF8F5' : INK, backgroundColor: tab === id ? INK : 'transparent' }}
      className="rounded-full px-4 py-1.5 transition-colors"
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h2 style={{ ...sans, fontSize: '20px', fontWeight: 400, color: INK }}>Your Village</h2>
        <div className="flex items-center gap-1 rounded-full p-1" style={{ border: '1px solid #e0d9d2' }}>
          {tabBtn('village', 'Village')}
          {tabBtn('recent', 'Recent')}
        </div>
      </div>

      {tab === 'village' ? (
        <>
          <p style={{ ...sans, fontSize: '12px', color: MUTED, marginBottom: '12px' }}>Tap a house to visit. Tap yours to change your look and upgrade it.</p>
          <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid #dfe5d3' }}>
            <Village lots={lots} />
          </div>
        </>
      ) : (
        <FriendFeed friends={friends} homes={homes} scope={scope} onOpenFriend={onOpenFriend} />
      )}

      {mine && <MyHome seed={me} home={homeOf(me)} onHome={h => setHomes(prev => ({ ...prev, [me]: h }))} onClose={() => setMine(false)} />}
    </section>
  );
}
