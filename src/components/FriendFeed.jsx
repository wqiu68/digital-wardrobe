import { useState, useEffect } from 'react';
import { Person } from './HomeArt';
import { getFeed } from '../utils/feed';
import { SENTIMENTS } from '../utils/ranking';
import { CATEGORIES } from './ItemModal';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';

function ago(at) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Their face: their photo, or their little person's face from the map
function Avatar({ seed, home }) {
  if (home?.photo) return <img src={home.photo} alt="" className="shrink-0 w-9 h-9 rounded-full object-cover" />;
  return (
    <span className="shrink-0 w-9 h-9 rounded-full overflow-hidden" style={{ backgroundColor: '#e4ead9' }}>
      <svg viewBox="132 116 36 36" className="w-full h-full"><Person seed={seed} look={home?.look} /></svg>
    </span>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function headline(post) {
  const b = post.book;
  const t = x => <span style={{ fontStyle: 'italic' }}>{x.title}</span>;
  switch (post.type) {
    case 'closet': return post.items.length === 1 ? <>added {post.items[0].name} to their closet</> : <>added {plural(post.items.length, 'piece', 'pieces')} to their closet</>;
    case 'books': {
      const n = post.books.length;
      if (n === 1) return post.shelf === 'want' ? <>wants to read {t(post.books[0])}</> : post.shelf === 'reading' ? <>started reading {t(post.books[0])}</> : <>added {t(post.books[0])} to their shelf</>;
      return post.shelf === 'want' ? <>added {n} books to want to read</> : post.shelf === 'reading' ? <>started reading {n} books</> : <>added {n} books they've read</>;
    }
    case 'finished': return <>finished {t(b)}</>;
    case 'ranked': return post.finished ? <>finished {t(b)} and ranked it</> : <>ranked {t(b)}</>;
    default: return null;
  }
}

function Thumb({ item }) {
  const cat = CATEGORIES.find(c => c.id === item.category);
  return (
    <div className="aspect-[3/4] rounded-lg overflow-hidden" style={{ backgroundColor: '#f5f0eb' }}>
      {item.image
        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        : <div className="w-full h-full flex items-center justify-center text-2xl opacity-25">{cat?.emoji}</div>}
    </div>
  );
}

function Cover({ book, big }) {
  return (
    <div className={`${big ? 'w-16' : 'w-12'} shrink-0 aspect-[2/3] rounded-md overflow-hidden shadow-sm`} style={{ backgroundColor: '#ece4d8' }}>
      {book.cover
        ? <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
        : <div className="w-full h-full flex items-center justify-center p-1 text-center" style={{ ...sans, fontSize: '8px', color: MUTED }}>{book.title}</div>}
    </div>
  );
}

function Body({ post }) {
  if (post.type === 'closet') {
    const shown = post.items.slice(0, 4);
    const extra = post.items.length - shown.length;
    return (
      <div className="grid grid-cols-4 gap-2">
        {shown.map((it, i) => (
          <div key={it.id} className="relative">
            <Thumb item={it} />
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 rounded-lg flex items-center justify-center" style={{ ...sans, backgroundColor: 'rgba(26,23,19,.45)', color: '#fff', fontSize: '15px', fontWeight: 600 }}>+{extra}</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (post.type === 'books') {
    if (post.books.length === 1) {
      const b = post.books[0];
      return (
        <div className="flex gap-3 items-center">
          <Cover book={b} big />
          <div className="min-w-0">
            <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: INK }} className="truncate">{b.title}</p>
            {b.author && <p style={{ ...sans, fontSize: '11.5px', color: MUTED }} className="truncate">{b.author}</p>}
          </div>
        </div>
      );
    }
    return <div className="flex gap-2 overflow-x-auto scrollbar-hide">{post.books.slice(0, 8).map(b => <Cover key={b.id} book={b} />)}</div>;
  }
  const b = post.book;
  const s = SENTIMENTS.find(x => x.id === b.sentiment);
  return (
    <div className="flex gap-3 items-center">
      <Cover book={b} big />
      <div className="min-w-0">
        <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: INK }} className="truncate">{b.title}</p>
        {b.author && <p style={{ ...sans, fontSize: '11.5px', color: MUTED }} className="truncate">{b.author}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          {post.type === 'ranked' && s && (
            <span className="rounded-full px-2.5 py-0.5" style={{ ...sans, fontSize: '11px', fontWeight: 600, color: s.color, backgroundColor: `${s.color}1a` }}>{s.label}</span>
          )}
          {b.rating > 0 && <span style={{ fontSize: '12px', color: '#c9a24a', letterSpacing: '1px' }} aria-label={`${b.rating} stars`}>{'★'.repeat(b.rating)}</span>}
        </div>
      </div>
    </div>
  );
}

const sectionFor = post => (post.type === 'closet' ? 'closet' : post.type === 'ranked' ? 'rankings' : 'books');

export default function FriendFeed({ friends, homes = {}, scope, onOpenFriend }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const key = friends.map(f => f.userId).join(',');

  useEffect(() => {
    setPosts(null);
    getFeed(friends.map(f => f.userId), scope).then(setPosts).catch(e => { setError(e.message); setPosts([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scope]);

  if (!friends.length) {
    return <p style={{ ...sans, fontSize: '13px', color: MUTED, padding: '24px 0' }}>Add friends to see what they've been up to.</p>;
  }
  if (posts === null) return <p style={{ ...sans, fontSize: '13px', color: MUTED, padding: '24px 0' }}>Loading…</p>;
  if (error) return <p style={{ ...sans, fontSize: '13px', color: '#c0392b', padding: '24px 0' }}>{error}</p>;
  if (!posts.length) return <p style={{ ...sans, fontSize: '13px', color: MUTED, padding: '24px 0' }}>Nothing new from your friends in the last month.</p>;

  return (
    <ol className="flex flex-col gap-3 max-w-xl">
      {posts.map(post => {
        const friend = friends.find(f => f.userId === post.userId);
        if (!friend) return null;
        const name = friend.displayName || friend.email;
        return (
          <li key={post.id}>
            <button
              onClick={() => onOpenFriend(friend, sectionFor(post))}
              className="w-full text-left rounded-2xl px-4 sm:px-5 py-4 transition-colors hover:bg-[#fffdf9]"
              style={{ backgroundColor: '#fff', border: '1px solid #ece4d8' }}
            >
              <div className="flex items-start gap-3 mb-3">
                <Avatar seed={post.userId} home={homes[post.userId]} />
                <p className="flex-1 min-w-0" style={{ ...sans, fontSize: '13px', color: INK, lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span> {headline(post)}
                </p>
                <span className="shrink-0" style={{ ...sans, fontSize: '11px', color: MUTED }}>{ago(post.at)}</span>
              </div>
              <Body post={post} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
