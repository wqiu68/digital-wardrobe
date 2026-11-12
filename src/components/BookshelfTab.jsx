import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import posthog from 'posthog-js';
import { getBooks, addBook, updateBook, deleteBook, reorderBooks } from '../utils/books';
import BookModal, { SHELVES, Stars } from './BookModal';
import { LentTag } from './BorrowButton';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const GRID = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-8";

// ─── Book card ────────────────────────────────────────────────────────────────

function BookCover({ book }) {
  if (book.cover) {
    return <img src={book.cover} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
  }
  // Typographic placeholder when there's no cover
  return (
    <div className="w-full h-full flex flex-col justify-between p-3" style={{ backgroundColor: '#ece5dc', borderLeft: '4px solid #d8cdbf' }}>
      <p style={{ ...serif, fontSize: '15px', fontStyle: 'italic', color: '#5a5048', lineHeight: 1.15 }} className="line-clamp-5">{book.title}</p>
      {book.author && <p style={{ ...sans, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a09890' }} className="line-clamp-2">{book.author}</p>}
    </div>
  );
}

function SortableBookCard({ book, lentTo, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="group cursor-pointer" onClick={() => onEdit(book)}>
      <div className="aspect-[2/3] w-full overflow-hidden relative mb-3" style={{ backgroundColor: '#f5f0eb', boxShadow: '0 1px 3px rgba(26,23,19,0.12)' }}>
        <BookCover book={book} />
        <LentTag name={lentTo} />
        <div
          {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: '#FAF8F5', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="#a09890">
            <circle cx="3.5" cy="2.5" r="1.1"/><circle cx="7.5" cy="2.5" r="1.1"/>
            <circle cx="3.5" cy="5.5" r="1.1"/><circle cx="7.5" cy="5.5" r="1.1"/>
            <circle cx="3.5" cy="8.5" r="1.1"/><circle cx="7.5" cy="8.5" r="1.1"/>
          </svg>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(book.id); }}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: '#FAF8F5', color: '#a09890', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          aria-label="Remove book"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 3h8M5 3V2h2v1M3 3l.5 7h5L9 3"/></svg>
        </button>
      </div>
      <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="line-clamp-2">{book.title}</p>
      {book.author && <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px' }} className="truncate">{book.author}</p>}
      {book.status === 'read' && book.rating && <div className="mt-1"><Stars value={book.rating} size={11} /></div>}
    </div>
  );
}

function ShelfSection({ shelf, books, lentTo, onEdit, onDelete }) {
  if (!books.length) return null;
  return (
    <div className="mb-14">
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ ...serif, fontSize: '18px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic' }}>{shelf.label}</h2>
        <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{books.length} {books.length === 1 ? 'book' : 'books'}</span>
        <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
      </div>
      <div className={GRID}>
        {books.map(b => <SortableBookCard key={b.id} book={b} lentTo={lentTo[b.id]} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
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
      if (modal.mode === 'add') {
        await addBook(form);
        posthog.capture('book_added', { status: form.status, from_search: !!form.olKey });
      } else {
        await updateBook(modal.book.id, form);
      }
      await load();
      setModal(null);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not save book.');
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
    (activeShelf === 'ALL' || b.status === activeShelf) &&
    (!q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q))
  );

  const openEdit = b => setModal({ mode: 'edit', book: b });
  const tabs = [{ id: 'ALL', label: 'All' }, ...SHELVES];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10" style={{ borderBottom: '1px solid #e8e3de' }}>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide">
          {tabs.map(t => {
            const count = t.id === 'ALL' ? books.length : (counts[t.id] || 0);
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
          <p style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#c9b99a', fontStyle: 'italic' }}>loading your bookshelf…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-36 text-center">
          <p style={{ ...serif, fontSize: '28px', fontWeight: 300, color: '#c9b99a', fontStyle: 'italic', marginBottom: '24px' }}>
            {search ? 'No results.' : books.length === 0 ? 'Your bookshelf is empty.' : 'Nothing on this shelf.'}
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
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map(b => b.id)} strategy={rectSortingStrategy}>
            {activeShelf === 'ALL' ? (
              SHELVES.map(shelf => (
                <ShelfSection
                  key={shelf.id}
                  shelf={shelf}
                  books={filtered.filter(b => b.status === shelf.id)}
                  lentTo={lentTo}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className={GRID}>
                <AnimatePresence>
                  {filtered.map(b => (
                    <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <SortableBookCard book={b} lentTo={lentTo[b.id]} onEdit={openEdit} onDelete={handleDelete} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}

      <AnimatePresence>
        {modal && (
          <BookModal
            book={modal.mode === 'edit' ? modal.book : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
