import { useState, useEffect, useRef } from 'react';
import { searchBooks } from '../utils/books';
import { GENRES } from '../utils/ranking';

export const SHELVES = [
  { id: 'reading', label: 'Reading' },
  { id: 'read',    label: 'Read'    },
  { id: 'want',    label: 'Want to Read' },
];
export const SHELF_TITLES = { reading: 'Currently Reading', read: 'Read', want: 'Want to Read' };

const THIS_YEAR = new Date().getFullYear();
const EMPTY = { title: '', author: '', cover: '', status: 'read', rating: null, readYear: THIS_YEAR, notes: '', genre: '', year: '', pages: '', isbn: '', olKey: '' };
const READ_YEARS = Array.from({ length: 60 }, (_, i) => THIS_YEAR - i);

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

function compressImage(dataUrl, maxDim = 400, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function Stars({ value, onChange, size = 14, on = '#1a1713', off = '#ddd5cc' }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = value && n <= value;
        const Tag = onChange ? 'button' : 'span';
        return (
          <Tag
            key={n}
            type={onChange ? 'button' : undefined}
            onClick={onChange ? () => onChange(value === n ? null : n) : undefined}
            style={{ fontSize: `${size}px`, color: filled ? on : off, lineHeight: 1 }}
            className={onChange ? 'hover:opacity-70 transition-opacity' : ''}
            aria-label={onChange ? `${n} star${n > 1 ? 's' : ''}` : undefined}
          >
            ★
          </Tag>
        );
      })}
    </div>
  );
}

export default function BookModal({ book, onSave, onClose }) {
  const [form, setForm] = useState(book ? { ...EMPTY, ...book, readYear: book.readYear ?? '', year: book.year ?? '', pages: book.pages ?? '' } : { ...EMPTY });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Debounced Open Library search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setResults([]); setSearchError(''); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        setResults(await searchBooks(q, ctrl.signal));
      } catch (e) {
        if (e.name !== 'AbortError') setSearchError(e.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function pickResult(r) {
    setForm(f => ({ ...f, ...r, year: r.year ?? '', pages: r.pages ?? '' }));
    setQuery('');
    setResults([]);
  }

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => set('cover', await compressImage(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim(), rating: form.status === 'read' ? form.rating : null });
  }

  const inputCls = "w-full bg-transparent border-0 border-b py-2 text-sm focus:outline-none transition-colors placeholder:text-black/20";
  const labelCls = { ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '8px' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" style={{ backgroundColor: '#FAF8F5' }}>

        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e8e3de' }}>
          <h2 style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#1a1713' }}>
            {book ? 'edit book' : 'add a book'}
          </h2>
          <button onClick={onClose} style={{ ...sans, color: '#b0a89e', fontSize: '16px' }} className="hover:opacity-60 transition-opacity leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-7 py-6 space-y-6">

            {/* Search */}
            {!book && (
              <div className="space-y-3 pb-6" style={{ borderBottom: '1px solid #e8e3de' }}>
                <label style={labelCls}>search by title, author, or isbn</label>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  placeholder="e.g. The Remains of the Day"
                  style={{ ...sans, borderColor: '#d4ccc4' }}
                  className={inputCls}
                  autoFocus
                />
                {searching && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e' }} className="animate-pulse">searching…</p>}
                {searchError && <p style={{ ...sans, fontSize: '11px', color: '#c0392b' }}>{searchError} Fill in details manually.</p>}
                {results.length > 0 && (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {results.map(r => (
                      <button
                        key={r.olKey + r.isbn}
                        type="button"
                        onClick={() => pickResult(r)}
                        className="w-full flex gap-3 items-center text-left p-2 hover:bg-black/[0.03] transition-colors"
                      >
                        <div className="w-9 h-13 shrink-0 overflow-hidden" style={{ backgroundColor: '#f0ebe3', height: '52px' }}>
                          {r.cover && <img src={r.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}
                        </div>
                        <div className="min-w-0">
                          <p style={{ ...sans, fontSize: '13px', color: '#1a1713', fontWeight: 500 }} className="truncate">{r.title}</p>
                          <p style={{ ...sans, fontSize: '11px', color: '#a09890' }} className="truncate">
                            {[r.author, r.year].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cover + Title + Author */}
            <div className="flex gap-5 items-start">
              <div className="shrink-0 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className="w-24 h-36 flex flex-col items-center justify-center transition-colors overflow-hidden"
                  style={{ border: form.cover ? 'none' : '1px dashed #c9b99a', backgroundColor: form.cover ? 'transparent' : '#f5f0eb' }}
                >
                  {form.cover
                    ? <img src={form.cover} alt="cover" className="w-full h-full object-cover" />
                    : <><span className="text-lg mb-1" style={{ color: '#c9b99a' }}>↑</span><span style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.1em' }}>cover</span></>
                  }
                </button>
                {form.cover && (
                  <button type="button" onClick={() => set('cover', '')} style={{ ...sans, fontSize: '10px', color: '#b0a89e' }} className="hover:text-red-400 transition-colors text-center">remove</button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label style={labelCls}>title *</label>
                  <input value={form.title} onChange={e => set('title', e.target.value)} required style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
                </div>
                <div>
                  <label style={labelCls}>author</label>
                  <input value={form.author} onChange={e => set('author', e.target.value)} style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Shelf */}
            <div>
              <label style={labelCls}>shelf</label>
              <div className="flex gap-1.5">
                {SHELVES.map(s => {
                  const active = form.status === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, status: s.id, readYear: s.id === 'read' && !f.readYear && f.status !== 'read' ? THIS_YEAR : f.readYear }))}
                      style={{
                        ...sans, fontSize: '10px', letterSpacing: '0.12em', flex: 1, padding: '8px 4px', textTransform: 'lowercase',
                        backgroundColor: active ? '#1a1713' : 'transparent',
                        color: active ? '#FAF8F5' : '#a09890',
                        border: `1px solid ${active ? '#1a1713' : '#e0d9d2'}`,
                      }}
                      className="transition-all hover:border-black/30"
                    >
                      {s.label.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating and year read (only for read books) */}
            {form.status === 'read' && (
              <div className="flex items-start gap-10">
                <div>
                  <label style={labelCls}>rating</label>
                  <Stars value={form.rating} onChange={v => set('rating', v)} size={20} />
                </div>
                <div>
                  <label style={labelCls}>year read</label>
                  <select
                    value={form.readYear || ''}
                    onChange={e => set('readYear', e.target.value ? Number(e.target.value) : '')}
                    style={{ ...sans, borderColor: '#d4ccc4', color: form.readYear ? '#1a1713' : '#b0a89e' }}
                    className={inputCls + ' cursor-pointer'}
                  >
                    <option value="">Not sure</option>
                    {READ_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Genre */}
            <div>
              <label style={labelCls}>genre</label>
              <select
                value={form.genre || ''}
                onChange={e => set('genre', e.target.value)}
                style={{ ...sans, borderColor: '#d4ccc4', color: form.genre ? '#1a1713' : '#b0a89e' }}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="">Choose a genre…</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Year + Pages */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label style={labelCls}>year</label>
                <input type="number" value={form.year} onChange={e => set('year', e.target.value)} placeholder="e.g. 1989" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
              </div>
              <div>
                <label style={labelCls}>pages</label>
                <input type="number" value={form.pages} onChange={e => set('pages', e.target.value)} placeholder="e.g. 258" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelCls}>notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="favorite quotes, who recommended it, thoughts…"
                rows={3}
                style={{ ...sans, borderColor: '#d4ccc4' }}
                className="w-full bg-transparent border-b py-2 text-sm focus:outline-none transition-colors placeholder:text-black/20 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 px-7 py-5" style={{ borderTop: '1px solid #e8e3de' }}>
            <button
              type="button" onClick={onClose}
              style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'lowercase', color: '#a09890', border: '1px solid #e0d9d2', flex: 1, padding: '12px' }}
              className="hover:border-black/30 transition-colors"
            >
              cancel
            </button>
            <button
              type="submit"
              style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'lowercase', backgroundColor: '#1a1713', color: '#FAF8F5', flex: 1, padding: '12px' }}
              className="hover:opacity-80 transition-opacity"
            >
              {book ? 'save changes' : 'add to bookshelf'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
