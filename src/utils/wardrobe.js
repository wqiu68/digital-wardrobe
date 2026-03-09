const storageKey = (username) => `dw:items:${username.toLowerCase()}`;

const MAX_IMAGE_BYTES = 80000; // ~80KB base64 — keeps images small enough to fit many items

function load(username) {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey(username)) || '[]');
    // One-time migration: strip any oversized images already in storage
    const cleaned = items.map(item =>
      item.image && item.image.length > MAX_IMAGE_BYTES
        ? { ...item, image: '' }
        : item
    );
    if (cleaned.some((item, i) => item.image !== items[i].image)) {
      localStorage.setItem(storageKey(username), JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return []; }
}

function persist(username, items) {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(items));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      // Strip images from all items and try again
      const stripped = items.map(item => ({ ...item, image: '' }));
      try {
        localStorage.setItem(storageKey(username), JSON.stringify(stripped));
        throw new Error('QUOTA: Your wardrobe was saved but images were removed to free up space. Try uploading smaller images.');
      } catch (e2) {
        if (e2.message.startsWith('QUOTA:')) throw e2;
        throw new Error('Storage is full. Please delete some items.');
      }
    }
    throw e;
  }
}

export function getItems(username) {
  return load(username);
}

export function addItem(username, item) {
  const items = load(username);
  const newItem = { ...item, id: crypto.randomUUID(), addedAt: Date.now() };
  items.unshift(newItem);
  persist(username, items);
  return newItem;
}

export function updateItem(username, id, patch) {
  const items = load(username);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch };
  persist(username, items);
  return items[idx];
}

export function deleteItem(username, id) {
  const items = load(username).filter(i => i.id !== id);
  persist(username, items);
}

export function reorderItems(username, orderedIds) {
  const items = load(username);
  const map = Object.fromEntries(items.map(i => [i.id, i]));
  const reordered = orderedIds.map(id => map[id]).filter(Boolean);
  // append any items not in orderedIds (safety net)
  items.forEach(i => { if (!orderedIds.includes(i.id)) reordered.push(i); });
  persist(username, reordered);
}
