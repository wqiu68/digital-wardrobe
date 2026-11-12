// Beli-style book ranking: pick a sentiment, then binary-search comparisons
// within that sentiment group decide the exact position. Scores (0–10) are
// derived from position, so they shift as more books are ranked.

export const GENRES = [
  'Literary Fiction', 'Classics', 'Mystery & Thriller', 'Fantasy', 'Science Fiction',
  'Romance', 'Historical Fiction', 'Horror', 'Young Adult', 'Graphic Novels',
  'Poetry', 'Memoir & Biography', 'Self-Help', 'Nonfiction',
];

export const SENTIMENTS = [
  { id: 'liked',    label: 'I liked it',        range: [6.7, 10],  color: '#4f7d58' },
  { id: 'fine',     label: 'It was fine',       range: [3.4, 6.6], color: '#b58a2e' },
  { id: 'disliked', label: "I didn't like it",  range: [0, 3.3],   color: '#a8513d' },
];
const SENTIMENT_ORDER = { liked: 0, fine: 1, disliked: 2 };

export function scoreColor(score) {
  if (score >= 6.7) return SENTIMENTS[0].color;
  if (score >= 3.4) return SENTIMENTS[1].color;
  return SENTIMENTS[2].color;
}

// ─── Genre guess from Open Library subjects ──────────────────────────────────
// Subjects are noisy ("murder" shows up on fantasy novels), so count matches
// per genre and take the strongest.
const GENRE_KEYWORDS = {
  'Graphic Novels':     ['graphic novel', 'comic', 'manga'],
  'Poetry':             ['poetry', 'poems', 'verse'],
  'Memoir & Biography': ['biography', 'autobiography', 'memoir', 'personal memoirs'],
  'Fantasy':            ['fantasy', 'magic', 'wizard', 'dragons', 'imaginary places'],
  'Science Fiction':    ['science fiction', 'dystopia', 'space', 'robots', 'time travel', 'aliens'],
  'Horror':             ['horror', 'ghost', 'haunted', 'vampire', 'zombie'],
  'Mystery & Thriller': ['mystery', 'detective', 'thriller', 'suspense', 'crime', 'murder'],
  'Romance':            ['romance', 'love stories', 'romantic'],
  'Historical Fiction': ['historical fiction', 'history fiction', 'fiction, historical'],
  'Young Adult':        ['young adult', 'juvenile fiction', 'teen'],
  'Classics':           ['classic literature', 'classics'],
  'Self-Help':          ['self-help', 'self help', 'personal development', 'success', 'habits'],
  // Last, so a tie goes to the more specific genre
  'Nonfiction':         ['history', 'science', 'politics', 'economics', 'philosophy', 'essays', 'psychology', 'sociology', 'business', 'nonfiction', 'civilization', 'anthropology'],
};
export function inferGenre(subjects = []) {
  const subs = subjects.slice(0, 40).map(s => String(s).toLowerCase());
  let best = '', bestScore = 0;
  for (const [genre, words] of Object.entries(GENRE_KEYWORDS)) {
    // Nonfiction hints ("science", "history") also appear inside fiction subjects,
    // so ignore those and weight nonfiction lower than the specific genres
    const pool = genre === 'Nonfiction' ? subs.filter(s => !s.includes('fiction')) : subs;
    const weight = genre === 'Nonfiction' ? 0.5 : 1;
    const score = pool.filter(s => words.some(w => s.includes(w))).length * weight;
    if (score > bestScore) { best = genre; bestScore = score; }
  }
  if (best) return best;
  if (subs.some(s => s.includes('fiction'))) return 'Literary Fiction';
  return '';
}

// ─── Ordering & scores ───────────────────────────────────────────────────────

export function isRanked(book) {
  return !!book.sentiment && book.rankOrder != null;
}

// Best → worst: by sentiment group, then rank_order (higher first)
export function sortRanked(books) {
  return books
    .filter(isRanked)
    .sort((a, b) => (SENTIMENT_ORDER[a.sentiment] - SENTIMENT_ORDER[b.sentiment]) || (b.rankOrder - a.rankOrder));
}

// One sentiment group, best → worst
export function bucket(books, sentiment, excludeId) {
  return sortRanked(books).filter(b => b.sentiment === sentiment && b.id !== excludeId);
}

// { bookId: score } — evenly spread through each sentiment's range by position
export function computeScores(books) {
  const scores = {};
  for (const s of SENTIMENTS) {
    const group = bucket(books, s.id);
    const [lo, hi] = s.range;
    group.forEach((b, i) => {
      scores[b.id] = Math.round((hi - (hi - lo) * (i + 0.5) / group.length) * 10) / 10;
    });
  }
  return scores;
}

// rank_order for a book inserted at `index` in a best→worst group
export function orderAt(group, index) {
  const above = group[index - 1]?.rankOrder; // better neighbour (higher)
  const below = group[index]?.rankOrder;     // worse neighbour (lower)
  if (above != null && below != null) return (above + below) / 2;
  if (above != null) return above - 1;
  if (below != null) return below + 1;
  return 0;
}

// Key for matching the same book across two people's shelves
export function bookKey(b) {
  return b.olKey || `${(b.title || '').trim().toLowerCase()}|${(b.author || '').trim().toLowerCase()}`;
}
