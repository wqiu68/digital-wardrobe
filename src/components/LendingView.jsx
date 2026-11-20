import { useState, useEffect } from 'react';
import { respondToLoan, withdrawLoan, getMyBorrowing } from '../utils/loans';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

const primaryBtn = { ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', backgroundColor: '#1a1713', color: '#FAF8F5' };
const ghostBtn   = { ...sans, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b0a89e', border: '1px solid #e8e3de' };

function since(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Section({ title, count, children }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-4">
        <h3 style={{ ...serif, fontSize: '18px', fontWeight: 400, color: '#1a1713' }}>{title}</h3>
        {count > 0 && <span style={{ ...sans, fontSize: '11px', color: '#b0a89e' }}>{count}</span>}
        <div className="flex-1 h-px" style={{ backgroundColor: '#e8e3de' }} />
      </div>
      <div className="flex flex-col" style={{ borderTop: '1px solid #f0ebe3' }}>{children}</div>
    </div>
  );
}

function LoanRow({ loan, line, children }) {
  const b = loan.thing || {};
  return (
    <div className="flex items-center gap-4 py-3 flex-wrap sm:flex-nowrap" style={{ borderBottom: '1px solid #f0ebe3' }}>
      <div className="w-10 shrink-0 overflow-hidden" style={{ height: '60px', backgroundColor: '#ece5dc' }}>
        {b.image && <img src={b.image} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ ...sans, fontSize: '13px', color: '#1a1713', fontWeight: 500 }} className="truncate">
          {b.title || 'Untitled'}
          <span style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c9b99a', fontWeight: 400, marginLeft: '8px' }}>
            {b.kind === 'item' ? 'closet' : 'book'}
          </span>
        </p>
        <p style={{ ...sans, fontSize: '11px', color: '#a09890' }}>{line}</p>
      </div>
      <div className="flex gap-2 shrink-0">{children}</div>
    </div>
  );
}

function Empty({ children }) {
  return <p style={{ ...serif, fontSize: '16px', color: '#c9b99a', padding: '12px 0' }}>{children}</p>;
}

export default function LendingView({ lending, onLendingChange }) {
  const [borrowing, setBorrowing] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function loadBorrowing() {
    try {
      setBorrowing(await getMyBorrowing());
    } catch (e) {
      setError(e.message || 'Could not load borrowing.');
    }
  }

  useEffect(() => { loadBorrowing(); onLendingChange(); }, []);

  async function act(id, fn) {
    setBusy(id);
    setError('');
    try {
      await fn();
      await Promise.all([onLendingChange(), loadBorrowing()]);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  }

  const requests = lending.filter(l => l.status === 'requested');
  const lentOut  = lending.filter(l => l.status === 'lent');
  const lentIds = new Set(lentOut.map(l => l.targetId));

  return (
    <div className="max-w-2xl">
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}

      <Section title="Requests from friends" count={requests.length}>
        {requests.length === 0 ? <Empty>No one has asked to borrow anything yet.</Empty> : requests.map(l => (
          <LoanRow key={l.id} loan={l} line={`${l.borrowerName} wants to borrow this · ${since(l.createdAt)}`}>
            <button
              disabled={busy === l.id || lentIds.has(l.targetId)}
              title={lentIds.has(l.targetId) ? 'Currently lent out. Mark it returned first.' : undefined}
              onClick={() => act(l.id, () => respondToLoan(l.id, 'lent'))}
              style={primaryBtn} className="px-4 py-1.5 hover:opacity-80 transition-opacity disabled:opacity-30"
            >
              Lend
            </button>
            <button
              disabled={busy === l.id}
              onClick={() => act(l.id, () => respondToLoan(l.id, 'declined'))}
              style={ghostBtn} className="px-4 py-1.5 hover:opacity-70 transition-opacity disabled:opacity-30"
            >
              Decline
            </button>
          </LoanRow>
        ))}
      </Section>

      <Section title="Lent out" count={lentOut.length}>
        {lentOut.length === 0 ? <Empty>Everything's at home.</Empty> : lentOut.map(l => (
          <LoanRow key={l.id} loan={l} line={`With ${l.borrowerName} since ${since(l.updatedAt)}`}>
            <button
              disabled={busy === l.id}
              onClick={() => act(l.id, () => respondToLoan(l.id, 'returned'))}
              style={ghostBtn} className="px-4 py-1.5 hover:opacity-70 transition-opacity disabled:opacity-30"
            >
              Mark Returned
            </button>
          </LoanRow>
        ))}
      </Section>

      <Section title="Borrowing from friends" count={borrowing.length}>
        {borrowing.length === 0 ? <Empty>Browse a friend's closet or bookshelf to request something.</Empty> : borrowing.map(l => {
          if (l.status === 'lent') {
            return <LoanRow key={l.id} loan={l} line={`Borrowed from ${l.ownerName} · since ${since(l.updatedAt)}`} />;
          }
          const declined = l.status === 'declined';
          return (
            <LoanRow key={l.id} loan={l} line={declined ? `${l.ownerName} can't lend this right now` : `Requested from ${l.ownerName} · waiting`}>
              <button
                disabled={busy === l.id}
                onClick={() => act(l.id, () => withdrawLoan(l.id))}
                style={ghostBtn} className="px-4 py-1.5 hover:opacity-70 transition-opacity disabled:opacity-30"
              >
                {declined ? 'Dismiss' : 'Cancel'}
              </button>
            </LoanRow>
          );
        })}
      </Section>
    </div>
  );
}
