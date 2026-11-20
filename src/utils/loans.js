import { supabase, getCurrentUser } from './supabase';

// Loans cover both books and closet items. Each row points at exactly one of them.

async function me() {
  const user = await getCurrentUser();
  return user.id;
}

const TARGETS = 'book:books(id, title, author, cover), item:wardrobe_items(id, name, brand, image)';
const OWNER = 'owner:profiles!book_loans_owner_id_fkey(display_name, email)';
const BORROWER = 'borrower:profiles!book_loans_borrower_id_fkey(display_name, email)';

const name = p => p?.display_name || p?.email || 'a friend';

function shape(row) {
  // Normalised view of whatever is being lent, for list UIs
  let thing = null;
  if (row.book) thing = { kind: 'book', title: row.book.title, subtitle: row.book.author, image: row.book.cover };
  else if (row.item) thing = { kind: 'item', title: row.item.name, subtitle: row.item.brand, image: row.item.image };

  return {
    id: row.id,
    bookId: row.book_id,
    itemId: row.item_id,
    targetId: row.book_id || row.item_id,
    ownerId: row.owner_id,
    borrowerId: row.borrower_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    thing,
    ownerName: row.owner ? name(row.owner) : '',
    borrowerName: row.borrower ? name(row.borrower) : '',
  };
}

// ─── Borrower side ───────────────────────────────────────────────────────────

// target: { bookId } or { itemId }
export async function requestBorrow(target, ownerId) {
  const { error } = await supabase.from('book_loans').insert({
    book_id: target.bookId || null,
    item_id: target.itemId || null,
    owner_id: ownerId,
    borrower_id: await me(),
    status: 'requested',
  });
  if (error) {
    if (error.code === '23505') throw new Error('You already have a request open for this.');
    throw error;
  }
}

// Cancel a pending request or dismiss a declined one
export async function withdrawLoan(loanId) {
  const { error } = await supabase.from('book_loans').delete().eq('id', loanId);
  if (error) throw error;
}

// Open loans on a friend's things that are visible to me:
// my own requests/loans, plus anything currently checked out to someone else.
export async function getLoansForFriend(ownerId) {
  const { data, error } = await supabase
    .from('book_loans')
    .select('*')
    .eq('owner_id', ownerId)
    .in('status', ['requested', 'lent']);
  if (error) throw error;
  return (data || []).map(shape);
}

// Everything I've asked to borrow that's still relevant
export async function getMyBorrowing() {
  const { data, error } = await supabase
    .from('book_loans')
    .select(`*, ${TARGETS}, ${OWNER}`)
    .eq('borrower_id', await me())
    .not('book_id', 'is', null) // lending is books-only for now
    .in('status', ['requested', 'lent', 'declined'])
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(shape);
}

// ─── Owner side ──────────────────────────────────────────────────────────────

// Pending requests + things currently lent out
export async function getMyLending() {
  const { data, error } = await supabase
    .from('book_loans')
    .select(`*, ${TARGETS}, ${BORROWER}`)
    .eq('owner_id', await me())
    .not('book_id', 'is', null) // lending is books-only for now
    .in('status', ['requested', 'lent'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(shape);
}

// { [bookId or itemId]: borrowerName } for things I've currently lent out
export function lentToMap(lending) {
  return Object.fromEntries(lending.filter(l => l.status === 'lent').map(l => [l.targetId, l.borrowerName]));
}

// status: 'lent' | 'declined' | 'returned'
export async function respondToLoan(loanId, status) {
  const { error } = await supabase
    .from('book_loans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', loanId);
  if (error) {
    if (error.code === '23505') throw new Error("That's already lent out. Mark it returned first.");
    throw error;
  }
}
