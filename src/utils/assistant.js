// "Ask homey": Claude decides what to do (via the `assistant` edge function),
// and the browser carries it out here with the user's own session.
import { supabase } from './supabase';
import { getBooks, addBook, updateBook, searchBooks } from './books';
import { getItems, addItem, updateItem } from './wardrobe';
import { fetchProductInfo, fetchImageData } from './urlParser';
import { sameBookKey } from './goodreads';
import { compressImage } from '../components/ItemModal';
import { getHabits, addHabit, getChecks, setCheck, streak, dayKey } from './habits';

const MAX_STEPS = 10;
const SHELF_LABEL = { want: 'Want to Read', reading: 'Currently Reading', read: 'Read' };
const CATEGORY_LABEL = { TOPS: 'Tops', BOTTOMS: 'Bottoms', OUTERWEAR: 'Outerwear', DRESSES: 'Dresses', SHOES: 'Shoes', ACCESSORIES: 'Accessories', OTHER: 'Other' };

const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const matches = (q, ...fields) => {
  const words = norm(q).split(' ').filter(Boolean);
  const hay = norm(fields.join(' '));
  return words.every(w => hay.includes(w));
};
const str = v => (typeof v === 'string' ? v.trim() : '');
const SHELVES = ['want', 'reading', 'read'];
const CATEGORIES = Object.keys(CATEGORY_LABEL);
const OCCASIONS = ['everyday', 'work', 'athletic'];
const clampRating = r => (Number.isInteger(r) && r >= 1 && r <= 5 ? r : null);
const bookOut = b => ({ id: b.id, title: b.title, author: b.author, shelf: b.status, rating: b.rating || null, year_read: b.readYear || null });
const THIS_YEAR = new Date().getFullYear();
const validYear = y => (Number.isInteger(y) && y >= 1900 && y <= THIS_YEAR ? y : null);
const itemOut = i => ({ id: i.id, name: i.name, brand: i.brand, color: i.color, size: i.size, category: i.category });

// Each tool returns { result } for Claude, plus an optional `done` line to show
// the person and which part of the app changed.
const TOOLS = {
  async search_my_books({ query }) {
    query = str(query);
    const books = await getBooks();
    const hits = query.trim() ? books.filter(b => matches(query, b.title, b.author)) : books;
    return { result: { count: hits.length, books: hits.slice(0, 25).map(bookOut) } };
  },

  async add_book(input) {
    const title = str(input.title), author = str(input.author), notes = str(input.notes);
    const shelf = SHELVES.includes(input.shelf) ? input.shelf : 'want';
    const rating = input.rating;
    if (!title) return { result: { error: 'A title is required.' }, isError: true };
    const books = await getBooks();
    const key = sameBookKey({ title, author: author || '' });
    const dupe = books.find(b => sameBookKey(b) === key || (!author && norm(b.title) === norm(title)));
    if (dupe) return { result: { already_on_shelf: bookOut(dupe) } };

    let found = null;
    try {
      const results = await searchBooks([title, author].filter(Boolean).join(' '));
      found = results.find(r => norm(r.title) === norm(title)) || results[0] || null;
    } catch { /* Open Library down: add with what we have */ }
    if (found?.olKey && books.some(b => b.olKey === found.olKey)) {
      return { result: { already_on_shelf: bookOut(books.find(b => b.olKey === found.olKey)) } };
    }

    const book = await addBook({
      ...(found || {}),
      title: found?.title || title,
      author: found?.author || author || '',
      status: shelf,
      rating: shelf === 'read' ? clampRating(rating) : null,
      readYear: shelf === 'read' ? validYear(input.year_read) || THIS_YEAR : null,
      notes: notes || '',
    });
    return {
      result: { added: bookOut(book), matched_open_library: !!found },
      done: `Added ${book.title} to ${SHELF_LABEL[shelf]}`,
      changed: 'books',
    };
  },

  async update_book({ book_id, shelf, rating, notes, year_read }) {
    if (!SHELVES.includes(shelf)) shelf = null;
    if (typeof notes !== 'string') notes = null;
    const book = (await getBooks()).find(b => b.id === book_id);
    if (!book) return { result: { error: 'No book with that id on their shelf. Search again.' }, isError: true };
    const next = {
      ...book,
      status: shelf ?? book.status,
      rating: rating != null ? clampRating(rating) : book.rating,
      notes: notes ?? book.notes,
      readYear: validYear(year_read) || book.readYear || (shelf === 'read' && book.status !== 'read' ? THIS_YEAR : null),
    };
    const saved = await updateBook(book.id, next);
    const what = shelf && shelf !== book.status ? `Moved ${saved.title} to ${SHELF_LABEL[shelf]}` : `Updated ${saved.title}`;
    return { result: { updated: bookOut(saved) }, done: what, changed: 'books' };
  },

  async search_my_closet({ query }) {
    query = str(query);
    const items = await getItems();
    const hits = query.trim() ? items.filter(i => matches(query, i.name, i.brand, i.color, CATEGORY_LABEL[i.category])) : items;
    return { result: { count: hits.length, items: hits.slice(0, 25).map(itemOut) } };
  },

  async add_closet_item(input) {
    const name = str(input.name);
    if (!name) return { result: { error: 'A name is required.' }, isError: true };
    const occasions = Array.isArray(input.occasions) ? input.occasions.filter(o => OCCASIONS.includes(o)) : [];
    const item = await addItem({
      name,
      category: CATEGORIES.includes(input.category) ? input.category : 'OTHER',
      brand: str(input.brand), color: str(input.color), size: str(input.size), notes: str(input.notes),
      occasions: occasions.length ? occasions : OCCASIONS,
    });
    return { result: { added: itemOut(item) }, done: `Added ${item.name} to ${CATEGORY_LABEL[item.category]}`, changed: 'closet' };
  },

  async add_closet_item_from_link({ url, category }) {
    url = str(url);
    if (!CATEGORIES.includes(category)) category = null;
    let info;
    try {
      if (!/^https?:$/.test(new URL(url).protocol)) throw new Error('not a web link');
      info = await fetchProductInfo(url);
    } catch (e) {
      return { result: { error: `Couldn't read that page: ${e.message}. Ask them what the item is instead.` }, isError: true };
    }
    let image = '';
    if (info.image) {
      try {
        const data = await fetchImageData(info.image);
        image = data ? await compressImage(data) : info.image;
      } catch { image = info.image; }
    }
    const item = await addItem({
      ...info,
      image,
      category: category || info.category || 'OTHER',
      sourceUrl: url,
      occasions: OCCASIONS,
    });
    return { result: { added: itemOut(item) }, done: `Added ${item.name} to ${CATEGORY_LABEL[item.category]}`, changed: 'closet' };
  },

  async update_closet_item({ item_id, ...patch }) {
    const item = (await getItems()).find(i => i.id === item_id);
    if (!item) return { result: { error: 'No item with that id in their closet. Search again.' }, isError: true };
    const next = { ...item };
    for (const k of ['name', 'brand', 'color', 'size', 'notes']) if (str(patch[k])) next[k] = str(patch[k]);
    if (CATEGORIES.includes(patch.category)) next.category = patch.category;
    const saved = await updateItem(item.id, next);
    return { result: { updated: itemOut(saved) }, done: `Updated ${saved.name}`, changed: 'closet' };
  },
};

// ─── Habits ───
const daysAgoKey = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };

Object.assign(TOOLS, {
  async list_habits() {
    const [habits, checks] = await Promise.all([getHabits(), getChecks(daysAgoKey(120), daysAgoKey(0))]);
    return { result: { today: daysAgoKey(0), habits: habits.map(h => ({ id: h.id, name: h.name, done_today: checks.has(`${h.id}|${daysAgoKey(0)}`), streak: streak(checks, h.id) })) } };
  },

  async check_off_habit({ habit_id, done, days_ago }) {
    const habit = (await getHabits()).find(h => h.id === habit_id);
    if (!habit) return { result: { error: 'No habit with that id. Call list_habits.' }, isError: true };
    const ago = Number.isInteger(days_ago) && days_ago >= 0 && days_ago <= 30 ? days_ago : 0;
    const on = done !== false;
    await setCheck(habit.id, daysAgoKey(ago), on);
    const when = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;
    return { result: { habit: habit.name, day: daysAgoKey(ago), done: on }, done: `${on ? 'Checked off' : 'Unchecked'} ${habit.name} for ${when}`, changed: 'habits' };
  },

  async add_habit({ name }) {
    const clean = str(name);
    const existing = (await getHabits()).find(h => norm(h.name) === norm(clean));
    if (existing) return { result: { already_exists: { id: existing.id, name: existing.name } } };
    const habit = await addHabit(clean);
    return { result: { added: { id: habit.id, name: habit.name } }, done: `Added habit: ${habit.name}`, changed: 'habits' };
  },
});

async function callClaude(messages) {
  const { data, error } = await supabase.functions.invoke('assistant', { body: { messages } });
  if (error) {
    // Pull the server's message out of a non-2xx response
    let msg = '';
    try { msg = (await error.context?.json())?.error || ''; } catch { /* not JSON */ }
    if (msg === 'NOT_CONFIGURED' || error.context?.status === 404) {
      throw new Error("The assistant isn't switched on yet. It needs an Anthropic API key added in Supabase.");
    }
    throw new Error(msg || 'Could not reach the assistant. Try again.');
  }
  return data;
}

// Runs one request to completion. `history` is the API conversation so far
// (kept by the caller so follow-ups have context). Calls onEvent with
// { type: 'action', text } as things happen. Returns { history, reply, changed }.
export async function ask(history, text, onEvent) {
  const messages = [...history, { role: 'user', content: text }];
  const changed = new Set();

  for (let step = 0; step < MAX_STEPS; step++) {
    const { content, stop_reason } = await callClaude(messages);
    messages.push({ role: 'assistant', content });

    if (stop_reason === 'refusal') {
      return { history: messages.slice(0, -2), reply: "Sorry, I can't help with that one.", changed };
    }
    const calls = content.filter(b => b.type === 'tool_use');
    if (stop_reason !== 'tool_use' || !calls.length) {
      const reply = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return { history: messages, reply: reply || 'Done.', changed };
    }

    const results = [];
    for (const call of calls) {
      const tool = TOOLS[call.name];
      let out;
      try {
        out = tool ? await tool(call.input || {}) : { result: { error: 'Unknown tool' }, isError: true };
      } catch (e) {
        out = { result: { error: e.message || 'That did not work.' }, isError: true };
      }
      if (out.done) onEvent?.({ type: 'action', text: out.done });
      if (out.changed) changed.add(out.changed);
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(out.result),
        ...(out.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
  }
  return { history: messages, reply: 'That took more steps than I expected. Check your shelf and closet, and tell me if anything is missing.', changed };
}
