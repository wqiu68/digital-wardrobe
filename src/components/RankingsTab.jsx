import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { getBooks, clearRanking } from '../utils/books';
import { sortRanked } from '../utils/ranking';
import RankedList from './RankedList';
import RankFlow from './RankFlow';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

export default function RankingsTab() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState(null); // null | { book?: Book }
  const [error, setError] = useState('');

  async function load() {
    try {
      setBooks(await getBooks());
    } catch (e) {
      setError(e.message?.includes('sentiment') || e.message?.includes('genre')
        ? 'Rankings need a database update — run book-rankings-migration.sql in Supabase.'
        : 'Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(book) {
    if (!confirm(`Remove "${book.title}" from your rankings? It stays on your bookshelf.`)) return;
    try {
      await clearRanking(book.id);
      await load();
    } catch (e) {
      setError(e.message || 'Could not remove ranking.');
    }
  }

  const rankedCount = sortRanked(books).length;

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h2 style={{ ...serif, fontSize: '30px', fontWeight: 300, fontStyle: 'italic', color: '#1a1713', lineHeight: 1 }}>Your Rankings</h2>
          <p style={{ ...sans, fontSize: '12px', color: '#a09890', marginTop: '8px' }}>
            {rankedCount
              ? `${rankedCount} ${rankedCount === 1 ? 'book' : 'books'} ranked against each other`
              : 'Rank books head-to-head and watch your list take shape.'}
          </p>
        </div>
        <button
          onClick={() => setFlow({})}
          style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
          className="px-5 py-2.5 hover:opacity-80 transition-opacity"
        >
          + Rank a Book
        </button>
      </div>

      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}

      {loading ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}>loading your rankings…</p>
      ) : (
        <RankedList
          books={books}
          onRerank={book => setFlow({ book })}
          onRemove={handleRemove}
          emptyText="Nothing ranked yet. Start with a book you loved."
        />
      )}

      <AnimatePresence>
        {flow && (
          <RankFlow
            books={books}
            initialBook={flow.book}
            onSaved={load}
            onClose={() => { setFlow(null); load(); }}
            onRemove={async book => {
              await clearRanking(book.id);
              setFlow(null);
              await load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
