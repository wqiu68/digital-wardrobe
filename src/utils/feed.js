import { supabase } from './supabase';

// What friends did recently, as posts:
//   { id, type: 'closet' | 'books' | 'finished' | 'ranked', userId, at, items | books | book }
// Clothes added within 12 hours become one post unless marked separate_post.

const DAY = 24 * 60 * 60 * 1000;
const WINDOW = 12 * 60 * 60 * 1000;
const SINCE_DAYS = 30;

const ms = v => (v == null ? null : typeof v === 'number' ? v : Date.parse(v));

const missingColumn = e => /separate_post|finished_at|ranked_at|column|schema cache/i.test(e?.message || '');

async function friendItems(ids, since) {
  const run = cols => supabase.from('wardrobe_items').select(cols).in('user_id', ids).gte('added_at', since).order('added_at', { ascending: false }).limit(150);
  let { data, error } = await run('id, user_id, name, brand, category, image, added_at, separate_post');
  if (error && missingColumn(error)) ({ data, error } = await run('id, user_id, name, brand, category, image, added_at'));
  if (error) throw error;
  return data || [];
}

async function friendBooks(ids, since) {
  const iso = new Date(since).toISOString();
  const base = 'id, user_id, title, author, cover, status, rating, sentiment, added_at';
  let { data, error } = await supabase.from('books').select(`${base}, finished_at, ranked_at`).in('user_id', ids)
    .or(`added_at.gte.${since},finished_at.gte.${iso},ranked_at.gte.${iso}`).limit(300);
  if (error && missingColumn(error)) {
    ({ data, error } = await supabase.from('books').select(base).in('user_id', ids).gte('added_at', since).limit(300));
  }
  if (error) throw error;
  return data || [];
}

// Put things one person did close together into posts: a new post starts when
// more than 12 hours have passed since the post's first thing, or when an
// item asked to be on its own.
function bunch(rows, at, key = () => '') {
  const byUser = {};
  for (const r of rows) (byUser[r.user_id + '|' + key(r)] ||= []).push(r);
  const posts = [];
  for (const list of Object.values(byUser)) {
    list.sort((a, b) => at(a) - at(b));
    let cur = null;
    for (const r of list) {
      if (r.separate_post) { posts.push([r]); continue; } // its own post; doesn't break up the others
      if (cur && at(r) - at(cur[0]) <= WINDOW) cur.push(r);
      else { cur = [r]; posts.push(cur); }
    }
  }
  return posts;
}

export async function getFeed(friendIds, scope) {
  if (!friendIds.length) return [];
  const since = Date.now() - SINCE_DAYS * DAY;
  const wantCloset = scope !== 'books';
  const wantBooks = scope !== 'closet';
  const [items, books] = await Promise.all([
    wantCloset ? friendItems(friendIds, since) : [],
    wantBooks ? friendBooks(friendIds, since) : [],
  ]);

  const posts = [];

  for (const group of bunch(items, r => ms(r.added_at))) {
    const newest = group[group.length - 1];
    posts.push({ id: `c-${group[0].id}`, type: 'closet', userId: newest.user_id, at: ms(newest.added_at), items: [...group].reverse() });
  }

  // Books added, bunched the same way, one post per shelf
  const added = books.filter(b => ms(b.added_at) >= since);
  const shelfAtAdd = b => (b.finished_at ? 'want' : b.status); // finished later → it went on as want/reading
  for (const group of bunch(added, r => ms(r.added_at), shelfAtAdd)) {
    const newest = group[group.length - 1];
    posts.push({ id: `b-${group[0].id}`, type: 'books', shelf: shelfAtAdd(newest), userId: newest.user_id, at: ms(newest.added_at), books: [...group].reverse() });
  }

  for (const b of books) {
    const fin = ms(b.finished_at);
    const rank = ms(b.ranked_at);
    const together = fin && rank && Math.abs(fin - rank) < 30 * 60 * 1000;
    if (rank && rank >= since) posts.push({ id: `r-${b.id}`, type: 'ranked', finished: together, userId: b.user_id, at: rank, book: b });
    if (fin && fin >= since && !together) posts.push({ id: `f-${b.id}`, type: 'finished', userId: b.user_id, at: fin, book: b });
  }

  return posts.sort((a, b) => b.at - a.at).slice(0, 50);
}
