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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">{item ? 'Edit piece' : 'Add new piece'}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* URL lookup — only show when adding, not editing */}
            {!item && (
              <div className="bg-stone-50 rounded-xl p-3 space-y-2">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Paste a product link to autofill ✨
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
                    placeholder="https://www.zara.com/…"
                    className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-300 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={fetching || !urlInput.trim()}
                    className="shrink-0 px-4 py-2 bg-stone-800 text-white text-sm rounded-lg font-medium hover:bg-stone-700 disabled:opacity-40 transition-colors"
                  >
                    {fetching ? '…' : 'Look up'}
                  </button>
                </div>
                {fetchError && (
                  <p className="text-xs text-red-500">{fetchError} You can fill in the details below manually.</p>
                )}
                {fetching && (
                  <p className="text-xs text-stone-400 animate-pulse">Fetching product info…</p>
                )}
              </div>
            )}

            {/* Image + Name + Brand */}
            <div className="flex gap-4 items-start">
              <div className="shrink-0 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className={`w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors overflow-hidden
                    ${imagePreview ? 'border-transparent' : 'border-stone-300 hover:border-stone-400 text-stone-400'}`}
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <><span className="text-2xl mb-1">📷</span><span className="text-xs text-center leading-tight">Upload<br/>or paste</span></>
                  }
                </button>
                {imagePreview
                  ? <button
                      type="button"
                      onClick={() => { setImagePreview(''); set('image', ''); }}
                      className="text-xs text-stone-400 hover:text-red-400 text-center"
                    >Remove</button>
                  : <p className="text-xs text-stone-400 text-center leading-tight w-24">⌘V to paste</p>
                }
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Item name *</label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Slim Fit Jeans"
                    required
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Brand</label>
                  <input
                    value={form.brand}
                    onChange={e => set('brand', e.target.value)}
                    placeholder="e.g. Zara"
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set('category', c.id)}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                      form.category === c.id
                        ? `${c.bg} ${c.border} ${c.text} border-2`
                        : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-lg mb-0.5">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Occasion */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Occasion</label>
              <div className="flex gap-2">
                {OCCASIONS.map(o => {
                  const active = (form.occasions || ALL_OCCASIONS).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOccasion(o.id)}
                      className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                        active
                          ? 'bg-stone-800 border-stone-800 text-white'
                          : 'bg-white border-stone-200 text-stone-400 hover:border-stone-300'
                      }`}
                    >
                      <span className="text-lg mb-0.5">{o.emoji}</span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Color</label>
                <input
                  value={form.color}
                  onChange={e => set('color', e.target.value)}
                  placeholder="e.g. Navy Blue"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Size</label>
                <input
                  value={form.size}
                  onChange={e => set('size', e.target.value)}
                  placeholder="e.g. M, 32, 8"
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                />
              </div>
            </div>

            {/* Product link */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Product Link</label>
              <input
                type="url"
                value={form.sourceUrl || ''}
                onChange={e => set('sourceUrl', e.target.value)}
                placeholder="https://www.zara.com/…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Occasion, how you style it, etc."
                rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-4 border-t border-stone-100 bg-stone-50">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-100 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors">
              {item ? 'Save changes' : 'Add to wardrobe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CATEGORIES };
