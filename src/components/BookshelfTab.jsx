import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import posthog from 'posthog-js';
import { getBooks, addBook, updateBook, deleteBook, reorderBooks, cleanAuthor } from '../utils/books';
import BookModal, { SHELVES, SHELF_TITLES, Stars } from './BookModal';
import RankFlow from './RankFlow';
import GoodreadsImport from './GoodreadsImport';
import { isRanked } from '../utils/ranking';
import { Bookcase, ShelvedBook, BOOKCASE_GRID, ON_WOOD } from './BookcaseDecor';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

const ctrlBtn = { backgroundColor: 'rgba(250,248,245,0.92)', color: '#6b5a4a', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' };

// ─── Book on the shelf ────────────────────────────────────────────────────────

function SortableBookCard({ book, lentTo, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  const overlay = (
    <>
      <div
        {...attributes} {...listeners}
        onClick={e => e.stopPropagation()}
        className="absolute top-1.5 left-1.5 z-30 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={ctrlBtn}
      >
        <svg width="10" height="10" viewBox="0 0 11 11" fill="currentColor">
          <circle cx="3.5" cy="2.5" r="1.1"/><circle cx="7.5" cy="2.5" r="1.1"/>
          <circle cx="3.5" cy="5.5" r="1.1"/><circle cx="7.5" cy="5.5" r="1.1"/>
          <circle cx="3.5" cy="8.5" r="1.1"/><circle cx="7.5" cy="8.5" r="1.1"/>
        </svg>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete(book.id); }}
        className="absolute bottom-1.5 right-1.5 z-30 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={ctrlBtn}
        aria-label="Remove book"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 3h8M5 3V2h2v1M3 3l.5 7h5L9 3"/></svg>
      </button>
    </>
  );

  return (
    <div ref={setNodeRef} style={style} className="group cursor-pointer" onClick={() => onEdit(book)}>
      <ShelvedBook book={book} lentTo={lentTo} overlay={overlay}>
        <p style={{ ...serif, fontSize: '15px', color: ON_WOOD.title, lineHeight: 1.15 }} className="line-clamp-2">{book.title}</p>
        {book.author && <p style={{ ...sans, fontSize: '10px', color: ON_WOOD.sub, marginTop: '3px', letterSpacing: '0.04em' }} className="truncate">{book.author}</p>}
        {book.status === 'read' && book.rating && <div className="mt-1"><Stars value={book.rating} size={11} on={ON_WOOD.starOn} off={ON_WOOD.starOff} /></div>}
      </ShelvedBook>
    </div>
  );
}

function YearBookCard({ book, year, lentTo, onEdit }) {
  const others = book.readYears.filter(y => y !== year);
  return (
    <div className="group cursor-pointer" onClick={() => onEdit(book)}>
      <ShelvedBook book={book} lentTo={lentTo}>
        <p style={{ ...serif, fontSize: '15px', color: ON_WOOD.title, lineHeight: 1.15 }} className="line-clamp-2">{book.title}</p>
        {book.author && <p style={{ ...sans, fontSize: '10px', color: ON_WOOD.sub, marginTop: '3px', letterSpacing: '0.04em' }} className="truncate">{book.author}</p>}
        {book.rating && <div className="mt-1"><Stars value={book.rating} size={11} on={ON_WOOD.starOn} off={ON_WOOD.starOff} /></div>}
        {others.length > 0 && <p style={{ ...sans, fontSize: '10px', color: ON_WOOD.sub, marginTop: '3px' }}>Also read {others.join(', ')}</p>}
      </ShelvedBook>
    </div>
  );
}

function BookGrid({ books, lentTo, onEdit, onDelete }) {
  return (
    <div className={BOOKCASE_GRID}>
      {books.map(b => <SortableBookCard key={b.id} book={b} lentTo={lentTo[b.id]} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  );
}

// Read books grouped by the year they were finished, newest first; unknown years last
function groupByYear(books) {
  const groups = new Map();
  books.filter(b => b.status === 'read').forEach(b => {
    // A re-read book shows up in every year it was read
    (b.readYears.length ? b.readYears : ['unknown']).forEach(key => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    });
  });
  return [...groups.entries()].sort(([a], [b]) => (a === 'unknown') - (b === 'unknown') || b - a);
}

function YearSummary({ groups }) {
  const known = groups.filter(([y]) => y !== 'unknown');
  if (!known.length) return null;
  const best = known.reduce((m, g) => (g[1].length > m[1].length ? g : m));
  const pages = known.flatMap(([, bs]) => bs).reduce((n, b) => n + (Number(b.pages) || 0), 0);
  const stat = (value, label) => (
    <div>
      <p style={{ ...sans, fontSize: '26px', fontWeight: 300, color: '#1a1713', lineHeight: 1, fontVariantNumeric: 'lining-nums' }}>{value}</p>
      <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '6px' }}>{label}</p>
    </div>
  );
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-6 rounded-2xl px-6 py-5 mb-10" style={{ backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}>
      {stat(known.length, known.length === 1 ? 'year of reading' : 'years of reading')}
      {stat(best[0], `biggest year · ${best[1].length} books`)}
      {pages > 0 && stat(pages.toLocaleString(), 'pages across these years')}
    </div>
  );
}

// ─── Main bookshelf view ──────────────────────────────────────────────────────

export default function BookshelfTab({ lentTo = {} }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeShelf, setActiveShelf] = useState('ALL');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [rankBook, setRankBook] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function load() {
    try {
      setBooks(await getBooks());
    } catch (e) {
      setError(e.message?.includes('books') ? 'Bookshelf table not found — run bookshelf-migration.sql in Supabase.' : 'Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(form) {
    try {
      let saved;
      // Finishing a book leads straight into ranking it (unless it's already ranked)
      let justFinished = false;
      if (modal.mode === 'add') {
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const dupe = books.find(b =>
          (form.olKey && b.olKey === form.olKey) ||
          (norm(b.title) === norm(form.title) && norm(cleanAuthor(b.author)) === norm(cleanAuthor(form.author))));
        if (dupe) {
          setModal(null);
          setError(`"${dupe.title}" is already on your shelf. Open it to add another year you read it.`);
          return;
        }
        saved = await addBook(form);
        justFinished = form.status === 'read';
        posthog.capture('book_added', { status: form.status, from_search: !!form.olKey });
      } else {
        saved = await updateBook(modal.book.id, form);
        justFinished = form.status === 'read' && modal.book.status !== 'read' && !isRanked(saved);
      }
      await load();
      setModal(null);
      setError('');
      if (justFinished) setRankBook(saved);
    } catch (e) {
      setError(e.message?.includes('books_status_check')
        ? 'The Want to Read shelf needs a database update — run supabase/migrations/20261120000000_want_to_read.sql in Supabase.'
        : e.message || 'Could not save book.');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this book from your shelf?')) return;
    try {
      await deleteBook(id);
      await load();
    } catch (e) {
      setError(e.message || 'Could not delete book.');
    }
  }

  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(books, books.findIndex(b => b.id === active.id), books.findIndex(b => b.id === over.id));
    setBooks(reordered);
    await reorderBooks(reordered.map(b => b.id));
  }

  const counts = {};
  books.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });

  const q = search.toLowerCase();
  const filtered = books.filter(b =>
    (activeShelf === 'ALL' || activeShelf === 'YEARS' || b.status === activeShelf) &&
    (!q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q))
  );

  const openEdit = b => setModal({ mode: 'edit', book: b });
  const tabs = [{ id: 'ALL', label: 'All' }, ...SHELVES, { id: 'YEARS', label: 'By Year' }];
  const byYear = activeShelf === 'YEARS';
  const yearGroups = groupByYear(filtered);
  const thisYear = new Date().getFullYear();
  const readThisYear = books.filter(b => b.status === 'read' && b.readYears.includes(thisYear)).length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10" style={{ borderBottom: '1px solid #e8e3de' }}>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map(t => {
            const count = t.id === 'ALL' ? books.length : t.id === 'YEARS' ? 0 : (counts[t.id] || 0);
            const isActive = activeShelf === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveShelf(t.id)}
                className="shrink-0 px-4 py-3 transition-all"
                style={{
                  ...sans, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: isActive ? '#1a1713' : '#b0a89e',
                  borderBottom: isActive ? '1px solid #1a1713' : '1px solid transparent',
                  marginBottom: '-1px', background: 'none',
                }}
              >
                {t.label} {count > 0 && <span style={{ opacity: 0.5, fontWeight: 300 }}>{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 pb-2 flex-1 sm:flex-none justify-end">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search books…"
            style={{ ...sans, borderColor: '#d4ccc4', fontSize: '13px', color: '#1a1713' }}
            className="flex-1 sm:w-56 bg-transparent border-b py-1.5 focus:outline-none placeholder:text-black/20"
          />
          <button
            onClick={() => setModal({ mode: 'add' })}
            style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
            className="shrink-0 px-5 py-2.5 hover:opacity-80 transition-opacity"
          >
            + Add Book
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }} className="px-4 py-2.5 mb-8 flex items-center justify-between">
          <p style={{ ...sans, fontSize: '12px', color: '#c0392b', fontWeight: 500 }}>{error}</p>
          <button onClick={() => setError('')} style={{ color: '#f5a5a5' }} className="hover:opacity-70 ml-4">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-36">
          <p style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#c9b99a' }}>loading your bookshelf…</p>
        </div>
      ) : filtered.length === 0 || (byYear && !yearGroups.length) ? (
        <div className="flex flex-col items-center justify-center py-36 text-center">
          <p style={{ ...serif, fontSize: '28px', fontWeight: 300, color: '#c9b99a', marginBottom: '24px' }}>
            {search ? 'No results.' : books.length === 0 ? 'Your bookshelf is empty.' : byYear ? 'No finished books yet.' : 'Nothing on this shelf.'}
          </p>
          {books.length === 0 && (
            <button
              onClick={() => setModal({ mode: 'add' })}
              style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
              className="px-8 py-3.5 hover:opacity-80 transition-opacity"
            >
              Add Your First Book
            </button>
          )}
          {books.length === 0 && (
            <button onClick={() => setImporting(true)} style={{ ...sans, fontSize: '12px', color: '#8a8178', marginTop: '16px' }} className="hover:text-black transition-colors">
              or import your Goodreads library →
            </button>
          )}
        </div>
      ) : byYear ? (
        <div>
                <YearSummary groups={yearGroups} />
                {yearGroups.map(([year, yearBooks]) => (
                  <Bookcase key={year} title={year === 'unknown' ? 'Year not set' : String(year)} count={yearBooks.length}>
                    <div className={BOOKCASE_GRID}>
                      {yearBooks.map(b => <YearBookCard key={b.id} book={b} year={year} lentTo={lentTo[b.id]} onEdit={openEdit} />)}
                    </div>
                  </Bookcase>
                ))}
                {yearGroups.some(([y]) => y === 'unknown') && (
                  <p style={{ ...sans, fontSize: '12px', color: '#a09890', marginTop: '-12px' }}>Tap a book to set the year you read it.</p>
                )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(b => b.id)} strategy={rectSortingStrategy}>
            {activeShelf === 'ALL' ? (
              <>
              {readThisYear > 0 && !search && (
                <button onClick={() => setActiveShelf('YEARS')} className="mb-8 hover:opacity-70 transition-opacity text-left" style={{ ...sans, fontSize: '13px', color: '#1a1713' }}>
                  You've read <b style={{ fontWeight: 600 }}>{readThisYear} {readThisYear === 1 ? 'book' : 'books'}</b> in {thisYear}. <span style={{ color: '#a09890' }}>See by year →</span>
                </button>
              )}
              {SHELVES.map(shelf => {
                const shelfBooks = filtered.filter(b => b.status === shelf.id);
                if (!shelfBooks.length) return null;
                return (
                  <Bookcase key={shelf.id} title={SHELF_TITLES[shelf.id]} count={shelfBooks.length}>
                    <BookGrid books={shelfBooks} lentTo={lentTo} onEdit={openEdit} onDelete={handleDelete} />
                  </Bookcase>
                );
              })}
              </>
            ) : (
              <Bookcase title={SHELF_TITLES[activeShelf]} count={filtered.length}>
                <BookGrid books={filtered} lentTo={lentTo} onEdit={openEdit} onDelete={handleDelete} />
              </Bookcase>
            )}
          </SortableContext>
        </DndContext>
      )}

      {/* Goodreads import lives quietly at the bottom of the shelf */}
      {!loading && books.length > 0 && (
        <div className="flex justify-center mt-16 pt-8" style={{ borderTop: '1px solid #ece5dc' }}>
          <button onClick={() => setImporting(true)} style={{ ...sans, fontSize: '12px', color: '#a09890' }} className="hover:text-black transition-colors">
            Have a Goodreads library? Import it →
          </button>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <BookModal
            book={modal.mode === 'edit' ? modal.book : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
        {importing && (
          <GoodreadsImport existingBooks={books} onImported={load} onClose={() => setImporting(false)} />
        )}
        {rankBook && (
          <RankFlow
            books={books}
            initialBook={rankBook}
            onSaved={load}
            onClose={() => { setRankBook(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
