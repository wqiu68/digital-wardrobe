import { supabase, getCurrentUser } from './supabase';
import { inferGenre } from './ranking';

const MAX_IMAGE_BYTES = 80000;

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toDb(book) {
  const cover = book.cover || '';
  return {
    title: book.title,
    author: book.author || '',
    // Remote URLs are tiny; only cap embedded data URLs
    cover: cover.startsWith('data:') && cover.length > MAX_IMAGE_BYTES ? '' : cover,
    status: book.status || 'read',
    rating: book.rating ? toInt(book.rating) : null,
    notes: book.notes || '',
    year: toInt(book.year),
    pages: toInt(book.pages),
    isbn: book.isbn || '',
    ol_key: book.olKey || '',
    genre: book.genre || '',
    read_year: toInt(book.readYear),
  };
}

function fromDb(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    cover: row.cover,
    status: row.status,
    rating: row.rating,
    notes: row.notes,
    year: row.year,
    pages: row.pages,
    isbn: row.isbn,
    olKey: row.ol_key,
    genre: row.genre || '',
    readYear: row.read_year ?? null,
    sentiment: row.sentiment || null,
    rankOrder: row.rank_order,
    addedAt: row.added_at,
    sort_order: row.sort_order,
  };
}

export async function getBooks() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDb);
}

// A friend's full bookshelf (allowed by RLS for accepted friends)
export async function getFriendBooks(userId) {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDb);
}

export async function addBook(book) {
  const user = await getCurrentUser();

  // New books prepend: find min sort_order and go one lower
  const { data: existing } = await supabase
    .from('books')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .limit(1);
  const minSort = existing?.[0]?.sort_order ?? 0;

  const { data, error } = await supabase
    .from('books')
    .insert({ ...toDb(book), user_id: user.id, sort_order: minSort - 1, added_at: Date.now() })
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

// Bulk add (Goodreads import). Keeps the given order at the top of the shelf.
export async function addBooks(books) {
  const user = await getCurrentUser();
  const { data: existing } = await supabase
    .from('books')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .limit(1);
  const minSort = existing?.[0]?.sort_order ?? 0;
  const now = Date.now();

  const rows = books.map((b, i) => ({
    ...toDb(b),
    user_id: user.id,
    sort_order: minSort - books.length + i,
    added_at: b.addedAt || now,
    sentiment: b.sentiment || null,
    rank_order: b.sentiment ? b.rankOrder : null,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('books').insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
}

export async function updateBook(id, patch) {
  const { data, error } = await supabase
    .from('books')
    .update(toDb(patch))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

// Place a book in your rankings. Ranking a book implies you've finished it.
export async function setRanking(id, { sentiment, rankOrder, genre }) {
  const patch = { sentiment, rank_order: rankOrder, status: 'read' };
  if (genre != null) patch.genre = genre;
  const { error } = await supabase.from('books').update(patch).eq('id', id);
  if (error) throw error;
}

export async function clearRanking(id) {
  const { error } = await supabase.from('books').update({ sentiment: null, rank_order: null }).eq('id', id);
  if (error) throw error;
}

export async function deleteBook(id) {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderBooks(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('books').update({ sort_order: index }).eq('id', id)
    )
  );
}

// ─── Open Library search (free, CORS-enabled, no key) ─────────────────────────

export async function searchBooks(query, signal) {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    q,
    limit: '8',
    fields: 'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject',
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal });
  if (!res.ok) throw new Error('Book search is unavailable right now.');
  const json = await res.json();
  return (json.docs || []).map(d => ({
    title: d.title || '',
    author: (d.author_name || []).slice(0, 2).join(', '),
    year: d.first_publish_year || null,
    pages: d.number_of_pages_median || null,
    isbn: d.isbn?.[0] || '',
    olKey: d.key || '',
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    genre: inferGenre(d.subject),
  }));
}
