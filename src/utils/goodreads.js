// Goodreads import. Goodreads closed its public API in 2020, so the reliable
// route is the library export: My Books → Import and export → Export Library,
// which gives a CSV of every book with shelf, rating, review and dates.
import { inferGenre } from './ranking';

// RFC 4180-ish CSV parser: quoted fields, "" escapes, newlines inside quotes
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}

const SHELF_TO_STATUS = { 'read': 'read', 'currently-reading': 'reading', 'to-read': 'want' };

// Goodreads wraps ISBNs as ="0441013597"
const cleanIsbn = v => (v || '').replace(/[^0-9Xx]/g, '');
// "Dune (Dune Chronicles, #1)" → "Dune"
const cleanTitle = t => t.replace(/\s*\([^)]*#\d+(\.\d+)?\)\s*$/, '').trim();
const toYear = v => (/^\d{3,4}$/.test((v || '').trim()) ? Number(v) : '');
const toDate = v => { const t = Date.parse((v || '').replace(/\//g, '-')); return Number.isFinite(t) ? t : null; };

export function parseGoodreadsExport(text) {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  const col = name => header?.findIndex(h => h.trim() === name) ?? -1;
  const idx = {
    title: col('Title'), author: col('Author'), isbn: col('ISBN'), isbn13: col('ISBN13'),
    rating: col('My Rating'), pages: col('Number of Pages'), year: col('Year Published'),
    origYear: col('Original Publication Year'), shelf: col('Exclusive Shelf'),
    review: col('My Review'), dateRead: col('Date Read'), dateAdded: col('Date Added'),
  };
  if (idx.title < 0 || idx.shelf < 0) {
    throw new Error("That doesn't look like a Goodreads export. Use My Books → Import and export → Export Library.");
  }
  const get = (r, k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');

  return rows.map(r => {
    const rating = Number(get(r, 'rating')) || null; // 0 means unrated
    return {
      title: cleanTitle(get(r, 'title')),
      author: get(r, 'author'),
      isbn: cleanIsbn(get(r, 'isbn13')) || cleanIsbn(get(r, 'isbn')),
      status: SHELF_TO_STATUS[get(r, 'shelf')] || 'want',
      rating,
      pages: get(r, 'pages'),
      year: toYear(get(r, 'origYear')) || toYear(get(r, 'year')),
      notes: get(r, 'review').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
      dateRead: toDate(get(r, 'dateRead')),
      addedAt: toDate(get(r, 'dateAdded')),
      cover: '', genre: '', olKey: '',
    };
  }).filter(b => b.title);
}

// Fill in covers, genre and the Open Library work key (the same key the
// Add Book search uses, so friends' copies match). One search per 40 ISBNs,
// then an edition lookup for any covers still missing.
export async function enrichFromOpenLibrary(books, onProgress) {
  const withIsbn = books.filter(b => b.isbn);
  const BATCH = 40;
  for (let i = 0; i < withIsbn.length; i += BATCH) {
    const batch = withIsbn.slice(i, i + BATCH);
    try {
      const q = `isbn:(${batch.map(b => b.isbn).join(' OR ')})`;
      const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,isbn,cover_i,subject&limit=200`);
      const docs = (await res.json()).docs || [];
      batch.forEach(b => {
        // An ISBN can show up under a stray duplicate work; take the one with the most editions
        const doc = docs
          .filter(d => d.isbn?.includes(b.isbn))
          .sort((x, y) => (y.isbn?.length || 0) - (x.isbn?.length || 0))[0];
        if (!doc) return;
        b.olKey = doc.key || '';
        if (doc.cover_i) b.cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        if (doc.subject?.length) b.genre = inferGenre(doc.subject);
      });

      const noCover = batch.filter(b => !b.cover);
      if (noCover.length) {
        const keys = noCover.map(b => `ISBN:${b.isbn}`).join(',');
        const data = await (await fetch(`https://openlibrary.org/api/books?bibkeys=${keys}&format=json&jscmd=details`)).json();
        noCover.forEach(b => {
          const d = data[`ISBN:${b.isbn}`]?.details;
          if (d?.covers?.[0] > 0) b.cover = `https://covers.openlibrary.org/b/id/${d.covers[0]}-M.jpg`;
          if (!b.olKey && d?.works?.[0]?.key) b.olKey = d.works[0].key;
        });
      }
    } catch {
      // Covers and genres are nice-to-haves; carry on without them
    }
    onProgress?.(Math.min(i + BATCH, withIsbn.length), withIsbn.length);
  }
  return books;
}

// Goodreads stars → a starting point for Rankings (liked / fine / disliked),
// ordered by stars, then most recently read. Re-rank any of them later.
export function seedRankings(books) {
  const rated = books.filter(b => b.status === 'read' && b.rating);
  rated.sort((a, b) => (b.rating - a.rating) || ((b.dateRead || 0) - (a.dateRead || 0)));
  rated.forEach((b, i) => {
    b.sentiment = b.rating >= 4 ? 'liked' : b.rating === 3 ? 'fine' : 'disliked';
    b.rankOrder = rated.length - i;
  });
  return books;
}

export const sameBookKey = b => `${(b.title || '').trim().toLowerCase()}|${(b.author || '').trim().toLowerCase()}`;
