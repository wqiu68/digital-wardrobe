// Supabase Edge Function: fetch a product page (or its image) server-side so the
// browser isn't blocked by CORS. Only signed-in users can call it (Supabase
// verifies the JWT before this code runs).
//
// POST { url, mode?: 'html' | 'image' }
//   html  → { html, finalUrl }
//   image → { dataUrl }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_HTML_BYTES = 8_000_000;
const MAX_IMAGE_BYTES = 4_000_000;
const TIMEOUT_MS = 12_000;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Refuse anything that isn't a public http(s) URL
function isAllowed(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return null;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return null;
  if (h.startsWith('[') || h === '::1') return null; // no raw IPv6
  return u;
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) { await reader.cancel(); throw new Error('Response too large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { url?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const target = isAllowed(body.url || '');
  if (!target) return json({ error: 'That link is not allowed.' }, 400);
  const mode = body.mode === 'image' ? 'image' : 'html';

  try {
    const res = await fetch(target.href, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return json({ error: `The site responded with ${res.status}.` }, 502);

    if (mode === 'image') {
      const type = res.headers.get('content-type') || '';
      if (!type.startsWith('image/')) return json({ error: 'Not an image.' }, 415);
      const bytes = await readCapped(res, MAX_IMAGE_BYTES);
      return json({ dataUrl: `data:${type.split(';')[0]};base64,${toBase64(bytes)}` });
    }

    const bytes = await readCapped(res, MAX_HTML_BYTES);
    return json({ html: new TextDecoder().decode(bytes), finalUrl: res.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg.includes('timed out') || msg.includes('abort') ? 'timeout' : msg }, 502);
  }
});
