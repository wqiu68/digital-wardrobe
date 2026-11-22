import { useState, useEffect, useRef } from 'react';
import { HomeShapes } from './HomeArt';
import { DEFAULT_HOME } from '../utils/homes';

// The friends map as a little cul-de-sac: houses in a ring around a shared
// green, footpaths to the middle, one lane out. Everything is one SVG; houses
// further back are drawn a touch smaller and behind the ones in front.

const FONT = "'Open Sans', sans-serif";
const INK = '#1a1713';

const rad = d => (d * Math.PI) / 180;

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Where everything goes, for n lots in a wide (desktop) or tall (phone) scene
function layout(n, portrait) {
  const houseW = portrait ? 200 : 178;
  let W = portrait ? 600 : 1000;
  let H = portrait ? 900 : 650;
  let cx = W / 2;
  let cy = portrait ? 500 : 395;
  let rx = portrait ? 205 : 360;
  let ry = portrait ? 318 : 228;

  // Spread houses round the top of the ring, leaving the bottom open for the lane
  const span = n <= 1 ? 0 : Math.min(240, 64 * (n - 1));
  const arc = ((rx + ry) / 2) * rad(span);
  const need = houseW * 0.82 * (n - 1);
  const k = n > 1 && arc < need ? need / arc : 1; // lots of friends → zoom the whole village out
  W *= k; H *= k; cx *= k; cy *= k; rx *= k; ry *= k;

  const lots = Array.from({ length: n }, (_, i) => {
    const a = n <= 1 ? 90 : 90 + span / 2 - (i * span) / (n - 1);
    return { a, x: cx + rx * Math.cos(rad(a)), y: cy - ry * Math.sin(rad(a)) };
  });
  const ys = lots.map(l => l.y);
  const [lo, hi] = [Math.min(...ys), Math.max(...ys)];
  for (const l of lots) l.s = 0.86 + 0.14 * (hi > lo ? (l.y - lo) / (hi - lo) : 1);

  return { W, H, cx, cy, rx, ry, houseW, lots, court: { rx: rx * 0.5, ry: ry * 0.4 }, span };
}

function Tree({ x, y, s = 1, tone = 0 }) {
  const greens = [['#8fae7e', '#9dbb8b', '#86a676'], ['#7fa37a', '#93b88a', '#6f9468'], ['#a3bd8a', '#b3c99b', '#94b07c']][tone % 3];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="20" ry="5" fill="#000" opacity=".07" />
      <rect x="-3.5" y="-30" width="7" height="32" rx="2" fill="#7a5a44" />
      <circle cx="0" cy="-44" r="21" fill={greens[0]} />
      <circle cx="-13" cy="-32" r="13" fill={greens[1]} />
      <circle cx="13" cy="-33" r="14" fill={greens[2]} />
    </g>
  );
}

const Bush = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="16" ry="10" fill="#9dbb8b" />
    <ellipse cx="-9" cy="2" rx="9" ry="7" fill="#8fae7e" />
    <circle cx="6" cy="-4" r="2" fill="#e58f9b" /><circle cx="-4" cy="-2" r="2" fill="#f0c75e" />
  </g>
);

// The shared green in the middle: a big tree, flowers and a bench
function Green({ cx, cy, rx, ry }) {
  const flowers = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return { x: cx + rx * 0.82 * Math.cos(a), y: cy + ry * 0.8 * Math.sin(a), c: ['#e58f9b', '#f0c75e', '#b79ad6', '#f29e7a'][i % 4] };
  });
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#b9cda6" stroke="#a9bf95" strokeWidth="3" />
      {flowers.map((f, i) => <circle key={i} cx={f.x} cy={f.y} r="3.4" fill={f.c} />)}
      {/* bench */}
      <g transform={`translate(${cx - rx * 0.45} ${cy + ry * 0.25})`}>
        <rect x="-18" y="-10" width="36" height="5" rx="1.5" fill="#a77b58" />
        <rect x="-18" y="-3" width="36" height="5" rx="1.5" fill="#b98c68" />
        <rect x="-15" y="2" width="3" height="7" fill="#6b4a3a" /><rect x="12" y="2" width="3" height="7" fill="#6b4a3a" />
      </g>
      <Tree x={cx} y={cy + 6} s={1.5} tone={1} />
    </g>
  );
}

function ForSale() {
  return (
    <g>
      <rect x="97" y="108" width="5" height="58" fill="#8a6a52" />
      <rect x="58" y="90" width="84" height="42" rx="5" fill="#fffaf2" stroke="#d9cdbb" strokeWidth="1.5" />
      <text x="100" y="108" textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>LOT FOR</text>
      <text x="100" y="123" textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>A FRIEND</text>
      <ellipse cx="60" cy="160" rx="22" ry="5" fill="#cddabc" />
      <ellipse cx="148" cy="158" rx="26" ry="6" fill="#cddabc" />
    </g>
  );
}

function Label({ x, y, f, name, sub, dark }) {
  const short = name.length > 16 ? name.slice(0, 15) + '…' : name;
  const w = short.length * f * 0.62 + f * 1.8;
  const subShort = sub && (sub.length > 24 ? sub.slice(0, 23) + '…' : sub);
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={y} width={w} height={f * 1.75} rx={f * 0.875} fill={dark ? INK : '#fffaf2'} stroke={dark ? 'none' : '#e5dccd'} />
      <text x={x} y={y + f * 1.22} textAnchor="middle" fontFamily={FONT} fontSize={f} fontWeight="600" fill={dark ? '#FAF8F5' : INK}>{short}</text>
      {subShort && dark && (
        <g>
          <rect x={x - (subShort.length * f * 0.55 + f * 1.4) / 2} y={y + f * 2.05} width={subShort.length * f * 0.55 + f * 1.4} height={f * 1.65} rx={f * 0.78} fill="#fffaf2" stroke={INK} strokeWidth="1.2" />
          <text x={x} y={y + f * 3.2} textAnchor="middle" fontFamily={FONT} fontSize={f * 0.88} fontWeight="600" fill={INK}>{subShort}</text>
        </g>
      )}
      {subShort && !dark && (
        <text x={x} y={y + f * 2.95} textAnchor="middle" fontFamily={FONT} fontSize={f * 0.82} fill="#5f6a52">{subShort}</text>
      )}
    </g>
  );
}

// lots: [{ id, seed, name, sub, home, you?, invite?, onClick }]
export default function Village({ lots }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const portrait = width > 0 && width < 640;
  const L = layout(lots.length, portrait);
  const f = width ? Math.max(11, Math.min(13, width / 70)) * (L.W / width) : 13; // label size in scene units
  const { cx, cy, court } = L;

  const placed = lots.map((lot, i) => ({ ...lot, ...L.lots[i] }));
  const order = [...placed].sort((a, b) => a.y - b.y);

  // Trees tucked behind and between houses, plus a few in the corners
  const between = placed.slice(1).map((p, i) => {
    const a = (p.a + placed[i].a) / 2;
    return { x: cx + L.rx * 1.12 * Math.cos(rad(a)), y: cy - L.ry * 1.12 * Math.sin(rad(a)) - 30, s: 0.9, tone: i };
  });
  const corners = [
    { x: L.W * 0.06, y: L.H * 0.16, s: 1.1, tone: 0 },
    { x: L.W * 0.95, y: L.H * 0.13, s: 1, tone: 2 },
    { x: L.W * 0.08, y: L.H * 0.97, s: 1.2, tone: 1 },
    { x: L.W * 0.93, y: L.H * 0.98, s: 1.1, tone: 0 },
  ];
  const laneW = L.houseW * 0.42;
  const courtBottom = cy + court.ry;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg viewBox={`0 0 ${L.W} ${L.H}`} className="block w-full h-auto" role="group" aria-label="Your village">
          <defs>
            <radialGradient id="vg-grass" cx="50%" cy="55%" r="70%">
              <stop offset="0" stopColor="#e9efdd" />
              <stop offset="1" stopColor="#dbe4cc" />
            </radialGradient>
          </defs>
          <rect width={L.W} height={L.H} fill="url(#vg-grass)" />

          {/* lane out of the cul-de-sac */}
          <path d={`M${cx - laneW / 2} ${courtBottom - 20} L${cx - laneW * 0.7} ${L.H} L${cx + laneW * 0.7} ${L.H} L${cx + laneW / 2} ${courtBottom - 20}Z`} fill="#e7dfd1" />
          <path d={`M${cx} ${courtBottom + 10} L${cx} ${L.H}`} stroke="#f7f2ea" strokeWidth="3" strokeDasharray="14 12" />

          {/* footpaths from each front door to the circle */}
          {placed.map(p => {
            const ex = cx + court.rx * 1.42 * Math.cos(rad(p.a));
            const ey = cy - court.ry * 1.42 * Math.sin(rad(p.a));
            const mx = (p.x + ex) / 2;
            return <path key={`p-${p.id}`} d={`M${p.x} ${p.y + 4} Q${mx} ${p.y + 30} ${ex} ${ey}`} stroke="#ece4d6" strokeWidth={L.houseW * 0.09} strokeLinecap="round" fill="none" />;
          })}

          {/* the circle (road ring) and the green */}
          <ellipse cx={cx} cy={cy} rx={court.rx * 1.45} ry={court.ry * 1.45} fill="#e7dfd1" />
          <ellipse cx={cx} cy={cy} rx={court.rx * 1.22} ry={court.ry * 1.22} fill="none" stroke="#f7f2ea" strokeWidth="3" strokeDasharray="14 12" />
          <Green cx={cx} cy={cy} rx={court.rx} ry={court.ry} />

          {between.map((t, i) => <Tree key={`bt-${i}`} {...t} />)}
          {corners.map((t, i) => <Tree key={`ct-${i}`} {...t} />)}
          <Bush x={L.W * 0.17} y={L.H * 0.95} />
          <Bush x={L.W * 0.82} y={L.H * 0.93} s={1.2} />

          {order.map(p => {
            const w = L.houseW * p.s;
            const h = (w * 170) / 200;
            const hovering = hover === p.id;
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={p.you ? 'Your home' : p.invite ? 'Invite a friend' : `${p.name}'s home`}
                onClick={p.onClick}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onClick(); } }}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.id)}
                onBlur={() => setHover(null)}
                className="homey-lot cursor-pointer focus:outline-none"
              >
                <ellipse cx={p.x} cy={p.y - h * 0.06} rx={w * 0.52} ry={h * 0.16} fill={hovering ? '#cfdcbd' : '#d5e0c5'} />
                <svg x={p.x - w / 2} y={p.y - h * (165 / 170)} width={w} height={h} viewBox="0 0 200 170" overflow="visible">
                  {p.invite ? <ForSale /> : <HomeShapes home={p.home || DEFAULT_HOME} seed={p.seed} waving={hovering} />}
                </svg>
                <Label x={p.x} y={p.y + 8} f={f} name={p.name} sub={p.sub} dark={p.you} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

