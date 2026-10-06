# AI Chat

A chat app that answers questions with Claude, grounded in PDFs you upload (retrieval-augmented generation).

- **Next.js 15** (App Router) and React 19
- **Claude** via the Vercel AI SDK, streamed to the browser
- **Voyage AI** embeddings (`voyage-3.5`, 1024 dimensions)
- **Supabase** (Postgres + pgvector) for conversations, messages and document chunks

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Chat completions |
| `VOYAGE_API_KEY` | yes | Embeddings for upload and retrieval |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key |
| `ANTHROPIC_MODEL` | no | Overrides the chat model |

## Database

The app expects these objects in Supabase:

- `conversations` (`id`, `title`, `created_at`)
- `messages` (`id`, `conversation_id`, `role`, `content`, `created_at`, optional `metadata jsonb`)
- `document_chunks` (`id`, `document_name`, `chunk_text`, `embedding vector(1024)`)
- `match_document_chunks(query_embedding, match_count)`: an RPC returning the closest chunks

The `metadata` column stores each reply's sources, token usage and cost so they survive a reload. The app works without it, but then those details are only shown for the current session. To add it:

```sql
alter table messages add column metadata jsonb;
```

## How it works

1. **Upload** (`POST /api/upload`): the PDF is parsed, split into overlapping 1,000-character chunks, embedded, and stored in `document_chunks`.
2. **Chat** (`POST /api/chat`): the latest question is embedded, the four closest chunks are retrieved and added to the system prompt, and the reply is streamed back. Both sides of the exchange are saved to `messages`.

If retrieval fails, the chat still answers from general knowledge.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build on every pull request.

## Limits

| Limit | Value |
| --- | --- |
| Chat requests | 20 per minute per IP |
| Uploads | 5 per 10 minutes per IP |
| Message length | 8,000 characters |
| PDF size | 10 MB, up to 500 chunks |

Rate limiting is held in memory (`lib/api.ts`), so it applies per server instance. Use a shared store such as Redis when running more than one instance.

## Before going public

The app has **no user accounts**. Every visitor shares the same conversations and documents, and the browser talks to Supabase with the anon key. Before exposing it to the internet, add Supabase Auth, add a `user_id` column to each table, and enforce row-level security so users only see their own rows.

`GET /api/health` returns `{"status":"ok"}` for uptime checks.
