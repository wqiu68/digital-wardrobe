import { useState, useRef, useEffect } from 'react';
import posthog from 'posthog-js';
import { ask } from '../utils/assistant';

const sans = { fontFamily: "'Open Sans', sans-serif" };
const INK = '#1a1713';
const MUTED = '#a09890';
const CREAM = '#FAF8F5';

const SUGGESTIONS = {
  closet: ['Add a black wool coat from Everlane', 'Add white sneakers, size 8', 'Paste a product link to add it'],
  books: ['Add Tomorrow, and Tomorrow, and Tomorrow to want to read', "I just finished Circe, 5 stars", "What's on my Currently Reading?"],
  any: ['I read and went for a walk today', 'Add Dune to my want to read', 'Add a navy linen shirt to my closet'],
};

const Sparkle = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 2.5c.4 4.6 2.9 7.1 7.5 7.5-4.6.4-7.1 2.9-7.5 7.5-.4-4.6-2.9-7.1-7.5-7.5 4.6-.4 7.1-2.9 7.5-7.5Z" />
    <path d="M19 15.5c.2 2 1.1 2.9 3 3-1.9.1-2.8 1-3 3-.2-2-1.1-2.9-3-3 1.9-.1 2.8-1 3-3Z" opacity=".6" />
  </svg>
);

// A floating "Ask homey" button that opens a chat for adding and changing things by typing.
// `space` ('closet' | 'books' | 'any') picks the example prompts.
export default function AssistantPanel({ space = 'any', onChanged }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState([]); // { role: 'user' | 'assistant' | 'action' | 'error', text }
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [lines, busy]);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
  }, [open]);

  async function send(text) {
    const msg = text.trim();
    if (!msg || busy) return;
    setDraft('');
    setBusy(true);
    setLines(l => [...l, { role: 'user', text: msg }]);
    try {
      const out = await ask(history, msg, e => setLines(l => [...l, { role: 'action', text: e.text }]));
      setHistory(out.history);
      setLines(l => [...l, { role: 'assistant', text: out.reply }]);
      if (out.changed.size) onChanged?.([...out.changed]);
      posthog.capture('assistant_used', { changed: [...out.changed] });
    } catch (e) {
      setLines(l => [...l, { role: 'error', text: e.message }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  function reset() {
    setLines([]);
    setHistory([]);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask homey"
        className="fixed z-30 right-5 flex items-center gap-2 rounded-full pl-3.5 pr-4 py-2.5 shadow-lg hover:opacity-90 transition-opacity"
        style={{ ...sans, bottom: 'calc(20px + env(safe-area-inset-bottom))', backgroundColor: INK, color: CREAM, fontSize: '13px' }}
      >
        <Sparkle size={16} />
        Ask homey
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 sm:hidden" onClick={() => setOpen(false)} />
      <section
        className="fixed z-40 inset-x-0 bottom-0 h-[78vh] rounded-t-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[560px] sm:max-h-[calc(100vh-40px)] sm:w-[380px] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ backgroundColor: CREAM, border: '1px solid #e8e3de' }}
        aria-label="Ask homey"
      >
        <header className="flex items-center gap-2 px-5 h-14 shrink-0" style={{ borderBottom: '1px solid #e8e3de' }}>
          <Sparkle size={16} color={INK} />
          <h2 style={{ ...sans, fontSize: '15px', fontWeight: 500, color: INK }}>Ask homey</h2>
          {lines.length > 0 && (
            <button onClick={reset} disabled={busy} style={{ ...sans, fontSize: '12px', color: MUTED }} className="ml-auto hover:text-black disabled:opacity-40">
              New chat
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: '#b0a89e', fontSize: '16px' }} className={`${lines.length ? 'ml-4' : 'ml-auto'} hover:opacity-60 leading-none`}>✕</button>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {lines.length === 0 && (
            <div>
              <p style={{ ...sans, fontSize: '13px', color: INK, lineHeight: 1.55 }}>
                Tell me what to add or change and I'll do it. Books, clothes, habits, or a product link.
              </p>
              <div className="mt-4 flex flex-col items-start gap-2">
                {SUGGESTIONS[space].map(s => (
                  <button
                    key={s}
                    onClick={() => (s.startsWith('Paste') ? input.current?.focus() : send(s))}
                    style={{ ...sans, fontSize: '12px', color: INK, backgroundColor: '#f6f1ea', border: '1px solid #ece4d8' }}
                    className="rounded-full px-3.5 py-1.5 text-left hover:bg-[#efe7dc] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lines.map((l, i) => {
            if (l.role === 'user') {
              return (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 whitespace-pre-wrap break-words" style={{ ...sans, fontSize: '13px', backgroundColor: INK, color: CREAM, lineHeight: 1.5 }}>{l.text}</p>
                </div>
              );
            }
            if (l.role === 'action') {
              return (
                <p key={i} className="flex items-center gap-2" style={{ ...sans, fontSize: '12px', color: '#5f7d5a' }}>
                  <span aria-hidden="true">✓</span>{l.text}
                </p>
              );
            }
            return (
              <p key={i} className="max-w-[90%] whitespace-pre-wrap break-words" style={{ ...sans, fontSize: '13px', color: l.role === 'error' ? '#c0392b' : INK, lineHeight: 1.55 }}>{l.text}</p>
            );
          })}

          {busy && (
            <div className="flex gap-1 py-1" aria-label="Working">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: MUTED, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); send(draft); }}
          className="shrink-0 flex items-end gap-2 px-4 pt-3"
          style={{ borderTop: '1px solid #e8e3de', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
        >
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
            placeholder="Add Dune to want to read…"
            maxLength={2000}
            style={{ ...sans, fontSize: '13px', color: INK, maxHeight: '120px' }}
            className="flex-1 resize-none bg-white rounded-2xl px-3.5 py-2 border border-[#e0d9d2] focus:outline-none focus:border-black/40 placeholder:text-black/30"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 disabled:opacity-25 transition-opacity"
            style={{ backgroundColor: INK, color: CREAM }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
      </section>
    </>
  );
}
