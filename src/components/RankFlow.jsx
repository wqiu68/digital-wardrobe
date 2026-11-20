import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import { searchBooks, addBook, setRanking } from '../utils/books';
import { GENRES, SENTIMENTS, bucket, orderAt, computeScores, sortRanked, isRanked } from '../utils/ranking';
import { ClothBinding } from './BookcaseDecor';
import { MiniCover, ScoreBadge } from './RankedList';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };
const label = { ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '10px' };

function BigCover({ book }) {
  return (
    <div className="w-full aspect-[2/3] overflow-hidden" style={{ boxShadow: '3px 4px 12px rgba(26,23,19,0.25)' }}>
      {book.cover ? <img src={book.cover} alt="" className="w-full h-full object-cover" /> : <ClothBinding book={book} size={18} />}
    </div>
  );
}

// ─── Step 1: choose a book ────────────────────────────────────────────────────

function PickStep({ books, onPick }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const q = query.trim().toLowerCase();
  const unranked = books.filter(b => !isRanked(b));
  const mine = unranked.filter(b => !q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));

  useEffect(() => {
    if (q.length < 3) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchBooks(q, ctrl.signal);
        // Hide ones already on the shelf
        const have = new Set(books.map(b => b.olKey).filter(Boolean));
        setResults(res.filter(r => !have.has(r.olKey)));
      } catch { /* aborted or offline */ }
      finally { setSearching(false); }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const Row = ({ book, note, onClick }) => (
    <button type="button" onClick={onClick} className="w-full flex gap-3 items-center text-left p-2 hover:bg-black/[0.03] transition-colors">
      <MiniCover book={book} w={34} />
      <div className="min-w-0 flex-1">
        <p style={{ ...serif, fontSize: '16px', color: '#1a1713' }} className="truncate">{book.title}</p>
        <p style={{ ...sans, fontSize: '11px', color: '#a09890' }} className="truncate">{[book.author, note].filter(Boolean).join(' · ')}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search your shelf or any book…"
        autoFocus
        style={{ ...sans, borderColor: '#d4ccc4', fontSize: '14px' }}
        className="w-full bg-transparent border-b py-2 focus:outline-none placeholder:text-black/20"
      />
      {mine.length > 0 && (
        <div>
          <span style={label}>From your bookshelf</span>
          <div className="max-h-64 overflow-y-auto -mx-2">
            {mine.map(b => <Row key={b.id} book={b} note={b.status === 'reading' ? 'reading' : b.status === 'want' ? 'want to read' : ''} onClick={() => onPick(b)} />)}
          </div>
        </div>
      )}
      {q.length >= 3 && (
        <div>
          <span style={label}>{searching ? 'Searching…' : 'Add a book you’ve read'}</span>
          <div className="max-h-64 overflow-y-auto -mx-2">
            {results.map(r => <Row key={r.olKey + r.isbn} book={r} note={r.year} onClick={() => onPick(r)} />)}
          </div>
        </div>
      )}
      {!mine.length && q.length < 3 && (
        <p style={{ ...serif, fontSize: '17px', color: '#b0a89e' }}>
          {unranked.length ? 'Nothing matches on your shelf.' : 'Everything on your shelf is ranked. Search for another book you’ve read.'}
        </p>
      )}
    </div>
  );
}

// ─── Main flow ────────────────────────────────────────────────────────────────

export default function RankFlow({ books, initialBook, onSaved, onClose, onRemove }) {
  const isRerank = !!initialBook && isRanked(initialBook);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function removeRanking() {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    try {
      await onRemove(initialBook);
    } catch (e) {
      setError(e.message || 'Could not remove ranking.');
      setConfirmRemove(false);
    }
  }
  const [step, setStep] = useState(initialBook ? 'feel' : 'pick');
  const [book, setBook] = useState(initialBook || null);
  const [genre, setGenre] = useState(initialBook?.genre || '');
  const [sentiment, setSentiment] = useState(null);
  const [group, setGroup] = useState([]);
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(0);
  const [asked, setAsked] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function pick(b) {
    setBook(b);
    setGenre(b.genre || '');
    setStep('feel');
  }

  function chooseSentiment(s) {
    const g = bucket(books, s, book.id);
    setSentiment(s);
    setGroup(g);
    if (!g.length) { finish(s, g, 0); return; }
    setLo(0); setHi(g.length); setAsked(0);
    setStep('compare');
  }

  // Binary insertion: each answer halves the range the new book can land in
  function answer(newIsBetter) {
    const mid = Math.floor((lo + hi) / 2);
    const nLo = newIsBetter ? lo : mid + 1;
    const nHi = newIsBetter ? mid : hi;
    setAsked(a => a + 1);
    if (nLo >= nHi) finish(sentiment, group, nLo);
    else { setLo(nLo); setHi(nHi); }
  }

  async function finish(s, g, index) {
    setSaving(true);
    setError('');
    setStep('saving');
    try {
      const rankOrder = orderAt(g, index);
      let id = book.id;
      if (!id) {
        const created = await addBook({ ...book, status: 'read', genre });
        id = created.id;
      }
      await setRanking(id, { sentiment: s, rankOrder, genre });

      const placed = { ...book, id, genre, sentiment: s, rankOrder, status: 'read' };
      const after = [...books.filter(b => b.id !== id), placed];
      const position = sortRanked(after).findIndex(b => b.id === id) + 1;
      setResult({ book: placed, score: computeScores(after)[id], position, total: sortRanked(after).length });
      setStep('done');
      posthog.capture('book_ranked', { sentiment: s, genre, comparisons: asked, rerank: isRerank });
    } catch (e) {
      setError(e.message || 'Could not save ranking.');
      setStep('feel');
    } finally {
      setSaving(false);
    }
  }

  const mid = Math.floor((lo + hi) / 2);
  const rival = group[mid];
  const totalQs = Math.ceil(Math.log2(group.length + 1));

  const titles = {
    pick: 'rank a book',
    feel: isRerank ? 're-rank' : 'how was it?',
    compare: 'which did you prefer?',
    saving: 'saving…',
    done: 'ranked',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" style={{ backgroundColor: '#FAF8F5' }}>

        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e8e3de' }}>
          <h2 style={{ ...serif, fontSize: '22px', fontWeight: 300, color: '#1a1713' }}>{titles[step]}</h2>
          <button onClick={onClose} style={{ ...sans, color: '#b0a89e', fontSize: '16px' }} className="hover:opacity-60 transition-opacity leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-7 py-6">
          {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}

          {step === 'pick' && <PickStep books={books} onPick={pick} />}

          {step === 'feel' && book && (
            <div className="space-y-7">
              <div className="flex gap-5 items-center">
                <MiniCover book={book} w={64} />
                <div className="min-w-0">
                  <p style={{ ...serif, fontSize: '22px', color: '#1a1713', lineHeight: 1.15 }}>{book.title}</p>
                  {book.author && <p style={{ ...sans, fontSize: '12px', color: '#a09890', marginTop: '4px' }}>{book.author}</p>}
                </div>
              </div>

              <div>
                <span style={label}>Genre</span>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map(g => {
                    const active = genre === g;
                    return (
                      <button
                        key={g} type="button" onClick={() => setGenre(active ? '' : g)}
                        style={{ ...sans, fontSize: '10px', letterSpacing: '0.06em', padding: '5px 10px', backgroundColor: active ? '#1a1713' : 'transparent', color: active ? '#FAF8F5' : '#8f877d', border: `1px solid ${active ? '#1a1713' : '#e0d9d2'}` }}
                        className="transition-all hover:border-black/30"
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span style={label}>How did you feel about it?</span>
                <div className="grid grid-cols-3 gap-2">
                  {SENTIMENTS.map(s => (
                    <button
                      key={s.id} type="button" disabled={saving} onClick={() => chooseSentiment(s.id)}
                      className="flex flex-col items-center gap-2 py-4 transition-all hover:-translate-y-0.5"
                      style={{ border: `1px solid ${s.color}40`, backgroundColor: `${s.color}0d` }}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span style={{ ...sans, fontSize: '12px', color: s.color, fontWeight: 500 }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isRerank && onRemove && (
                <div className="flex justify-center pt-2" style={{ borderTop: '1px solid #ece6df' }}>
                  <button
                    type="button" onClick={removeRanking}
                    style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: confirmRemove ? '#c0392b' : '#b0a89e', paddingTop: '14px' }}
                    className="hover:text-red-600 transition-colors"
                  >
                    {confirmRemove ? 'Tap again to remove. It stays on your bookshelf.' : 'Remove from rankings'}
                  </button>
                </div>
              )}

              {initialBook && !isRerank && (
                <div className="flex justify-center">
                  <button
                    type="button" onClick={onClose}
                    style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#b0a89e' }}
                    className="hover:text-black transition-colors"
                  >
                    Rank later
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'compare' && rival && (
            <div>
              <p style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0a89e', textAlign: 'center', marginBottom: '20px' }}>
                Comparison {asked + 1} of about {totalQs}
              </p>
              <div className="grid grid-cols-2 gap-5 items-start">
                {[{ b: book, better: true }, { b: rival, better: false }].map(({ b, better }) => (
                  <button
                    key={better ? 'new' : 'rival'} type="button" onClick={() => answer(better)}
                    className="group text-left transition-transform hover:-translate-y-1"
                  >
                    <BigCover book={b} />
                    <p style={{ ...serif, fontSize: '17px', color: '#1a1713', lineHeight: 1.15, marginTop: '12px' }} className="line-clamp-2">{b.title}</p>
                    {b.author && <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px' }} className="truncate">{b.author}</p>}
                  </button>
                ))}
              </div>
              <div className="flex justify-center mt-7">
                <button
                  type="button" onClick={() => finish(sentiment, group, mid)}
                  style={{ ...sans, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09890', border: '1px solid #e0d9d2', padding: '9px 18px' }}
                  className="hover:border-black/30 transition-colors"
                >
                  Too tough to call
                </button>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', textAlign: 'center', padding: '40px 0' }} className="animate-pulse">placing it on your list…</p>
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-32 mb-5"><BigCover book={result.book} /></div>
              <p style={{ ...serif, fontSize: '22px', color: '#1a1713', lineHeight: 1.15 }}>{result.book.title}</p>
              <div className="flex items-center gap-4 mt-5">
                <ScoreBadge score={result.score} size={56} />
                <p style={{ ...sans, fontSize: '12px', color: '#8f877d', textAlign: 'left', lineHeight: 1.6 }}>
                  #{result.position} of {result.total}<br />on your list
                </p>
              </div>
              <div className="flex gap-2 mt-8 w-full">
                {!initialBook && (
                  <button
                    type="button"
                    onClick={() => { onSaved(); setBook(null); setSentiment(null); setResult(null); setStep('pick'); }}
                    style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'lowercase', color: '#a09890', border: '1px solid #e0d9d2', flex: 1, padding: '12px' }}
                    className="hover:border-black/30 transition-colors"
                  >
                    rank another
                  </button>
                )}
                <button
                  type="button" onClick={() => { onSaved(); onClose(); }}
                  style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'lowercase', backgroundColor: '#1a1713', color: '#FAF8F5', flex: 1, padding: '12px' }}
                  className="hover:opacity-80 transition-opacity"
                >
                  done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
