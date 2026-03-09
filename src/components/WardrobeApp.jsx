import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import posthog from 'posthog-js';
import { logout } from '../utils/auth';
import { getItems, addItem, updateItem, deleteItem, reorderItems } from '../utils/wardrobe';
import ItemModal, { CATEGORIES } from './ItemModal';

const ALL = { id: 'ALL', label: 'All', emoji: '✦' };

function placeholder(category) {
  const map = {
    TOPS: 'from-sky-100 to-sky-200',
    BOTTOMS: 'from-emerald-100 to-emerald-200',
    OUTERWEAR: 'from-orange-100 to-orange-200',
    DRESSES: 'from-pink-100 to-pink-200',
    SHOES: 'from-amber-100 to-amber-200',
    ACCESSORIES: 'from-violet-100 to-violet-200',
    OTHER: 'from-stone-100 to-stone-200',
  };
  return map[category] || map.OTHER;
}

function SortableItemCard({ item, onEdit, onDelete }) {
  const cat = CATEGORIES.find(c => c.id === item.category);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white rounded-2xl overflow-hidden border border-stone-100 hover:border-stone-200 hover:shadow-md transition-all"
    >
      {/* Drag handle — top-left on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shadow"
        title="Drag to reorder"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="4" cy="3" r="1" fill="#78716c"/>
          <circle cx="8" cy="3" r="1" fill="#78716c"/>
          <circle cx="4" cy="6" r="1" fill="#78716c"/>
          <circle cx="8" cy="6" r="1" fill="#78716c"/>
          <circle cx="4" cy="9" r="1" fill="#78716c"/>
          <circle cx="8" cy="9" r="1" fill="#78716c"/>
        </svg>
      </div>

      {/* Image area */}
      <div className={`aspect-[3/4] w-full bg-gradient-to-br ${placeholder(item.category)} flex items-center justify-center overflow-hidden`}>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          : <span className="text-4xl opacity-60">{cat?.emoji}</span>
        }
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {item.brand && <p className="text-xs text-stone-400 truncate">{item.brand}</p>}
          {item.brand && item.color && <span className="text-stone-200">·</span>}
          {item.color && <p className="text-xs text-stone-400 truncate">{item.color}</p>}
        </div>
        {item.size && <p className="text-xs text-stone-300 mt-0.5">Size {item.size}</p>}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 mt-1 text-xs text-stone-400 hover:text-stone-600 truncate max-w-full"
            title={item.sourceUrl}
          >
            <span>🔗</span>
            <span className="truncate">{new URL(item.sourceUrl).hostname.replace(/^www\./, '')}</span>
          </a>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-2xl pointer-events-none" />
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-stone-600 hover:text-stone-800 text-sm"
          title="Edit"
        >✏️</button>
        <button
          onClick={() => onDelete(item.id)}
          className="w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-stone-600 hover:text-red-500 text-sm"
          title="Delete"
        >🗑</button>
      </div>
    </div>
  );
}

export default function WardrobeApp({ user, onLogout }) {
  const [items, setItems] = useState(() => getItems(user));
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeOccasion, setActiveOccasion] = useState('ALL');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    setItems(getItems(user));
  }, [user]);

  function handleAdd(formData) {
    try {
      addItem(user, formData);
      setItems(getItems(user));
      setActiveCategory(formData.category);
      setModal(null);
      setError('');
      posthog.capture('item_added', { category: formData.category, occasions: formData.occasions });
    } catch (e) {
      setError(e.message || 'Could not save item.');
    }
  }

  function handleUpdate(formData) {
    try {
      updateItem(user, modal.item.id, formData);
      setItems(getItems(user));
      setModal(null);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not save item.');
    }
  }

  function handleDelete(id) {
    if (!confirm('Remove this piece from your wardrobe?')) return;
    deleteItem(user, id);
    setItems(getItems(user));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Work out new order within the full items list
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    reorderItems(user, reordered.map(i => i.id));
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  const tabs = [ALL, ...CATEGORIES];

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'ALL' || item.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q) || item.color?.toLowerCase().includes(q);
    const occasions = item.occasions?.length ? item.occasions : ['everyday', 'work', 'athletic'];
    const matchOccasion = activeOccasion === 'ALL' || occasions.includes(activeOccasion);
    return matchCat && matchSearch && matchOccasion;
  });

  const counts = {};
  items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪞</span>
            <span className="font-bold text-stone-800 tracking-tight">My Wardrobe</span>
          </div>

          <div className="flex-1 max-w-xs hidden sm:block">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500 hidden sm:block">Hi, {user} 👋</span>
            <button
              onClick={handleLogout}
              className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden px-4 pb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your wardrobe…"
            className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg leading-none ml-3">✕</button>
        </div>
      )}

      {/* Category tabs */}
      <div className="bg-white border-b border-stone-100 sticky top-14 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map(cat => {
              const count = cat.id === 'ALL' ? items.length : (counts[cat.id] || 0);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className={`text-xs ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Occasion filter */}
      <div className="bg-white border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-stone-400 uppercase tracking-wide shrink-0">Occasion</span>
          <div className="flex gap-1.5">
            {[
              { id: 'ALL',      label: 'All',         emoji: '✦' },
              { id: 'everyday', label: 'Everyday',    emoji: '☀️' },
              { id: 'work',     label: 'Work/Formal', emoji: '💼' },
              { id: 'athletic', label: 'Athletic',    emoji: '🏃' },
            ].map(o => (
              <button
                key={o.id}
                onClick={() => setActiveOccasion(o.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeOccasion === o.id
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span>{o.emoji}</span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-5xl mb-4">👗</span>
            <p className="text-stone-500 text-lg font-medium">
              {search ? 'No results found.' : items.length === 0 ? 'Your wardrobe is empty.' : 'Nothing in this category.'}
            </p>
            {items.length === 0 && (
              <p className="text-stone-400 text-sm mt-1">Tap + to add your first piece.</p>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <AnimatePresence>
                  {filtered.map(item => (
                    <SortableItemCard
                      key={item.id}
                      item={item}
                      onEdit={item => setModal({ mode: 'edit', item })}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setModal({ mode: 'add' })}
        className="fixed bottom-6 right-6 w-14 h-14 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-700 active:scale-95 transition-all text-2xl flex items-center justify-center z-30"
        title="Add piece"
      >
        +
      </button>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <ItemModal
            item={modal.mode === 'edit' ? modal.item : null}
            onSave={modal.mode === 'add' ? handleAdd : handleUpdate}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
