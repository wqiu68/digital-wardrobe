import { useState, useEffect } from 'react';
import { getBooks, getFriendBooks } from '../utils/books';
import { computeScores, bookKey } from '../utils/ranking';
import RankedList from './RankedList';

const serif = { fontFamily: "'Open Sans', system-ui, sans-serif" };
const sans  = { fontFamily: "'Open Sans', sans-serif" };

export default function FriendRankingsView({ friend }) {
  const [books, setBooks] = useState([]);
  const [myScores, setMyScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getFriendBooks(friend.userId), getBooks()])
      .then(([theirs, mine]) => {
        setBooks(theirs);
        // Map my scores by book identity so overlaps show "you: 8.2"
        const scores = computeScores(mine);
        setMyScores(Object.fromEntries(mine.filter(b => scores[b.id] != null).map(b => [bookKey(b), scores[b.id]])));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [friend.userId]);

  const name = friend.displayName || 'They';

  if (loading) return <p style={{ ...serif, fontSize: '20px', color: '#c9b99a' }}>loading rankings…</p>;

  return (
    <div className="max-w-3xl">
      {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>}
      <RankedList books={books} myScores={myScores} emptyText={`${name} hasn't ranked any books yet.`} />
    </div>
  );
}
