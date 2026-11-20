import { useState } from 'react';
import { ClothBinding } from './BookcaseDecor';
import { sortRanked, computeScores, scoreColor, bookKey } from '../utils/ranking';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

export function ScoreBadge({ score, size = 42 }) {
  const color = scoreColor(score);
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{ width: size, height: size, border: `1.5px solid ${color}`, color, backgroundColor: '#fffdf9' }}
    >
      <span style={{ ...sans, fontSize: `${Math.round(size * 0.33)}px`, fontWeight: 600, letterSpacing: '-0.02em' }}>{score.toFixed(1)}</span>
    </div>
  );
}

export function MiniCover({ book, w = 40 }) {
  return (
    <div className="shrink-0 overflow-hidden" style={{ width: w, height: Math.round(w * 1.5), boxShadow: '1px 1px 3px rgba(26,23,19,0.25)' }}>
      {book.cover ? <img src={book.cover} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ClothBinding book={book} size={Math.max(7, Math.round(w / 5))} />}
    </div>
  );
}

const chip = (active) => ({
  ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px',
  backgroundColor: active ? '#1a1713' : 'transparent',
  color: active ? '#FAF8F5' : '#a09890',
  border: `1px solid ${active ? '#1a1713' : '#e0d9d2'}`,
});

// Ranked list with genre filter.
//   myScores: optional { bookKey: score } to show "you: 8.2" on a friend's list
//   onRerank / onRemove: optional owner actions
export default function RankedList({ books, myScores, onRerank, onRemove, emptyText }) {
  const [genre, setGenre] = useState('ALL');

  const ranked = sortRanked(books);
  const scores = computeScores(books);

  const genreCounts = {};
  ranked.forEach(b => { const g = b.genre || 'Uncategorized'; genreCounts[g] = (genreCounts[g] || 0) + 1; });
  const genres = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]);

  const shown = genre === 'ALL' ? ranked : ranked.filter(b => (b.genre || 'Uncategorized') === genre);

  if (!ranked.length) {
    return <p style={{ ...serif, fontSize: '22px', color: '#c9b99a', padding: '48px 0' }}>{emptyText}</p>;
  }

  return (
    <div>
      {/* Genre filter */}
      {genres.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setGenre('ALL')} style={chip(genre === 'ALL')} className="transition-all hover:border-black/30">
            All <span style={{ opacity: 0.55 }}>{ranked.length}</span>
          </button>
          {genres.map(g => (
            <button key={g} onClick={() => setGenre(g)} style={chip(genre === g)} className="transition-all hover:border-black/30">
              {g} <span style={{ opacity: 0.55 }}>{genreCounts[g]}</span>
            </button>
          ))}
        </div>
      )}

      <ol className="flex flex-col">
        {shown.map((book, i) => {
          const mine = myScores?.[bookKey(book)];
          return (
            <li key={book.id}>
              <div className="group flex items-center gap-4 sm:gap-5 py-3" style={{ borderBottom: '1px solid #f0ebe3' }}>
                <span style={{ ...serif, fontSize: '26px', color: '#c9b99a', width: '34px', textAlign: 'right', lineHeight: 1 }} className="shrink-0">
                  {i + 1}
                </span>
                <MiniCover book={book} />
                <div className="flex-1 min-w-0">
                  <p style={{ ...serif, fontSize: '18px', color: '#1a1713', lineHeight: 1.2 }} className="truncate">{book.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {book.author && <span style={{ ...sans, fontSize: '11px', color: '#a09890' }} className="truncate">{book.author}</span>}
                    {book.genre && (
                      <span style={{ ...sans, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0a089', border: '1px solid #e8e0d4', padding: '1px 6px' }}>
                        {book.genre}
                      </span>
                    )}
                    {mine != null && (
                      <span style={{ ...sans, fontSize: '10px', color: scoreColor(mine) }}>you: {mine.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                {(onRerank || onRemove) && (
                  <div className="hidden sm:flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onRerank && (
                      <button onClick={() => onRerank(book)} style={{ ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a09890' }} className="hover:text-black transition-colors">
                        Re-rank
                      </button>
                    )}
                    {onRemove && (
                      <button onClick={() => onRemove(book)} style={{ ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9b0a0' }} className="hover:text-red-500 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                )}
                <button
                  onClick={onRerank ? () => onRerank(book) : undefined}
                  className={onRerank ? 'cursor-pointer' : 'cursor-default'}
                  title={onRerank ? 'Re-rank' : undefined}
                >
                  <ScoreBadge score={scores[book.id]} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
