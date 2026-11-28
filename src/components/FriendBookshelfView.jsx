import { useState, useEffect } from 'react';
import posthog from 'posthog-js';
import { getCurrentUser } from '../utils/supabase';
import { getFriendBooks } from '../utils/books';
import { getLoansForFriend, requestBorrow, withdrawLoan } from '../utils/loans';
import { Stars } from './BookModal';
import BorrowButton from './BorrowButton';
import { Bookcase, ShelvedBook, BOOKCASE_GRID, ON_WOOD } from './BookcaseDecor';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

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
      getCurrentUser().then(u => setMyId(u?.id)),
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
  // Did Not Finish books stay off a friend's view of the shelf
  const library = filtered.filter(b => b.status !== 'want' && b.status !== 'dnf');
  const wants = filtered.filter(b => b.status === 'want');
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
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a' }}>loading bookshelf…</p>
      ) : filtered.length === 0 ? (
        <p style={{ ...serif, fontSize: '20px', color: '#c9b99a' }}>
          {books.length === 0 ? `${name} hasn't added any books yet.` : 'No results.'}
        </p>
      ) : (
        <>
        {library.length > 0 && (
        <Bookcase title={`${friend.displayName || 'Their'}'s Library`} count={library.length}>
          <div className={BOOKCASE_GRID}>
            {library.map(book => {
              const bookLoans = loans.filter(l => l.bookId === book.id);
              const checkedOut = bookLoans.some(l => l.status === 'lent' && l.borrowerId !== myId);
              return (
                <div key={book.id} className="group flex flex-col">
                  <ShelvedBook book={book} dim={checkedOut}>
                    <p style={{ ...serif, fontSize: '15px', color: ON_WOOD.title, lineHeight: 1.15 }} className="line-clamp-2">{book.title}</p>
                    {book.author && <p style={{ ...sans, fontSize: '10px', color: ON_WOOD.sub, marginTop: '3px', letterSpacing: '0.04em' }} className="truncate">{book.author}</p>}
                    {book.status === 'reading' && <p style={{ ...sans, fontSize: '9px', color: ON_WOOD.starOn, marginTop: '4px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Currently reading</p>}
                    {book.status === 'read' && book.rating && <div className="mt-1"><Stars value={book.rating} size={11} on={ON_WOOD.starOn} off={ON_WOOD.starOff} /></div>}
                    <BorrowButton
                      onDark
                      loans={bookLoans}
                      myId={myId}
                      busy={busy === book.id}
                      onRequest={() => act(book.id, async () => {
                        await requestBorrow({ bookId: book.id }, friend.userId);
                        posthog.capture('borrow_requested', { kind: 'book' });
                      })}
                      onCancel={loan => act(book.id, () => withdrawLoan(loan.id))}
                    />
                  </ShelvedBook>
                </div>
              );
            })}
          </div>
        </Bookcase>
        )}
        {wants.length > 0 && (
          <Bookcase title="Wants to Read" count={wants.length}>
            <div className={BOOKCASE_GRID}>
              {wants.map(book => (
                <div key={book.id} className="flex flex-col">
                  <ShelvedBook book={book}>
                    <p style={{ ...serif, fontSize: '15px', color: ON_WOOD.title, lineHeight: 1.15 }} className="line-clamp-2">{book.title}</p>
                    {book.author && <p style={{ ...sans, fontSize: '10px', color: ON_WOOD.sub, marginTop: '3px', letterSpacing: '0.04em' }} className="truncate">{book.author}</p>}
                  </ShelvedBook>
                </div>
              ))}
            </div>
          </Bookcase>
        )}
        </>
      )}
    </div>
  );
}
