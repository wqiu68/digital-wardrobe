// Supabase Edge Function: the "Ask homey" assistant.
//
// This is a thin, signed-in-only proxy to Claude. It holds the API key and the
// fixed instructions/tools; the browser runs the tools itself (with the user's
// own session, so database row-level security still applies) and sends the
// results back here for the next turn.
//
// POST { messages }  →  { content, stop_reason }
//
// Needs the secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_MESSAGES = 60;
const MAX_BODY_BYTES = 400_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SYSTEM = `You are the assistant inside homey, an app where someone keeps their closet (clothes they own) and their bookshelf (books they've read, are reading, or want to read). You make changes for them so they don't have to fill in forms.

How to work:
- Do what they ask with the tools, then reply in one or two short, friendly sentences saying what you did. No lists or headings unless they asked for a list.
- Before adding a book or piece of clothing, search for it first so you don't add a duplicate. If it's already there, say so (or update it if that's what they meant).
- Use sensible defaults instead of asking. A book with no shelf mentioned goes to "want". "I just finished X" means shelf "read". "I'm reading X" means "reading". For clothes, pick the category from the item name, and leave out fields you don't know.
- If something is truly ambiguous (two different items match, or you can't tell which book they mean), ask one short question.
- Books on the "read" shelf have a year_read. Search results include it, so you can answer questions like "what did I read in 2024?".
- When they paste a product link, use add_closet_item_from_link.
- You can't delete anything or touch friends, lending, or rankings. If they ask, tell them where to do it in the app (tap the item to edit or delete it).
- Only use the tools for this person's own closet and shelf. If they ask for something unrelated to homey, answer briefly and steer back.`;

const opt = (type: string, description: string) => ({ type, description });

const TOOLS = [
  {
    name: 'search_my_books',
    description: "Search this person's bookshelf by title or author. Empty query returns their most recent books. Returns up to 25 matches with ids.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Title or author words; empty string for recent books' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_book',
    description: 'Add a book to their shelf. The app looks it up in Open Library to fill in the cover, year and pages. Returns what was added, or that it was already there.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        author: opt('string', "Author, if known. Helps find the right book."),
        shelf: { type: 'string', enum: ['want', 'reading', 'read'], description: 'want = Want to Read, reading = Currently Reading, read = Read' },
        rating: opt('integer', 'Star rating 1-5, only if they gave one'),
        year_read: opt('integer', 'Year they finished it, only if they said (e.g. "read it in 2019"). Leave out otherwise; the app uses this year for books just finished.'),
        notes: opt('string', 'Their own notes or thoughts, only if they gave some'),
      },
      required: ['title', 'shelf'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_book',
    description: 'Change a book already on their shelf (move shelves, rate, add notes). Get the id from search_my_books. Leave out anything that is not changing.',
    input_schema: {
      type: 'object',
      properties: {
        book_id: { type: 'string' },
        shelf: { type: 'string', enum: ['want', 'reading', 'read'] },
        rating: opt('integer', 'Star rating 1-5'),
        year_read: opt('integer', 'Year they finished it'),
        notes: opt('string', 'Replaces their notes'),
      },
      required: ['book_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_my_closet',
    description: "Search this person's closet by name, brand or color. Empty query returns their most recent pieces. Returns up to 25 matches with ids.",
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_closet_item',
    description: 'Add a piece of clothing to their closet from a description.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name, e.g. "Wool overcoat" or "White linen shirt"' },
        category: { type: 'string', enum: ['TOPS', 'BOTTOMS', 'OUTERWEAR', 'DRESSES', 'SHOES', 'ACCESSORIES', 'OTHER'] },
        brand: opt('string', 'Brand, if mentioned'),
        color: opt('string', 'Color, if mentioned'),
        size: opt('string', 'Size, if mentioned'),
        occasions: {
          type: 'array',
          items: { type: 'string', enum: ['everyday', 'work', 'athletic'] },
          description: 'When they wear it. Leave out for all occasions.',
        },
        notes: opt('string', 'Anything else they said about it'),
      },
      required: ['name', 'category'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_closet_item_from_link',
    description: "Add a piece of clothing from a store's product link. The app reads the page for the name, brand, color and photo.",
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        category: { type: 'string', enum: ['TOPS', 'BOTTOMS', 'OUTERWEAR', 'DRESSES', 'SHOES', 'ACCESSORIES', 'OTHER'], description: 'Only if they said what it is' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_closet_item',
    description: 'Change a piece already in their closet. Get the id from search_my_closet. Leave out anything that is not changing.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        name: opt('string', 'New name'),
        category: { type: 'string', enum: ['TOPS', 'BOTTOMS', 'OUTERWEAR', 'DRESSES', 'SHOES', 'ACCESSORIES', 'OTHER'] },
        brand: opt('string', 'New brand'),
        color: opt('string', 'New color'),
        size: opt('string', 'New size'),
        notes: opt('string', 'Replaces their notes'),
      },
      required: ['item_id'],
      additionalProperties: false,
    },
  },
];

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'NOT_CONFIGURED' }, 503);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'That conversation is too long. Start a new one.' }, 413);

  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    ({ messages } = JSON.parse(raw));
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!Array.isArray(messages) || !messages.length || messages[0]?.role !== 'user') {
    return json({ error: 'Bad request' }, 400);
  }
  if (messages.length > MAX_MESSAGES) return json({ error: 'That conversation is too long. Start a new one.' }, 413);
  // Only user/assistant turns from the browser; instructions stay server-side
  if (messages.some(m => m.role !== 'user' && m.role !== 'assistant')) return json({ error: 'Bad request' }, 400);

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    return json({ content: response.content, stop_reason: response.stop_reason });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Busy right now. Try again in a moment.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'NOT_CONFIGURED' }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `Assistant error (${e.status})` }, 502);
    return json({ error: 'Could not reach the assistant.' }, 502);
  }
});
