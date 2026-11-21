import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import posthog from 'posthog-js';
import { getItems, addItem, updateItem, deleteItem, reorderItems, migrateItems } from '../utils/wardrobe';
import { ensureProfile, getMyProfile } from '../utils/friends';
import { getMyLending, lentToMap } from '../utils/loans';
import LendingView from './LendingView';
import ItemModal, { CATEGORIES } from './ItemModal';
import FriendsTab from './FriendsTab';
import BookshelfTab from './BookshelfTab';
import RankingsTab from './RankingsTab';
import HomeView from './HomeView';
import ProfileView, { Avatar } from './ProfileView';
import AssistantPanel from './AssistantPanel';
import HabitsView from './HabitsView';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

function NavTab({ tab, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative shrink-0 h-full flex items-center gap-1.5 px-3 py-3 md:py-0 transition-colors hover:text-black"
      style={{ ...sans, fontSize: '13px', color: active ? '#1a1713' : '#a09890', fontWeight: active ? 500 : 400 }}
    >
      {tab.label}
      {badge > 0 && (
        <span className="min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-white" style={{ fontSize: '9px', backgroundColor: '#c9b99a' }}>
          {badge}
        </span>
      )}
      {active && <span className="absolute left-3 right-3 bottom-0 h-px" style={{ backgroundColor: '#1a1713' }} />}
    </button>
  );
}

const ALL = { id: 'ALL', label: 'All' };

// ─── Sortable item card (closet) ──────────────────────────────────────────────

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
    <div ref={setNodeRef} style={style} className="group cursor-pointer" onClick={() => onEdit(item)}>
      <div className="aspect-[3/4] w-full overflow-hidden relative mb-3" style={{ backgroundColor: '#f5f0eb' }}>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-15">{cat?.emoji}</span></div>
        }
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: 'rgba(26,23,19,0.04)' }} />
        <div
          {...attributes} {...listeners}
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
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(item); }}
            className="w-7 h-7 flex items-center justify-center"
            style={{ backgroundColor: '#FAF8F5', color: '#a09890', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M8.5 1.5l2 2L4 10H2v-2L8.5 1.5z"/></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(item.id); }}
            className="w-7 h-7 flex items-center justify-center"
            style={{ backgroundColor: '#FAF8F5', color: '#a09890', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 3h8M5 3V2h2v1M3 3l.5 7h5L9 3"/></svg>
          </button>
        </div>
      </div>
      <div>
        <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="truncate">{item.name}</p>
        {(item.brand || item.color) && (
          <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px', letterSpacing: '0.02em' }} className="truncate">
            {[item.brand, item.color].filter(Boolean).join(' · ')}
          </p>
        )}
        {item.size && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e', marginTop: '2px' }}>Size {item.size}</p>}
        {hostname && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
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
        <h2 style={{ ...serif, fontSize: '18px', fontWeight: 400, color: '#1a1713', letterSpacing: '-0.01em' }}>{cat?.label}</h2>
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

// ─── Feed item card (read-only, shows friend name) ───────────────────────────

function FeedItemCard({ item }) {
  const cat = CATEGORIES.find(c => c.id === item.category);
  let hostname = '';
  try { hostname = new URL(item.sourceUrl).hostname.replace(/^www\./, ''); } catch {}

  return (
    <div className="group">
      <div className="aspect-[3/4] w-full overflow-hidden relative mb-3" style={{ backgroundColor: '#f5f0eb' }}>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          : <div className="w-full h-full flex items-center justify-center"><span className="text-4xl opacity-15">{cat?.emoji}</span></div>
        }
      </div>
      <div>
        <p style={{ ...sans, fontSize: '10px', color: '#c9b99a', letterSpacing: '0.08em', marginBottom: '3px', textTransform: 'uppercase' }}>
          {item.friendDisplayName}
        </p>
        <p style={{ ...sans, fontSize: '13px', fontWeight: 500, color: '#1a1713', lineHeight: 1.3 }} className="truncate">{item.name}</p>
        {(item.brand || item.color) && (
          <p style={{ ...sans, fontSize: '11px', color: '#a09890', marginTop: '2px', letterSpacing: '0.02em' }} className="truncate">
            {[item.brand, item.color].filter(Boolean).join(' · ')}
          </p>
        )}
        {item.size && <p style={{ ...sans, fontSize: '11px', color: '#b0a89e', marginTop: '2px' }}>Size {item.size}</p>}
        {hostname && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
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

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function WardrobeApp({ user, displayName, onLogout }) {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeOccasion, setActiveOccasion] = useState('ALL');
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loadingItems, setLoadingItems] = useState(true);
  const [view, setView] = useState('home'); // 'home' | 'profile' | 'friends' | 'closet' | 'closet-friends' | 'bookshelf' | 'rankings' | 'lending' | 'book-friends' | 'habits'
  const [pendingCount, setPendingCount] = useState(0);
  // Bumped when the assistant changes books, so the shelf and rankings reload
  const [booksVersion, setBooksVersion] = useState(0);
  const [habitsVersion, setHabitsVersion] = useState(0);
  const [lending, setLending] = useState([]);
  const [name, setName] = useState(displayName); // the name friends see

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function migrateFromLocalStorage() {
    const itemsKeys = Object.keys(localStorage).filter(k => k.startsWith('dw:items:'));
    if (!itemsKeys.length) return;
    const allItems = itemsKeys.flatMap(k => JSON.parse(localStorage.getItem(k) || '[]'));
    if (!allItems.length) return;
    itemsKeys.forEach(k => localStorage.removeItem(k));
    await migrateItems(allItems);
  }

  async function loadItems() {
    try {
      const data = await getItems();
      if (data.length === 0) {
        const itemsKeys = Object.keys(localStorage).filter(k => k.startsWith('dw:items:'));
        if (itemsKeys.length > 0) {
          setError('Importing your items…');
          await migrateFromLocalStorage();
          setError('');
        }
        setItems(await getItems());
      } else {
        setItems(data);
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => {
    ensureProfile(user, displayName)
      .then(getMyProfile)
      .then(p => p.displayName && setName(p.displayName))
      .catch(console.error);
    loadItems();
    loadLending();
  }, []);

  // Every page (and login itself) starts at the top, not wherever the last screen was scrolled
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  async function loadLending() {
    try {
      setLending(await getMyLending());
    } catch (e) {
      console.error('Lending load error:', e);
    }
  }

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
  const counts = {};
  items.forEach(i => { counts[i.category] = (counts[i.category] || 0) + 1; });

  const filtered = items.filter(item => {
    const matchCat = activeCategory === 'ALL' || item.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || item.name.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q) || item.color?.toLowerCase().includes(q);
    const occasions = item.occasions?.length ? item.occasions : ['everyday', 'work', 'athletic'];
    const matchOccasion = activeOccasion === 'ALL' || occasions.includes(activeOccasion);
    return matchCat && matchSearch && matchOccasion;
  });

  const grouped = CATEGORIES.map(cat => ({
    category: cat.id,
    items: filtered.filter(i => i.category === cat.id),
  })).filter(g => g.items.length > 0);

  const lentTo = lentToMap(lending);
  const loanRequestCount = lending.filter(l => l.status === 'requested').length;

  // The closet and the bookshelf are separate spaces: each only shows its own tabs.
  // Home, profile and the all-friends page show none.
  const SPACES = {
    closet: [
      { id: 'closet',         label: 'My Closet' },
      { id: 'closet-friends', label: 'Friends'   },
    ],
    books: [
      { id: 'bookshelf',    label: 'My Shelf' },
      { id: 'rankings',     label: 'Rankings' },
      { id: 'lending',      label: 'Lending'  },
      { id: 'book-friends', label: 'Friends'  },
    ],
  };
  const navTabs = Object.values(SPACES).find(tabs => tabs.some(t => t.id === view)) || [];

  const badgeFor = id => id.endsWith('friends') ? pendingCount : id === 'lending' ? loanRequestCount : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FAF8F5', fontFamily: "'Open Sans', sans-serif" }}>

      {/* Header — logo, sections, account. One row on desktop. */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #e8e3de' }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
          <button onClick={() => setView('home')} className="hover:opacity-70 transition-opacity">
            <h1 style={{ ...serif, fontSize: '22px', fontWeight: 400, color: '#1a1713', letterSpacing: '-0.01em' }}>
              homey
            </h1>
          </button>
          <nav className={`${navTabs.length ? 'hidden md:flex' : 'hidden'} items-center gap-1 h-full`}>
            {navTabs.map(t => <NavTab key={t.id} tab={t} active={view === t.id} badge={badgeFor(t.id)} onClick={() => setView(t.id)} />)}
          </nav>
          <button
            onClick={() => setView('profile')}
            title="Your profile"
            className="ml-auto rounded-full transition-shadow hover:shadow-[0_0_0_3px_#ece4d8]"
            style={view === 'profile' ? { boxShadow: '0 0 0 2px #1a1713' } : undefined}
          >
            <Avatar name={name} size={32} />
          </button>
        </div>
        {/* Mobile: sections get their own scrollable row */}
        <nav className={`${navTabs.length ? 'flex md:hidden' : 'hidden'} px-3 overflow-x-auto scrollbar-hide`} style={{ borderTop: '1px solid #f0ebe3' }}>
          {navTabs.map(t => <NavTab key={t.id} tab={t} active={view === t.id} badge={badgeFor(t.id)} onClick={() => setView(t.id)} />)}
        </nav>
      </header>

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca' }} className="px-6 py-2.5 flex items-center justify-between">
          <p style={{ ...sans, fontSize: '12px', color: '#c0392b', fontWeight: 500 }}>{error}</p>
          <button onClick={() => setError('')} style={{ color: '#f5a5a5' }} className="hover:opacity-70 ml-4">✕</button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-10 pb-24">

        {/* ── Closet toolbar: categories left, search / occasion / add right ── */}
        {view === 'closet' && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mb-10">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide min-w-0 w-full lg:w-auto">
              {tabs.map(cat => {
                const count = cat.id === 'ALL' ? items.length : (counts[cat.id] || 0);
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className="shrink-0 rounded-full px-3.5 py-1.5 transition-colors"
                    style={{
                      ...sans, fontSize: '12px',
                      backgroundColor: isActive ? '#1a1713' : 'transparent',
                      color: isActive ? '#FAF8F5' : '#8a8178',
                    }}
                  >
                    {cat.label}{count > 0 && <span style={{ opacity: 0.5, marginLeft: 5 }}>{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              <label className="relative flex-1 min-w-0 lg:flex-none">
                <svg className="absolute left-0 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b0a89e" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search"
                  style={{ ...sans, borderColor: '#e0d9d2', fontSize: '12px', color: '#1a1713' }}
                  className="w-full lg:w-40 bg-transparent border-b pl-5 py-1.5 focus:outline-none focus:border-black/40 transition-colors placeholder:text-black/25"
                />
              </label>
              <select
                value={activeOccasion}
                onChange={e => setActiveOccasion(e.target.value)}
                aria-label="Occasion"
                style={{ ...sans, fontSize: '12px', color: activeOccasion === 'ALL' ? '#8a8178' : '#1a1713', borderColor: '#e0d9d2' }}
                className="shrink-0 bg-transparent border-b py-1.5 pr-1 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Any occasion</option>
                <option value="everyday">Everyday</option>
                <option value="work">Work &amp; Formal</option>
                <option value="athletic">Athletic</option>
              </select>
              <button
                onClick={() => setModal({ mode: 'add' })}
                style={{ ...sans, fontSize: '12px', backgroundColor: '#1a1713', color: '#FAF8F5' }}
                className="shrink-0 rounded-full px-4 py-1.5 hover:opacity-80 transition-opacity"
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* ── Home ── */}
        {view === 'home' && (
          <HomeView
            displayName={name}
            items={items}
            loadingItems={loadingItems}
            lendingRequests={loanRequestCount}
            friendRequests={pendingCount}
            habitsVersion={habitsVersion}
            onGo={setView}
          />
        )}

        {/* ── Habits ── */}
        {view === 'habits' && <HabitsView key={habitsVersion} />}

        {/* ── Profile ── */}
        {view === 'profile' && <ProfileView fallbackName={name} items={items} lending={lending} onNameChange={setName} onLogout={onLogout} />}

        {/* ── Bookshelf ── */}
        {view === 'bookshelf' && <BookshelfTab key={booksVersion} lentTo={lentTo} />}

        {/* ── Rankings ── */}
        {view === 'rankings' && <RankingsTab key={booksVersion} />}

        {/* ── Lending ── */}
        {view === 'lending' && <LendingView lending={lending} onLendingChange={loadLending} />}

        {/* ── Friends ── */}
        {['friends', 'closet-friends', 'book-friends'].includes(view) && (
          <FriendsTab
            key={view}
            scope={{ 'closet-friends': 'closet', 'book-friends': 'books' }[view]}
            onPendingCountChange={setPendingCount}
          />
        )}

        {/* ── My Closet ── */}
        {view === 'closet' && (
          loadingItems ? (
            <div className="flex items-center justify-center py-36">
              <p style={{ ...serif, fontSize: '20px', fontWeight: 300, color: '#c9b99a' }}>loading your wardrobe…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-36 text-center">
              <p style={{ ...serif, fontSize: '28px', fontWeight: 300, color: '#c9b99a', marginBottom: '24px' }}>
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
          )
        )}
      </main>

      <AssistantPanel
        space={SPACES.closet.some(t => t.id === view) ? 'closet' : SPACES.books.some(t => t.id === view) ? 'books' : 'any'}
        onChanged={changed => {
          if (changed.includes('closet')) loadItems();
          if (changed.includes('books')) setBooksVersion(v => v + 1);
          if (changed.includes('habits')) setHabitsVersion(v => v + 1);
        }}
      />

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
