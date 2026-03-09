const storageKey = (username) => `dw:items:${username.toLowerCase()}`;

function load(username) {
  try { return JSON.parse(localStorage.getItem(storageKey(username)) || '[]'); }
  catch { return []; }
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
