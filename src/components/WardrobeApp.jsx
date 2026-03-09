import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import posthog from 'posthog-js';
import { getItems, addItem, updateItem, deleteItem, reorderItems, migrateItems } from '../utils/wardrobe';
import ItemModal, { CATEGORIES } from './ItemModal';

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

const ALL = { id: 'ALL', label: 'All' };

function SortableItemCard({ item, onEdit, onDelete }) {
  const cat = CATEGORIES.find(c => c.id === item.category);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  let hostname = '';
  try { hostname = new URL(item.sourceUrl).hostname.replace(/^www\./, ''); } catch {}

  return (
    <div ref={setNodeRef} style={style} className="group">

      {/* Image */}
      <div className="aspect-[3/4] w-full overflow-hidden relative mb-3" style={{ backgroundColor: '#f5f0eb' }}>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-15">{cat?.emoji}</span>
            </div>
          )
        }

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: 'rgba(26,23,19,0.04)' }} />

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: '#FAF8F5', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="3.5" cy="2.5" r="1.1" fill="#a09890"/>
            <circle cx="7.5" cy="2.5" r="1.1" fill="#a09890"/>
            <circle cx="3.5" cy="5.5" r="1.1" fill="#a09890"/>
            <circle cx="7.5" cy="5.5" r="1.1" fill="#a09890"/>
            <circle cx="3.5" cy="8.5" r="1.1" fill="#a09890"/>
            <circle cx="7.5" cy="8.5" r="1.1" fill="#a09890"/>
          </svg>
        </div>

        {/* Actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(item)}
            className="w-7 h-7 flex items-center justify-center text-xs transition-colors"
            style={{ backgroundColor: '#FAF8F5', color: '#a09890', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            title="Edit"
          >✏️</button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 flex items-center justify-center text-xs transition-colors"
            style={{ backgroundColor: '#FAF8F5', color: '#a09890', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
            title="Delete"
          >🗑</button>
        </div>
      </div>

      {/* Info */}
      <div>
        <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="truncate">{item.name}</p>
        {(item.brand || item.color) && (
          <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px', letterSpacing: '0.02em' }} className="truncate">
            {[item.brand, item.color].filter(Boolean).join(' · ')}
          </p>
        )}
        {item.size && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e', marginTop: '2px' }}>Size {item.size}</p>}
        {hostname && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ ...sans, fontSize: '11px', color: '#c9b99a', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            className="hover:opacity-70 transition-opacity"
          >
            <span>↗</span>{hostname}
          </a>
        )}
      </div>
    </div>
  );
}

function CategorySection({ category, items, onEdit, onDelete }) {
  const cat = CATEGORIES.find(c => c.id === category);
  if (!items.length) return null;
  return (
    <div className="mb-14">
      <div className="flex items-center gap-4 mb-6">
        <h2 style={{ ...serif, fontSize: '18px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic', letterSpacing: '-0.01em' }}>
          {cat?.label}
        </h2>
        <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{items.length} {items.length === 1 ? 'piece' : 'pieces'}</span>
        <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
        {items.map(item => (
          <SortableItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

export default function WardrobeApp({ user, onLogout }) {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeOccasion, setActiveOccasion] = useState('ALL');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loadingItems, setLoadingItems] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function migrateFromLocalStorage() {
    try {
      const itemsKey = Object.keys(localStorage).find(k => k.startsWith('dw:items:'));
      if (!itemsKey) return;
      const local = JSON.parse(localStorage.getItem(itemsKey) || '[]');
      if (!local.length) return;
      await migrateItems(local);
      localStorage.removeItem(itemsKey);
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }

  async function loadItems() {
    try {
      const data = await getItems();
      // One-time migration from localStorage if cloud is empty
      if (data.length === 0) {
        await migrateFromLocalStorage();
        const migrated = await getItems();
        setItems(migrated);
      } else {
        setItems(data);
      }
    } catch (e) {
      setError('Could not load wardrobe.');
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => { loadItems(); }, []);

  async function handleAdd(formData) {
    try {
      await addItem(formData);
      await loadItems();
      setActiveCategory(formData.category);
      setModal(null);
      setError('');
      posthog.capture('item_added', { category: formData.category, occasions: formData.occasions });
    } catch (e) {
      setError(e.message || 'Could not save item.');
    }
  }

  async function handleUpdate(formData) {
    try {
      await updateItem(modal.item.id, formData);
      await loadItems();
      setModal(null);
      setError('');
    } catch (e) {
      setError(e.message || 'Could not save item.');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this piece from your wardrobe?')) return;
    try {
      await deleteItem(id);
      await loadItems();
    } catch (e) {
      setError(e.message || 'Could not delete item.');
    }
  }

  async function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    await reorderItems(reordered.map(i => i.id));
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

  const grouped = CATEGORIES.map(cat => ({
    category: cat.id,
    items: filtered.filter(i => i.category === cat.id),
  })).filter(g => g.items.length > 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAF8F5', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #e8e3de' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

          <h1 style={{ ...serif, fontSize: '20px', fontWeight: 400, color: '#1a1713', fontStyle: 'italic', letterSpacing: '-0.01em' }}>
            My Wardrobe
          </h1>

          <div className="flex-1 max-w-sm hidden sm:block">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pieces…"
              style={{ ...sans, borderColor: '#d4ccc4', fontSize: '13px', color: '#1a1713' }}
              className="w-full bg-transparent border-b py-1.5 focus:outline-none transition-colors placeholder:text-black/20"
            />
          </div>

          <div className="flex items-center gap-5">
            <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }} className="hidden sm:block">{user}</span>
            <button
              onClick={() => setModal({ mode: 'add' })}
              style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
              className="px-5 py-2.5 hover:opacity-80 transition-opacity"
            >
              + Add
            </button>
            <button
              onClick={onLogout}
              style={{ ...sans, fontSize: '11px', color: '#b0a89e', letterSpacing: '0.05em' }}
              className="hover:opacity-60 transition-opacity"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="sm:hidden px-6 pb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{ ...sans, borderColor: '#d4ccc4', fontSize: '13px' }}
            className="w-full bg-transparent border-b py-1.5 focus:outline-none transition-colors placeholder:text-black/20"
          />
        </div>
      </header>

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca' }} className="px-6 py-2.5 flex items-center justify-between">
          <p style={{ ...sans, fontSize: '12px', color: '#c0392b', fontWeight: 500 }}>{error}</p>
          <button onClick={() => setError('')} style={{ color: '#f5a5a5' }} className="hover:opacity-70 ml-4">✕</button>
        </div>
      )}

      {/* Category tabs */}
      <div className="sticky top-14 z-10" style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #e8e3de' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {tabs.map(cat => {
              const count = cat.id === 'ALL' ? items.length : (counts[cat.id] || 0);
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="shrink-0 px-4 py-4 transition-all"
                  style={{
                    ...sans,
                    fontSize: '11px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: isActive ? '#1a1713' : '#b0a89e',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: isActive ? '1px solid #1a1713' : '1px solid transparent',
                    marginBottom: '-1px',
                    background: 'none',
                  }}
                >
                  {cat.label} {count > 0 && <span style={{ opacity: 0.5, fontWeight: 300 }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Occasion filter */}
      <div style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #f0ebe3' }}>
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-2 flex-wrap">
          <span style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.2em', textTransform: 'uppercase', marginRight: '4px' }}>
            Occasion
          </span>
          {[
            { id: 'ALL',      label: 'All'          },
            { id: 'everyday', label: 'Everyday'     },
            { id: 'work',     label: 'Work & Formal'},
            { id: 'athletic', label: 'Athletic'     },
          ].map(o => (
            <button
              key={o.id}
              onClick={() => setActiveOccasion(o.id)}
              style={{
                ...sans,
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                backgroundColor: activeOccasion === o.id ? '#1a1713' : 'transparent',
                color: activeOccasion === o.id ? '#FAF8F5' : '#a09890',
                border: `1px solid ${activeOccasion === o.id ? '#1a1713' : '#e0d9d2'}`,
              }}
              className="transition-all hover:border-black/30"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {loadingItems ? (
          <div className="flex items-center justify-center py-36">
            <p style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#c9b99a', fontStyle: 'italic' }}>loading your wardrobe…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-36 text-center">
            <p style={{ ...serif, fontSize: '28px', fontWeight: 300, color: '#c9b99a', fontStyle: 'italic', marginBottom: '24px' }}>
              {search ? 'No results.' : items.length === 0 ? 'Your wardrobe is empty.' : 'Nothing in this category.'}
            </p>
            {items.length === 0 && (
              <button
                onClick={() => setModal({ mode: 'add' })}
                style={{ ...sans, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' }}
                className="px-8 py-3.5 hover:opacity-80 transition-opacity"
              >
                Add Your First Piece
              </button>
            )}
          </div>
        ) : activeCategory === 'ALL' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
              <AnimatePresence>
                {grouped.map(({ category, items: catItems }) => (
                  <motion.div key={category} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <CategorySection
                      category={category}
                      items={catItems}
                      onEdit={i => setModal({ mode: 'edit', item: i })}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
          </DndContext>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                <AnimatePresence>
                  {filtered.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <SortableItemCard
                        item={item}
                        onEdit={i => setModal({ mode: 'edit', item: i })}
                        onDelete={handleDelete}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

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
