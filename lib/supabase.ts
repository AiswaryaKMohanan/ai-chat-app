import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function searchDocumentChunks(queryEmbedding: number[], matchCount = 4) {
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/match_document_chunks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        query_embedding: embeddingString,
        match_count: matchCount,
      }),
    }
  );

  const data = await response.json();
  console.log('=== DEBUG: raw fetch status:', response.status);
  console.log('=== DEBUG: raw fetch response:', JSON.stringify(data).slice(0, 500));

  return Array.isArray(data) ? data : [];
}