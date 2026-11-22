import { supabase, getCurrentUser } from './supabase';

// What's in the shop. Prices must match public.home_price() in
// supabase/migrations/*_homes.sql (the database is what actually charges).
export const LEVELS = [
  { level: 1, id: 'level1', label: 'Cottage', price: 0 },
  { level: 2, id: 'level2', label: 'Bungalow', price: 100 },
  { level: 3, id: 'level3', label: 'Two-story house', price: 250 },
  { level: 4, id: 'level4', label: 'Manor', price: 600 },
];

export const levelLabel = l => LEVELS.find(x => x.level === l)?.label || 'Cottage';

export const PAINTS = [
  { id: 'cream', label: 'Cream', color: '#f3e9d8', price: 0 },
  { id: 'paint_sage', label: 'Sage', color: '#c5d3b8', price: 20 },
  { id: 'paint_sky', label: 'Sky', color: '#c4d8e6', price: 20 },
  { id: 'paint_blush', label: 'Blush', color: '#ecc9c3', price: 20 },
  { id: 'paint_butter', label: 'Butter', color: '#f1dc9a', price: 20 },
  { id: 'paint_terracotta', label: 'Terracotta', color: '#d39a7c', price: 30 },
  { id: 'paint_navy', label: 'Navy', color: '#4f5f7a', price: 40 },
];

export const EXTRAS = [
  { id: 'flowers', label: 'Flower bed', price: 15 },
  { id: 'mailbox', label: 'Mailbox', price: 15 },
  { id: 'lamp', label: 'Porch lamp', price: 25 },
  { id: 'tree', label: 'Tree', price: 30 },
  { id: 'fence', label: 'Picket fence', price: 40 },
  { id: 'cat', label: 'Cat', price: 60 },
  { id: 'dog', label: 'Dog', price: 80 },
  { id: 'pond', label: 'Pond', price: 100 },
];

export const POINTS = { book: 10, piece: 5, check: 2 };

export const DEFAULT_HOME = { level: 1, paint: 'cream', owned: [], spent: 0, look: {}, photo: null };

const fromDb = row => (row ? { level: row.level, paint: row.paint, owned: row.owned || [], spent: row.spent, look: row.look || {}, photo: row.photo || null } : { ...DEFAULT_HOME });

export const isMissingHomes = e => /homes|home_points|buy_home_upgrade|set_home_paint|set_my_look|schema cache|does not exist/i.test(e?.message || '');

// { [userId]: home } for you and any friends (people without a row get a cottage)
export async function getHomes(userIds) {
  const ids = [...new Set(userIds)];
  const out = Object.fromEntries(ids.map(id => [id, { ...DEFAULT_HOME }]));
  if (!ids.length) return out;
  const { data, error } = await supabase.from('homes').select('*').in('user_id', ids);
  if (error) throw error;
  for (const row of data || []) out[row.user_id] = fromDb(row);
  return out;
}

export async function getMyHome() {
  const user = await getCurrentUser();
  return (await getHomes([user.id]))[user.id];
}

// { books, pieces, checks, earned, spent, balance }
export async function getMyPoints() {
  const { data, error } = await supabase.rpc('my_home_points');
  if (error) throw error;
  const p = (Array.isArray(data) ? data[0] : data) || { books: 0, pieces: 0, checks: 0, earned: 0, spent: 0 };
  return { ...p, balance: Math.max(0, p.earned - p.spent) };
}

export async function buyUpgrade(item) {
  const { data, error } = await supabase.rpc('buy_home_upgrade', { item });
  if (error) throw new Error(error.message);
  return fromDb(data);
}

export async function setPaint(paint) {
  const { data, error } = await supabase.rpc('set_home_paint', { paint });
  if (error) throw new Error(error.message);
  return fromDb(data);
}

// { [userId]: 'Book title' } for friends with something on Currently Reading
export async function getReadingNow(userIds) {
  if (!userIds.length) return {};
  const { data } = await supabase.from('books').select('user_id, title').in('user_id', userIds).eq('status', 'reading').limit(200);
  const out = {};
  for (const b of data || []) if (!out[b.user_id]) out[b.user_id] = b.title;
  return out;
}

// Your person's colors ({ skin, hair, shirt, long }) and face photo (data URL or null)
export async function setMyLook(look, photo) {
  const { data, error } = await supabase.rpc('set_my_look', { look, photo: photo || null });
  if (error) throw new Error(error.message);
  return fromDb(data);
}

// A square, small JPEG of the middle of a photo, for a face
export function facePhoto(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a photo.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
