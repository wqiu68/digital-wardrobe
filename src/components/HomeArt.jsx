import { useId } from 'react';
import { PAINTS } from '../utils/homes';
import { lookFor } from '../utils/look';

// Drawn houses for the neighborhood map. Everything is plain SVG in a
// 200 × 170 box: the house sits on the ground line (y = 145), the yard is below.

const ROOF = { 1: '#9b6a52', 2: '#8a5a44', 3: '#7a4f3d', 4: '#5e4034' };
const TRIM = '#fffaf2';
const WINDOW = '#fbe7a6';
const DOOR = '#6b4a3a';

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = s => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
};

function Win({ x, y, w = 14, h = 14 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill={WINDOW} stroke={TRIM} strokeWidth="2" />
      <path d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`} stroke={TRIM} strokeWidth="1.2" />
    </g>
  );
}

function Door({ x, y = 120 }) {
  return (
    <g>
      <rect x={x} y={y} width="16" height={145 - y} rx="1.5" fill={DOOR} />
      <circle cx={x + 12} cy={y + 14} r="1.2" fill={WINDOW} />
    </g>
  );
}

function House({ level, wall }) {
  const side = shade(wall, -18);
  const roof = ROOF[level];
  if (level === 1) {
    return (
      <g>
        <rect x="66" y="96" width="68" height="49" fill={wall} />
        <path d="M58 98 100 62l42 36z" fill={roof} />
        <Win x="75" y="108" />
        <Door x="104" y="118" />
      </g>
    );
  }
  if (level === 2) {
    return (
      <g>
        <rect x="112" y="72" width="10" height="20" fill={shade(roof, -10)} />
        <rect x="48" y="94" width="104" height="51" fill={wall} />
        <path d="M40 96 100 60l60 36z" fill={roof} />
        <Win x="58" y="106" w="18" />
        <Win x="124" y="106" w="18" />
        <Door x="92" y="116" />
        <rect x="86" y="143" width="28" height="3" fill={side} />
      </g>
    );
  }
  if (level === 3) {
    return (
      <g>
        <rect x="118" y="36" width="10" height="20" fill={shade(roof, -10)} />
        <rect x="58" y="62" width="84" height="83" fill={wall} />
        <rect x="58" y="102" width="84" height="3" fill={side} />
        <path d="M50 64 100 28l50 36z" fill={roof} />
        <Win x="68" y="74" w="16" h="16" />
        <Win x="116" y="74" w="16" h="16" />
        <Win x="68" y="114" w="16" h="16" />
        <Win x="116" y="114" w="16" h="16" />
        <Door x="92" y="116" />
        <path d="M86 116h28l-4-6H90z" fill={roof} />
      </g>
    );
  }
  return (
    <g>
      {/* wings */}
      <rect x="16" y="98" width="44" height="47" fill={side} />
      <path d="M10 100 38 80l28 20z" fill={roof} />
      <rect x="140" y="98" width="44" height="47" fill={side} />
      <path d="M134 100 162 80l28 20z" fill={roof} />
      <Win x="28" y="110" w="18" />
      <Win x="154" y="110" w="18" />
      {/* main */}
      <rect x="122" y="26" width="10" height="22" fill={shade(roof, -10)} />
      <rect x="56" y="56" width="88" height="89" fill={wall} />
      <rect x="56" y="100" width="88" height="3" fill={side} />
      <path d="M48 58 100 20l52 38z" fill={roof} />
      <circle cx="100" cy="44" r="6" fill={WINDOW} stroke={TRIM} strokeWidth="2" />
      <Win x="66" y="68" w="16" h="18" />
      <Win x="118" y="68" w="16" h="18" />
      <Win x="66" y="112" w="16" h="18" />
      <Win x="118" y="112" w="16" h="18" />
      <rect x="88" y="112" width="24" height="33" rx="12" fill={DOOR} />
      <path d="M100 112v33" stroke={shade(DOOR, -15)} strokeWidth="1" />
      <rect x="84" y="143" width="32" height="3" fill={TRIM} />
    </g>
  );
}

const Tree = () => (
  <g>
    <rect x="17" y="112" width="6" height="36" fill="#7a5a44" />
    <circle cx="20" cy="104" r="16" fill="#8fae7e" />
    <circle cx="11" cy="114" r="10" fill="#9dbb8b" />
    <circle cx="29" cy="113" r="11" fill="#86a676" />
  </g>
);

const Flowers = ({ level }) => {
  const [a, b] = level === 4 ? [58, 142] : level === 2 ? [50, 150] : level === 3 ? [60, 140] : [68, 132];
  const spots = [];
  for (let x = a + 3; x < b - 2; x += 7) if (x < 86 || x > 118) spots.push(x);
  const colors = ['#e58f9b', '#f0c75e', '#b79ad6', '#f29e7a'];
  return (
    <g>
      <rect x={a} y="141" width={b - a} height="5" rx="2" fill="#7f9e6e" />
      {spots.map((x, i) => <circle key={x} cx={x} cy="141" r="2.6" fill={colors[i % colors.length]} />)}
    </g>
  );
};

const Fence = () => {
  const pickets = [];
  for (let x = 4; x <= 196; x += 9) if (x < 84 || x > 114) pickets.push(x);
  return (
    <g fill={TRIM} stroke="#d9cdbb" strokeWidth=".6">
      <rect x="2" y="155" width="80" height="3" />
      <rect x="118" y="155" width="80" height="3" />
      {pickets.map(x => <path key={x} d={`M${x - 2.5} 166v-14l2.5-3 2.5 3v14z`} />)}
    </g>
  );
};

const Mailbox = () => (
  <g>
    <rect x="124" y="148" width="2.5" height="16" fill="#7a5a44" />
    <rect x="118" y="141" width="15" height="9" rx="4" fill="#4f6f9a" />
    <rect x="131" y="138" width="1.6" height="6" fill="#d9574a" />
  </g>
);

const Lamp = () => (
  <g>
    <rect x="77" y="132" width="2.5" height="32" fill="#4a4038" />
    <rect x="73.5" y="124" width="9.5" height="10" rx="2" fill="#4a4038" />
    <rect x="75.5" y="126" width="5.5" height="6" rx="1" fill={WINDOW} />
    <circle cx="78.3" cy="129" r="9" fill={WINDOW} opacity=".25" />
  </g>
);

const Pond = () => (
  <g>
    <ellipse cx="34" cy="161" rx="24" ry="6.5" fill="#9fc3d6" />
    <ellipse cx="28" cy="159.5" rx="8" ry="1.6" fill="#fff" opacity=".55" />
    <circle cx="44" cy="161" r="2.2" fill="#8fae7e" />
  </g>
);

const Cat = () => (
  <g fill="#3d3530">
    <ellipse cx="64" cy="160" rx="5.5" ry="4.5" />
    <circle cx="64" cy="153" r="3.6" />
    <path d="M61 151l.4-3.6 2 2.2zM67 151l-.4-3.6-2 2.2z" />
    <path d="M69 161q5-1 4-7" stroke="#3d3530" strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </g>
);

const Dog = () => (
  <g>
    <ellipse cx="178" cy="159" rx="9" ry="5" fill="#c79a6a" />
    <circle cx="186" cy="153" r="4.6" fill="#c79a6a" />
    <ellipse cx="188.5" cy="150" rx="2" ry="3.4" fill="#9c7349" />
    <circle cx="190.6" cy="153.6" r="1" fill="#3d3530" />
    <rect x="172" y="161" width="2.4" height="5" fill="#c79a6a" />
    <rect x="182" y="161" width="2.4" height="5" fill="#c79a6a" />
    <path d="M169 157q-5-3-4-7" stroke="#c79a6a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
  </g>
);

// A little person standing out front. Unless they've picked their own look,
// it comes from their id so it's stable and different for everyone. A face
// photo, if they added one, replaces the drawn face.
export function Person({ seed, x = 150, waving, look, photo }) {
  const clip = useId();
  const { skin, hair, shirt, long } = lookFor(seed, look);
  return (
    <g transform={`translate(${x} 0)`}>
      <g className="homey-person">
        <ellipse cx="0" cy="167" rx="9" ry="2" fill="#000" opacity=".12" />
        <rect x="-4.5" y="152" width="3.6" height="14" rx="1.6" fill="#3d4a5c" />
        <rect x="0.9" y="152" width="3.6" height="14" rx="1.6" fill="#3d4a5c" />
        <rect x="-7" y="137" width="14" height="18" rx="5" fill={shirt} />
        <rect x="-10" y="139" width="3.6" height="13" rx="1.8" fill={shirt} />
        <g className={waving ? 'homey-wave' : ''}>
          <rect x="6.4" y="139" width="3.6" height="13" rx="1.8" fill={shirt} />
          <circle cx="8.2" cy="152.5" r="2" fill={skin} />
        </g>
        {photo ? (
          <>
            <clipPath id={clip}><circle cx="0" cy="128.5" r="8.5" /></clipPath>
            <image href={photo} x="-8.5" y="120" width="17" height="17" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
            <circle cx="0" cy="128.5" r="8.5" fill="none" stroke="#fff" strokeWidth="1" />
          </>
        ) : (
          <>
            {long && <rect x="-7.5" y="124" width="15" height="17" rx="6" fill={hair} />}
            <circle cx="0" cy="129" r="7" fill={skin} />
            <path d="M-7.2 129a7.2 7.2 0 0 1 14.4 0c-3-3-10-3.4-14.4 0z" fill={hair} />
            <circle cx="-2.4" cy="130" r=".9" fill="#2e2420" />
            <circle cx="2.4" cy="130" r=".9" fill="#2e2420" />
            <path d="M-1.8 133q1.8 1.4 3.6 0" stroke="#2e2420" strokeWidth=".8" fill="none" strokeLinecap="round" />
          </>
        )}
      </g>
    </g>
  );
}

// The house, yard extras and person, as SVG shapes in a 200 × 170 box.
// Use inside another <svg> (the village) or through HomeArt below.
export function HomeShapes({ home, seed, person = true, waving = false }) {
  const owned = new Set(home.owned || []);
  const wall = (PAINTS.find(p => p.id === home.paint) || PAINTS[0]).color;
  return (
    <>
      <path d="M92 145h16l6 25H86z" fill="#e6dccb" />
      {owned.has('tree') && <Tree />}
      <House level={home.level || 1} wall={wall} />
      {owned.has('flowers') && <Flowers level={home.level || 1} />}
      {owned.has('pond') && <Pond />}
      {owned.has('fence') && <Fence />}
      {owned.has('lamp') && <Lamp />}
      {owned.has('mailbox') && <Mailbox />}
      {owned.has('cat') && <Cat />}
      {owned.has('dog') && <Dog />}
      {person && <Person seed={seed} waving={waving} look={home.look} photo={home.photo} />}
    </>
  );
}

export default function HomeArt({ className, ...props }) {
  return (
    <svg viewBox="0 0 200 170" className={`block ${className || ''}`} role="img" aria-hidden="true">
      <HomeShapes {...props} />
    </svg>
  );
}
