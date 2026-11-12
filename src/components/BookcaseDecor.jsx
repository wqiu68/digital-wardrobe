// Library furniture: walnut bookcase, brass nameplate, wooden shelves, cloth-bound books.

const serif = { fontFamily: "'Cormorant Garamond', Georgia, serif" };
const sans  = { fontFamily: "'Inter', sans-serif" };

export const BOOKCASE_GRID = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-7';

// Text colours for use on the dark bookcase interior
export const ON_WOOD = { title: '#f1e6d2', sub: '#b99d7c', faint: '#8c735a', starOn: '#e2bd6b', starOff: '#5b4536' };

// Library cloth bindings for books without a cover
const CLOTH = ['#6b2a2a', '#2f4a3a', '#283a55', '#7a5a22', '#4a2f4f', '#3d3a36', '#5d3b26', '#2d4f55'];

// FNV-1a: spreads similar strings across colours/sizes evenly
function hash(str = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// Brass plate fixed to the top of the bookcase
function Nameplate({ title, count }) {
  return (
    <div className="flex justify-center -mt-[40px] mb-6 relative z-10">
      <div
        className="px-6 py-1.5 text-center"
        style={{
          background: 'linear-gradient(180deg, #f0d99a 0%, #c9a24f 55%, #a7813a 100%)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.45)',
          borderRadius: '2px',
        }}
      >
        <span style={{ ...serif, fontSize: '15px', fontStyle: 'italic', color: '#3a2a12', letterSpacing: '0.02em' }}>{title}</span>
        {count != null && (
          <span style={{ ...sans, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5a4320', marginLeft: '10px' }}>
            {count} {count === 1 ? 'vol.' : 'vols.'}
          </span>
        )}
      </div>
    </div>
  );
}

// The walnut cabinet that holds a section of books
export function Bookcase({ title, count, children }) {
  return (
    <div className="mb-14 mt-6">
      <div
        className="relative px-5 sm:px-7 pt-6 pb-8"
        style={{
          backgroundColor: '#2f2119',
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 9px), linear-gradient(180deg, #34251b 0%, #2a1d15 100%)',
          border: '12px solid #5a3a26',
          borderTopWidth: '18px',
          boxShadow: 'inset 0 12px 24px -8px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.35), 0 4px 12px rgba(40,25,15,0.25)',
        }}
      >
        {title && <Nameplate title={title} count={count} />}
        {children}
      </div>
    </div>
  );
}

// Cloth binding with gold-foil lettering
function ClothBinding({ book }) {
  const color = CLOTH[hash(book.title) % CLOTH.length];
  return (
    <div className="w-full h-full flex flex-col items-center justify-between py-4 px-2 text-center" style={{ backgroundColor: color, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px)' }}>
      <div className="w-3/4 h-px" style={{ backgroundColor: 'rgba(226,189,107,0.6)' }} />
      <p style={{ ...serif, fontSize: '14px', fontStyle: 'italic', color: '#e8c97e', lineHeight: 1.15 }} className="line-clamp-5">{book.title}</p>
      <div className="flex flex-col items-center gap-2 w-full">
        {book.author && <p style={{ ...sans, fontSize: '8px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(232,201,126,0.75)' }} className="line-clamp-2">{book.author}</p>}
        <div className="w-3/4 h-px" style={{ backgroundColor: 'rgba(226,189,107,0.6)' }} />
      </div>
    </div>
  );
}

// Library checkout card peeking out of the top of a lent book
function CheckoutSlip({ name }) {
  return (
    <div
      className="absolute -top-[14px] right-[12%] z-20 px-1.5 pt-1 pb-3 pointer-events-none"
      style={{ backgroundColor: '#f4ecd8', boxShadow: '0 1px 3px rgba(0,0,0,0.4)', maxWidth: '70%', transform: 'rotate(2deg)' }}
    >
      <p style={{ ...sans, fontSize: '7px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#9a3b2f', fontWeight: 600 }}>Out</p>
      <p style={{ ...serif, fontSize: '11px', fontStyle: 'italic', color: '#3a2d22', lineHeight: 1.1 }} className="truncate">{name}</p>
    </div>
  );
}

// A book standing on a shelf. `overlay` renders inside the book (hover controls);
// `children` render under the shelf (title, author, etc.).
export function ShelvedBook({ book, lentTo, dim, overlay, children }) {
  const h = hash(book.id || book.title);
  const height = 90 + (h % 11);       // 90–100% so the row looks hand-shelved
  const width = 88 + ((h >> 4) % 13); // 88–100%

  return (
    <div className="relative">
      {/* Book */}
      <div className="aspect-[2/3] w-full flex items-end justify-center">
        <div
          className="relative transition-transform duration-300 group-hover:-translate-y-1.5"
          style={{
            height: `${height}%`, width: `${width}%`,
            boxShadow: '3px 0 6px rgba(0,0,0,0.45), -1px 0 2px rgba(0,0,0,0.3)',
            opacity: dim ? 0.5 : 1,
          }}
        >
          <div className="w-full h-full overflow-hidden">
            {book.cover ? <img src={book.cover} alt={book.title} className="w-full h-full object-cover" loading="lazy" /> : <ClothBinding book={book} />}
          </div>
          {/* Spine crease + page edge */}
          <div className="absolute inset-y-0 left-0 w-[7%] pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(255,255,255,0.12) 60%, transparent)' }} />
          <div className="absolute inset-y-[2px] right-0 w-[2px] pointer-events-none" style={{ background: 'rgba(240,230,210,0.5)' }} />
          {lentTo && <CheckoutSlip name={lentTo} />}
          {overlay}
        </div>
      </div>
      {/* Shelf plank; extends half the grid gap so neighbours join into one board */}
      <div
        className="relative mx-[-8px] h-[12px]"
        style={{
          background: 'linear-gradient(180deg, #a0704a 0%, #7d5233 55%, #5e3b22 100%)',
          boxShadow: '0 6px 8px -3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,220,180,0.25)',
        }}
      />
      <div className="pt-3">{children}</div>
    </div>
  );
}
