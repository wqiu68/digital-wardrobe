import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import { supabase } from '../utils/supabase';
import { getFriendBooks } from '../utils/books';
import { getLoansForFriend, requestBorrow, withdrawLoan } from '../utils/loans';
import { Stars } from './BookModal';
import BorrowButton from './BorrowButton';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

export default function FriendBookshelfView({ friend }) {
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [myId, setMyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function loadLoans() {
    setLoans(await getLoansForFriend(friend.userId));
  }

  useEffect(() => {
    Promise.all([
      getFriendBooks(friend.userId).then(setBooks),
      loadLoans(),
      supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id)),
    ])
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [friend.userId]);

  async function act(bookId, fn) {
    setBusy(bookId);
    setError('');
    try {
      await fn();
      await loadLoans();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  const q = search.toLowerCase();
  const filtered = books.filter(b => !q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));
  const name = friend.displayName || 'They';

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>
          {!loading && `${books.length} ${books.length === 1 ? 'book' : 'books'}`}
        </span>
        {books.length > 0 && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search their books…"
            style={{ ...sans, borderColor: '#d4ccc4', fontSize: '13px', color: '#1a1713' }}
            className="w-full sm:w-56 bg-transparent border-b py-1.5 focus:outline-none placeholder:text-black/20"
          />
        )}
      </div>

      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}

      {loading ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}>loading bookshelf…</p>
      ) : filtered.length === 0 ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a', fontStyle: 'italic' }}>
          {books.length === 0 ? `${name} hasn't added any books yet.` : 'No results.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10">
          {filtered.map(book => {
            const bookLoans = loans.filter(l => l.bookId === book.id);
            const checkedOut = bookLoans.some(l => l.status === 'lent' && l.borrowerId !== myId);
            return (
              <div key={book.id} className="flex flex-col">
                <div className="aspect-[2/3] w-full overflow-hidden mb-3" style={{ backgroundColor: '#ece5dc', boxShadow: '0 1px 3px rgba(26,23,19,0.12)', opacity: checkedOut ? 0.55 : 1 }}>
                  {book.cover
                    ? <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                    : (
                      <div className="w-full h-full flex flex-col justify-between p-3" style={{ borderLeft: '4px solid #d8cdbf' }}>
                        <p style={{ ...serif, fontSize: '15px', fontStyle: 'italic', color: '#5a5048', lineHeight: 1.15 }} className="line-clamp-5">{book.title}</p>
                        {book.author && <p style={{ ...sans, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a09890' }} className="line-clamp-2">{book.author}</p>}
                      </div>
                    )}
                </div>
                <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="line-clamp-2">{book.title}</p>
                {book.author && <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px' }} className="truncate">{book.author}</p>}
                {book.status === 'reading' && <p style={{ ...sans, fontSize: '10px', color: '#c9b99a', marginTop: '3px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Currently reading</p>}
                {book.status === 'read' && book.rating && <div className="mt-1"><Stars value={book.rating} size={11} /></div>}
                <div className="mt-auto">
                  <BorrowButton
                    loans={bookLoans}
                    myId={myId}
                    busy={busy === book.id}
                    onRequest={() => act(book.id, async () => {
                      await requestBorrow({ bookId: book.id }, friend.userId);
                      posthog.capture('borrow_requested', { kind: 'book' });
                    })}
                    onCancel={loan => act(book.id, () => withdrawLoan(loan.id))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
