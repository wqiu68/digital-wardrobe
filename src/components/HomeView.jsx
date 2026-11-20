import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getBooks } from '../utils/books';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClosetIcon({ size = 112 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      <rect x="11" y="8" width="58" height="6" rx="1" fill="#e6d9c6" />
      <rect x="15" y="14" width="50" height="54" rx="1" fill="#f3ebdf" />
      <line x1="40" y1="14" x2="40" y2="68" />
      <rect x="19" y="18" width="17" height="46" rx="0.5" fill="#efe4d4" />
      <rect x="44" y="18" width="17" height="46" rx="0.5" fill="#efe4d4" />
      <circle cx="37.2" cy="42" r="1.3" fill={INK} stroke="none" />
      <circle cx="42.8" cy="42" r="1.3" fill={INK} stroke="none" />
      <line x1="19" y1="68" x2="19" y2="73" />
      <line x1="61" y1="68" x2="61" y2="73" />
    </svg>
  );
}

function BookshelfIcon({ size = 112 }) {
  // [x, width, height, fill] for upright books on each shelf
  const top = [[17, 6, 18, '#7a3b2e'], [23, 5, 15, '#c9a66b'], [28, 7, 20, '#3e5641'], [35, 5, 16, '#2f4a6d']];
  const bottom = [[17, 7, 19, '#2f4a6d'], [24, 5, 16, '#b0703c'], [29, 6, 21, '#7a3b2e'], [35, 5, 17, '#e6d9c6'], [47, 6, 18, '#3e5641'], [53, 5, 14, '#c9a66b']];
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      <rect x="12" y="8" width="56" height="65" rx="1" fill="#f3ebdf" />
      {top.map(([x, w, h, c]) => <rect key={x} x={x} y={38 - h} width={w} height={h} fill={c} />)}
      <rect x="46" y="20" width="6" height="18" fill="#b0703c" transform="rotate(14 52 38)" />
      <rect x="55" y="31" width="9" height="7" fill="#e6d9c6" />
      <line x1="12" y1="38" x2="68" y2="38" />
      {bottom.map(([x, w, h, c]) => <rect key={x} x={x} y={68 - h} width={w} height={h} fill={c} />)}
      <line x1="12" y1="68" x2="68" y2="68" />
    </svg>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Badge({ n }) {
  return (
    <span className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full text-white" style={{ ...sans, fontSize: '9px', backgroundColor: '#c9b99a' }}>{n}</span>
  );
}

function Section({ icon, title, summary, note, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col items-center text-center rounded-2xl py-10 px-6 transition-all hover:bg-[#f2ebe2] hover:shadow-[0_6px_20px_-10px_rgba(26,23,19,0.25)] active:scale-[0.99]"
      style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}
    >
      <div className="transition-transform duration-300 group-hover:-translate-y-1">{icon}</div>
      <h3 style={{ ...serif, fontSize: '30px', fontWeight: 400, color: INK, marginTop: '14px', lineHeight: 1 }}>{title}</h3>
      <p style={{ ...sans, fontSize: '12px', color: '#a09890', marginTop: '8px' }}>{summary}</p>
      {note}
    </button>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function HomeView({ displayName, items, loadingItems, lendingRequests, friendRequests, onGo }) {
  const [books, setBooks] = useState(null);

  useEffect(() => { getBooks().then(setBooks).catch(() => setBooks([])); }, []);

  const firstName = (displayName || '').split(/[\s@]/)[0];
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div className="max-w-4xl mx-auto">
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ ...serif, fontSize: '34px', fontWeight: 300, color: INK, lineHeight: 1.1 }}
        className="text-center mb-10 sm:mb-14"
      >
        Welcome home{firstName ? `, ${firstName}` : ''}.
      </motion.h2>

      <div className="grid sm:grid-cols-2 gap-5 sm:gap-8">
        <Section
          icon={<ClosetIcon />}
          title="Closet"
          summary={loadingItems ? '\u00a0' : plural(items.length, 'piece')}
          onOpen={() => onGo('closet')}
        />
        <Section
          icon={<BookshelfIcon />}
          title="Bookshelf"
          summary={books ? plural(books.length, 'book') : '\u00a0'}
          note={lendingRequests > 0 && (
            <span
              role="link"
              onClick={e => { e.stopPropagation(); onGo('lending'); }}
              className="mt-3 inline-flex items-center gap-1.5 hover:underline"
              style={{ ...sans, fontSize: '11px', color: INK }}
            >
              <Badge n={lendingRequests} /> {lendingRequests === 1 ? 'borrow request' : 'borrow requests'} →
            </span>
          )}
          onOpen={() => onGo('bookshelf')}
        />
      </div>

      <div className="mt-14 flex justify-center">
        <button
          onClick={() => onGo('friends')}
          className="flex items-center gap-2 hover:text-black transition-colors"
          style={{ ...sans, fontSize: '12px', color: '#a09890' }}
        >
          Friends
          {friendRequests > 0 && <Badge n={friendRequests} />}
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
