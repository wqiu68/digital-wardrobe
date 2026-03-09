const BRAND_MAP = {
  'zara.com': 'Zara', 'hm.com': 'H&M', 'mango.com': 'Mango',
  'uniqlo.com': 'Uniqlo', 'gap.com': 'Gap', 'oldnavy.com': 'Old Navy',
  'anthropologie.com': 'Anthropologie', 'freepeople.com': 'Free People',
  'urbanoutfitters.com': 'Urban Outfitters', 'asos.com': 'ASOS',
  'nordstrom.com': 'Nordstrom', 'macys.com': "Macy's",
  'bloomingdales.com': "Bloomingdale's", 'net-a-porter.com': 'Net-A-Porter',
  'farfetch.com': 'Farfetch', 'revolve.com': 'Revolve',
  'shopbop.com': 'Shopbop', 'ssense.com': 'SSENSE',
  'lululemon.com': 'Lululemon', 'nike.com': 'Nike', 'adidas.com': 'Adidas',
  'shein.com': 'Shein', 'forever21.com': 'Forever 21',
  'cos.com': 'COS', 'arket.com': 'Arket', 'weekday.com': 'Weekday',
  'other-stories.com': '& Other Stories', 'bershka.com': 'Bershka',
  'abercrombie.com': 'Abercrombie & Fitch', 'ae.com': 'American Eagle',
  'ralphlauren.com': 'Ralph Lauren', 'calvinklein.com': 'Calvin Klein',
  'tommyhilfiger.com': 'Tommy Hilfiger', 'lacoste.com': 'Lacoste',
  'guess.com': 'GUESS', 'express.com': 'Express',
  'bananarepublic.com': 'Banana Republic', 'jcrew.com': 'J.Crew',
  'target.com': 'Target', 'amazon.com': 'Amazon',
  'hollisterco.com': 'Hollister', 'pullandbear.com': 'Pull&Bear',
  'stradivarius.com': 'Stradivarius', 'monki.com': 'Monki',
  'aritzia.com': 'Aritzia',
};

const CATEGORY_KEYWORDS = {
  TOPS: ['shirt', 't-shirt', 'tee', 'top', 'blouse', 'sweater', 'hoodie', 'sweatshirt', 'pullover', 'cardigan', 'tank', 'cami', 'polo', 'tunic', 'crop', 'knit', 'jersey', 'henley', 'bodysuit'],
  BOTTOMS: ['pant', 'jean', 'jeans', 'short', 'skirt', 'trouser', 'legging', 'jogger', 'chino', 'cargo', 'sweatpant', 'wide leg', 'straight leg', 'flare', 'bootcut'],
  OUTERWEAR: ['jacket', 'coat', 'parka', 'blazer', 'windbreaker', 'raincoat', 'trench', 'bomber', 'gilet', 'puffer', 'fleece', 'overcoat'],
  DRESSES: ['dress', 'gown', 'romper', 'jumpsuit', 'playsuit', 'dungaree'],
  SHOES: ['shoe', 'sneaker', 'boot', 'heel', 'sandal', 'loafer', 'trainer', 'mule', 'flat', 'oxford', 'pump', 'wedge', 'espadrille', 'ankle boot'],
  ACCESSORIES: ['bag', 'belt', 'hat', 'cap', 'scarf', 'glove', 'wallet', 'purse', 'backpack', 'tote', 'clutch', 'beanie', 'sock', 'necklace', 'bracelet', 'earring', 'ring', 'sunglasses', 'headband'],
};

const COLORS = [
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'red', 'green', 'yellow',
  'orange', 'purple', 'pink', 'brown', 'beige', 'cream', 'tan', 'khaki',
  'olive', 'burgundy', 'teal', 'mint', 'lavender', 'coral', 'camel', 'ecru',
  'ivory', 'charcoal', 'indigo', 'lilac', 'mauve', 'rust', 'sage',
];

// Path segments that are navigation noise, not product names
const SKIP_SEGMENTS = new Set([
  'shop', 'us', 'uk', 'eu', 'ca', 'au', 'fr', 'de', 'en', 'p', 'pd', 'dp',
  'product', 'products', 'item', 'items', 'catalog', 'c', 'collections',
  'category', 'women', 'men', 'kids', 'sale', 'new', 'web', 'store',
  'clothing', 'apparel', 'fashion', 'html', 'detail',
]);

function inferCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'OTHER';
}

function brandFromHostname(hostname) {
  const clean = hostname.replace(/^www\./, '');
  for (const [key, name] of Object.entries(BRAND_MAP)) {
    if (clean.includes(key)) return name;
  }
  const base = clean.split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function colorFromText(text) {
  const lower = text.toLowerCase();
  const found = COLORS.find(c => lower.includes(c));
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : '';
}

// --- Parse product name & attributes directly from the URL ---
function parseFromUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const brand = brandFromHostname(hostname);

    // Walk path segments from deepest to shallowest, find the best product slug
    const segments = pathname.split('/').map(s => s.split('?')[0]).filter(Boolean);
    let productSlug = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (SKIP_SEGMENTS.has(seg.toLowerCase())) continue;
      if (seg.length < 4) continue;
      if (/^\d+$/.test(seg)) continue; // pure number → skip
      if (/[a-z]/i.test(seg)) { productSlug = seg; break; }
    }

    if (!productSlug) return null;

    // Strip trailing numeric product IDs like "-62236843" or "_1234"
    const slug = productSlug.replace(/[-_]\d{4,}$/, '').replace(/[-_]+$/, '');

    // Convert slug to readable title
    const name = slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();

    if (name.length < 3) return null;

    return {
      name,
      brand,
      color: colorFromText(name),
      category: inferCategory(name),
      image: '',
      notes: '',
    };
  } catch {
    return null;
  }
}

// --- Fetch helpers ---

function fetchWithTimeout(url, ms = 14000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(url)
      .then(r => { clearTimeout(timer); resolve(r); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

function isRealProductPage(html) {
  // Bot-challenge / security pages are tiny and have no real content
  if (!html || html.length < 5000) return false;
  // Must have at least a title or og:title
  return /<title[\s>]/i.test(html);
}

async function fetchHTML(targetUrl) {
  const proxies = [
    async () => {
      const res = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`
      );
      if (!res.ok) throw new Error(`allorigins ${res.status}`);
      const json = await res.json();
      return json.contents || '';
    },
    async () => {
      const res = await fetchWithTimeout(
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
      );
      if (!res.ok) throw new Error(`corsproxy ${res.status}`);
      return res.text();
    },
  ];

  for (const attempt of proxies) {
    try {
      const html = await attempt();
      if (isRealProductPage(html)) return html;
    } catch { /* try next */ }
  }
  return null; // all proxies failed or returned bot pages
}

function parseMeta(doc) {
  const getMeta = (...names) => {
    for (const name of names) {
      const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      const val = el?.getAttribute('content')?.trim();
      if (val) return val;
    }
    return '';
  };

  let ldName = '', ldBrand = '', ldColor = '', ldImage = '';
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      const product = items.find(d => d?.['@type'] === 'Product');
      if (product) {
        ldName  = product.name || '';
        ldBrand = product.brand?.name || product.brand || '';
        ldColor = product.color || '';
        ldImage = Array.isArray(product.image) ? product.image[0] : (product.image || '');
        break;
      }
    } catch { /* skip */ }
  }

  return {
    name:  ldName  || getMeta('og:title', 'twitter:title') || '',
    brand: ldBrand || '',
    color: ldColor || '',
    image: ldImage || getMeta('og:image', 'twitter:image') || '',
    desc:  getMeta('og:description', 'description') || '',
  };
}

function cleanTitle(title) {
  return title.replace(/\s*[|–—-]\s*.+$/, '').trim();
}

function resolveUrl(maybeRelative, base) {
  if (!maybeRelative) return '';
  try { return new URL(maybeRelative, base).href; } catch { return maybeRelative; }
}

// --- Main export ---

export async function fetchProductInfo(url) {
  // 1. Always parse from URL first — works even when sites block scrapers
  const urlInfo = parseFromUrl(url);

  // 2. Try to fetch the real page for richer data (image, exact name)
  const html = await fetchHTML(url);

  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const meta = parseMeta(doc);
    const hostname = new URL(url).hostname;

    const name  = cleanTitle(meta.name)  || urlInfo?.name  || '';
    const brand = meta.brand || brandFromHostname(hostname);
    const color = meta.color || urlInfo?.color || colorFromText(name);
    const image = resolveUrl(meta.image, url);
    const category = inferCategory(name + ' ' + meta.desc) !== 'OTHER'
      ? inferCategory(name + ' ' + meta.desc)
      : (urlInfo?.category || 'OTHER');

    if (!name) throw new Error("Couldn't read product info from this page.");
    return { name, brand, color, image, category, notes: '' };
  }

  // 3. Fall back to URL-parsed info
  if (urlInfo?.name) return urlInfo;

  throw new Error("This site blocks automated access. Try filling in the details manually.");
}
