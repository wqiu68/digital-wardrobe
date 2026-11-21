import { useState } from 'react';
import posthog from 'posthog-js';
import { addBooks, updateBook } from '../utils/books';
import { parseGoodreadsExport, enrichFromOpenLibrary, seedRankings, sameBookKey } from '../utils/goodreads';
import { isRanked } from '../utils/ranking';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';

const Step = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ ...sans, fontSize: '10px', backgroundColor: '#e6d9c6', color: INK }}>{n}</span>
    <span style={{ ...sans, fontSize: '13px', color: INK, lineHeight: 1.5 }}>{children}</span>
  </li>
);

// step: 'pick' → 'review' → 'importing' → 'done'
export default function GoodreadsImport({ existingBooks, onClose, onImported }) {
  const [step, setStep] = useState('pick');
  const [parsed, setParsed] = useState([]);
  const [rank, setRank] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState({ books: 0, years: 0 });

  const have = new Set(existingBooks.flatMap(b => [sameBookKey(b), b.isbn].filter(Boolean)));
  const isNew = b => !have.has(sameBookKey(b)) && !(b.isbn && have.has(b.isbn));
  const fresh = parsed.filter(isNew);
  const count = s => fresh.filter(b => b.status === s).length;
  const rated = fresh.filter(b => b.status === 'read' && b.rating).length;
  const alreadyRanked = existingBooks.some(isRanked);
  // Books already on the shelf that Goodreads knows the read year for
  const yearFixes = parsed.filter(b => !isNew(b) && b.status === 'read' && b.readYear).flatMap(b => {
    const mine = existingBooks.find(e => e.status === 'read' && !e.readYear && (sameBookKey(e) === sameBookKey(b) || (b.isbn && e.isbn === b.isbn)));
    return mine ? [{ ...mine, readYear: b.readYear }] : [];
  });

  async function readFile(file) {
    setError('');
    if (!file) return;
    try {
      setParsed(parseGoodreadsExport(await file.text()));
      setStep('review');
    } catch (e) {
      setError(e.message);
    }
  }

  async function runImport() {
    setStep('importing');
    setError('');
    try {
      const books = fresh.map(b => ({ ...b }));
      setProgress('Finding covers…');
      await enrichFromOpenLibrary(books, (done, total) => setProgress(`Finding covers… ${done} of ${total}`));
      // Only seed rankings into an empty ranking list, so it never scrambles one you've built
      if (rank && !alreadyRanked) seedRankings(books);
      setProgress('Putting books on your shelf…');
      if (books.length) await addBooks(books);
      if (yearFixes.length) {
        setProgress('Adding read years…');
        for (const b of yearFixes) await updateBook(b.id, b);
      }
      posthog.capture('goodreads_imported', { count: books.length, ranked: rank && !alreadyRanked });
      setAdded({ books: books.length, years: yearFixes.length });
      setStep('done');
      onImported();
    } catch (e) {
      setError(e.message?.includes('books_status_check')
        ? 'Your Want to Read shelf needs the database update first, then try again.'
        : e.message || 'Import failed.');
      setStep('review');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step === 'importing' ? undefined : onClose} />
      <div className="relative w-full sm:max-w-md shadow-2xl max-h-[95vh] overflow-y-auto" style={{ backgroundColor: '#FAF8F5' }}>
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid #e8e3de' }}>
          <h2 style={{ ...sans, fontSize: '18px', fontWeight: 400, color: INK }}>Import from Goodreads</h2>
          {step !== 'importing' && <button onClick={onClose} style={{ color: '#b0a89e', fontSize: '16px' }} className="hover:opacity-60 leading-none">✕</button>}
        </div>

        <div className="px-7 py-6">
          {step === 'pick' && (
            <>
              <ol className="space-y-3 mb-6">
                <Step n={1}>On goodreads.com, go to <b>My Books</b>, then <b>Import and export</b> (left sidebar, under Tools).</Step>
                <Step n={2}>Click <b>Export Library</b>. When the link appears, download the file.</Step>
                <Step n={3}>Choose that file below.</Step>
              </ol>
              <label
                className="flex flex-col items-center justify-center gap-1 rounded-2xl py-8 cursor-pointer transition-colors hover:bg-[#f2ebe2]"
                style={{ border: '1px dashed #d4ccc4', backgroundColor: '#f6f1ea' }}
              >
                <span style={{ ...sans, fontSize: '13px', color: INK, fontWeight: 500 }}>Choose your Goodreads file</span>
                <span style={{ ...sans, fontSize: '11px', color: MUTED }}>goodreads_library_export.csv</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => readFile(e.target.files?.[0])} />
              </label>
              <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '14px', lineHeight: 1.5 }}>
                On a phone, the export works best from a computer. Goodreads' app doesn't offer it.
              </p>
            </>
          )}

          {step === 'review' && (
            <>
              <p style={{ ...sans, fontSize: '28px', fontWeight: 300, color: INK, lineHeight: 1 }}>{fresh.length} new books</p>
              <p style={{ ...sans, fontSize: '12px', color: MUTED, marginTop: '8px' }}>
                {[count('read') && `${count('read')} read`, count('reading') && `${count('reading')} reading`, count('want') && `${count('want')} want to read`].filter(Boolean).join(' · ') || 'Nothing new to add'}
                {parsed.length > fresh.length && ` · ${parsed.length - fresh.length} already on your shelf`}
              </p>
              {yearFixes.length > 0 && (
                <p style={{ ...sans, fontSize: '12px', color: INK, marginTop: '6px' }}>
                  Also adds the year you read {yearFixes.length} {yearFixes.length === 1 ? 'book' : 'books'} already on your shelf.
                </p>
              )}

              {rated > 0 && !alreadyRanked && (
                <label className="flex items-start gap-3 mt-6 cursor-pointer">
                  <input type="checkbox" checked={rank} onChange={e => setRank(e.target.checked)} className="mt-0.5 accent-black" />
                  <span style={{ ...sans, fontSize: '13px', color: INK, lineHeight: 1.5 }}>
                    Start my Rankings from my {rated} star ratings
                    <span style={{ display: 'block', fontSize: '11px', color: MUTED }}>4–5★ liked, 3★ fine, 1–2★ didn't like. You can re-rank any book later.</span>
                  </span>
                </label>
              )}

              {error && <p style={{ ...sans, fontSize: '12px', color: '#c0392b', marginTop: '16px' }}>{error}</p>}

              <div className="flex gap-3 mt-8">
                <button
                  onClick={runImport}
                  disabled={!fresh.length && !yearFixes.length}
                  style={{ ...sans, fontSize: '13px', backgroundColor: INK, color: '#FAF8F5' }}
                  className="flex-1 rounded-full py-2.5 hover:opacity-80 disabled:opacity-30 transition-opacity"
                >
                  {fresh.length ? `Import ${fresh.length} books` : 'Add read years'}
                </button>
                <button onClick={() => { setStep('pick'); setParsed([]); }} style={{ ...sans, fontSize: '13px', color: MUTED }} className="px-4 hover:text-black">
                  Back
                </button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 w-6 h-6 rounded-full border-2 border-black/10 border-t-black/60 animate-spin" />
              <p style={{ ...sans, fontSize: '13px', color: INK }}>{progress}</p>
              <p style={{ ...sans, fontSize: '11px', color: MUTED, marginTop: '6px' }}>Keep this open, it can take a minute for big libraries.</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-6 text-center">
              <p style={{ ...sans, fontSize: '28px', fontWeight: 300, color: INK }}>{added.books ? `Added ${added.books} books` : 'All set'}</p>
              {added.years > 0 && <p style={{ ...sans, fontSize: '12px', color: MUTED, marginTop: '6px' }}>Added read years to {added.years} books</p>}
              <button onClick={onClose} style={{ ...sans, fontSize: '13px', backgroundColor: INK, color: '#FAF8F5' }} className="mt-6 rounded-full px-8 py-2.5 hover:opacity-80">
                See my shelf
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
