import { useState, useEffect, useRef } from 'react';
import { fetchProductInfo } from '../utils/urlParser';

const CATEGORIES = [
  { id: 'TOPS',        label: 'Tops',        emoji: '👕', bg: 'bg-sky-50',    border: 'border-sky-300',    text: 'text-sky-700' },
  { id: 'BOTTOMS',     label: 'Bottoms',     emoji: '👖', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
  { id: 'OUTERWEAR',   label: 'Outerwear',   emoji: '🧥', bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700' },
  { id: 'DRESSES',     label: 'Dresses',     emoji: '👗', bg: 'bg-pink-50',    border: 'border-pink-300',    text: 'text-pink-700' },
  { id: 'SHOES',       label: 'Shoes',       emoji: '👟', bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700' },
  { id: 'ACCESSORIES', label: 'Accessories', emoji: '👜', bg: 'bg-violet-50',  border: 'border-violet-300',  text: 'text-violet-700' },
  { id: 'OTHER',       label: 'Other',       emoji: '✨', bg: 'bg-stone-50',   border: 'border-stone-300',   text: 'text-stone-700' },
];

const OCCASIONS = [
  { id: 'everyday', label: 'Everyday', emoji: '☀️' },
  { id: 'work',     label: 'Work/Formal', emoji: '💼' },
  { id: 'athletic', label: 'Athletic', emoji: '🏃' },
];

const ALL_OCCASIONS = OCCASIONS.map(o => o.id);

const EMPTY = { name: '', brand: '', color: '', size: '', category: 'TOPS', occasions: ALL_OCCASIONS, notes: '', image: '', sourceUrl: '' };

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

export default function ItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(item ? { occasions: ALL_OCCASIONS, ...item } : { ...EMPTY });
  const [imagePreview, setImagePreview] = useState(item?.image || '');
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Global paste handler — captures image paste anywhere in the modal
  useEffect(() => {
    function handlePaste(e) {
      // Don't hijack paste inside text inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = async () => {
            const compressed = await compressImage(reader.result);
            setImagePreview(compressed);
            set('image', compressed);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleOccasion(id) {
    setForm(f => {
      const current = f.occasions || ALL_OCCASIONS;
      const next = current.includes(id)
        ? current.filter(o => o !== id)
        : [...current, id];
      return { ...f, occasions: next.length > 0 ? next : current }; // prevent deselecting all
    });
  }

  async function handleLookup() {
    const url = urlInput.trim();
    if (!url) return;
    setFetchError('');
    setFetching(true);
    try {
      const info = await fetchProductInfo(url);
      setForm(f => ({
        ...f,
        name: info.name || f.name,
        brand: info.brand || f.brand,
        color: info.color || f.color,
        category: info.category || f.category,
        notes: info.notes || f.notes,
        sourceUrl: url,
      }));
      if (info.image) {
        setImagePreview(info.image);
        setForm(f => ({ ...f, image: info.image }));
      }
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('abort')) {
        setFetchError("The request timed out — the site may be slow or blocking access.");
      } else if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
        setFetchError("Network error. Check your internet connection and try again.");
      } else {
        setFetchError(err.message);
      }
    } finally {
      setFetching(false);
    }
  }

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result);
      setImagePreview(compressed);
      set('image', compressed);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), image: imagePreview });
  }

  const cat = CATEGORIES.find(c => c.id === form.category);

  const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
  const sans  = { fontFamily: "'Inter', sans-serif" };
  const inputCls = "w-full bg-transparent border-0 border-b py-2 text-sm focus:outline-none transition-colors placeholder:text-black/20";
  const labelCls = { ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a09890', display: 'block', marginBottom: '8px' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[95vh] flex flex-col" style={{ backgroundColor: '#FAF8F5' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e8e3de' }}>
          <h2 style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#1a1713', fontStyle: 'italic' }}>
            {item ? 'edit piece' : 'add new piece'}
          </h2>
          <button onClick={onClose} style={{ ...sans, color: '#b0a89e', fontSize: '16px' }} className="hover:opacity-60 transition-opacity leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-7 py-6 space-y-6">

            {/* URL lookup */}
            {!item && (
              <div className="space-y-3 pb-6" style={{ borderBottom: '1px solid #e8e3de' }}>
                <label style={labelCls}>paste a product link to autofill</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                    placeholder="https://www.sezane.com/…"
                    style={{ ...sans, borderColor: '#d4ccc4' }}
                    className="flex-1 bg-transparent border-b py-2 text-sm focus:outline-none transition-colors placeholder:text-black/20 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={fetching || !urlInput.trim()}
                    style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', backgroundColor: '#1a1713', color: '#FAF8F5' }}
                    className="shrink-0 px-4 py-2 uppercase hover:opacity-80 disabled:opacity-30 transition-opacity"
                  >
                    {fetching ? '…' : 'look up'}
                  </button>
                </div>
                {fetchError && <p style={{ ...sans, fontSize: '11px', color: '#c0392b' }}>{fetchError} Fill in details manually.</p>}
                {fetching && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e' }} className="animate-pulse">fetching product info…</p>}
              </div>
            )}

            {/* Image + Name + Brand */}
            <div className="flex gap-5 items-start">
              <div className="shrink-0 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className="w-24 h-32 flex flex-col items-center justify-center transition-colors overflow-hidden"
                  style={{ border: imagePreview ? 'none' : '1px dashed #c9b99a', backgroundColor: imagePreview ? 'transparent' : '#f5f0eb' }}
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <><span className="text-lg mb-1" style={{ color: '#c9b99a' }}>↑</span><span style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.4 }}>upload<br/>or paste</span></>
                  }
                </button>
                {imagePreview
                  ? <button type="button" onClick={() => { setImagePreview(''); set('image', ''); }} style={{ ...sans, fontSize: '10px', color: '#b0a89e' }} className="hover:text-red-400 transition-colors text-center">remove</button>
                  : <p style={{ ...sans, fontSize: '10px', color: '#c9b99a', textAlign: 'center', lineHeight: 1.4, width: '96px' }}>⌘V to paste</p>
                }
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label style={labelCls}>item name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Pétra blouse" required style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
                </div>
                <div>
                  <label style={labelCls}>brand</label>
                  <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="e.g. Sézane" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label style={labelCls}>category</label>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('category', c.id)}
                    style={{
                      ...sans,
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      textTransform: 'lowercase',
                      backgroundColor: form.category === c.id ? '#1a1713' : 'transparent',
                      color: form.category === c.id ? '#FAF8F5' : '#a09890',
                      border: `1px solid ${form.category === c.id ? '#1a1713' : '#e0d9d2'}`,
                      padding: '8px 4px',
                    }}
                    className="transition-all hover:border-black/30"
                  >
                    {c.label.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Occasion */}
            <div>
              <label style={labelCls}>occasion</label>
              <div className="flex gap-1.5">
                {OCCASIONS.map(o => {
                  const active = (form.occasions || ALL_OCCASIONS).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOccasion(o.id)}
                      style={{
                        ...sans,
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        flex: 1,
                        padding: '8px 4px',
                        textTransform: 'lowercase',
                        backgroundColor: active ? '#1a1713' : 'transparent',
                        color: active ? '#FAF8F5' : '#a09890',
                        border: `1px solid ${active ? '#1a1713' : '#e0d9d2'}`,
                      }}
                      className="transition-all hover:border-black/30"
                    >
                      {o.label.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color + Size */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label style={labelCls}>color</label>
                <input value={form.color} onChange={e => set('color', e.target.value)} placeholder="e.g. ivory" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
              </div>
              <div>
                <label style={labelCls}>size</label>
                <input value={form.size} onChange={e => set('size', e.target.value)} placeholder="e.g. S, 36, 8" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
              </div>
            </div>

            {/* Product link */}
            <div>
              <label style={labelCls}>product link</label>
              <input type="url" value={form.sourceUrl || ''} onChange={e => set('sourceUrl', e.target.value)} placeholder="https://…" style={{ ...sans, borderColor: '#d4ccc4' }} className={inputCls} />
            </div>

            {/* Notes */}
            <div>
              <label style={labelCls}>notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="how you style it, when to wear it…"
                rows={2}
                style={{ ...sans, borderColor: '#d4ccc4' }}
                className="w-full bg-transparent border-b py-2 text-sm focus:outline-none transition-colors placeholder:text-black/20 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
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
              {item ? 'save changes' : 'add to wardrobe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CATEGORIES };
