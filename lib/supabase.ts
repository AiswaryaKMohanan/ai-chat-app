import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DocumentChunk = {
  document_name: string;
  chunk_text: string;
  similarity?: number;
};

export async function searchDocumentChunks(
  queryEmbedding: number[],
  matchCount = 4
): Promise<DocumentChunk[]> {
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // Called over REST rather than supabase.rpc() so the embedding is sent as a
  // pgvector string literal.
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/match_document_chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey!,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      query_embedding: embeddingString,
      match_count: matchCount,
    }),
  });

  if (!response.ok) {
    throw new Error(`match_document_chunks failed with status ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
