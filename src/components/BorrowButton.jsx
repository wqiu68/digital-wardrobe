const sans = { fontFamily: "'Inter', sans-serif" };

const btnBase = { ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', width: '100%', padding: '7px 4px', marginTop: '8px' };

// Shows the right borrow state for one of a friend's books or closet items.
//   loans: open loans visible to me for this thing; myId: current user id
export default function BorrowButton({ loans, myId, busy, onRequest, onCancel }) {
  const myLoan = loans.find(l => l.borrowerId === myId);
  const checkedOut = loans.some(l => l.status === 'lent' && l.borrowerId !== myId);

  if (myLoan?.status === 'lent') {
    return <div style={{ ...btnBase, color: '#7a9e7e', border: '1px solid #cfe0d0', textAlign: 'center' }}>You're borrowing this</div>;
  }
  if (myLoan?.status === 'requested') {
    return (
      <button
        onClick={() => onCancel(myLoan)} disabled={busy}
        style={{ ...btnBase, color: '#a09890', border: '1px solid #e0d9d2' }}
        className="group/req hover:border-black/30 transition-colors disabled:opacity-40"
      >
        <span className="group-hover/req:hidden">Requested ✓</span>
        <span className="hidden group-hover/req:inline">Cancel request</span>
      </button>
    );
  }
  if (checkedOut) {
    return <div style={{ ...btnBase, color: '#c9b99a', border: '1px dashed #e0d9d2', textAlign: 'center' }}>Checked out</div>;
  }
  return (
    <button
      onClick={onRequest} disabled={busy}
      style={{ ...btnBase, backgroundColor: '#1a1713', color: '#FAF8F5' }}
      className="hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      Request to borrow
    </button>
  );
}

// Strip across the bottom of an owner's card when it's lent out
export function LentTag({ name }) {
  if (!name) return null;
  return (
    <div
      className="absolute bottom-0 inset-x-0 px-2 py-1.5 truncate pointer-events-none"
      style={{ ...sans, fontSize: '10px', letterSpacing: '0.05em', backgroundColor: 'rgba(26,23,19,0.78)', color: '#FAF8F5' }}
    >
      Lent to {name}
    </div>
  );
}
