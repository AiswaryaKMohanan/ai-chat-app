import { supabase, searchDocumentChunks } from '@/lib/supabase';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages } from 'ai';
import { embedText } from '@/lib/voyage';

export const runtime = 'edge';

async function callWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const isNonRetryable = status === 401 || status === 400 || status === 429;
      const isLastAttempt = attempt === maxRetries - 1;
      if (isNonRetryable || isLastAttempt) throw err;
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function POST(req: Request) {
  try {
    const { messages, conversationId } = await req.json();

    const { count } = await supabase
  .from('document_chunks')
  .select('*', { count: 'exact', head: true });
console.log('=== DEBUG: total rows visible via JS client:', count);

    const lastUserMessage = messages[messages.length - 1];
    const lastUserText = lastUserMessage.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserText,
    });

    // --- NEW: Retrieval step ---
    const queryEmbedding = await embedText(lastUserText, 'query');
    console.log('=== DEBUG: query embedding length:', queryEmbedding.length);

    const relevantChunks = await searchDocumentChunks(queryEmbedding, 4);
    console.log('=== DEBUG: chunks found:', relevantChunks.length);
console.log('=== DEBUG: chunks:', JSON.stringify(relevantChunks, null, 2));

    const context = relevantChunks
      .map((c :any) => `[From ${c.document_name}]\n${c.chunk_text}`)
      .join('\n\n---\n\n');



    const systemPrompt = context
      ? `You are a helpful assistant. Use the following context from an uploaded document to answer the user's question. If the answer isn't in the context, say so rather than guessing.\n\nCONTEXT:\n${context}`
      : `You are a helpful assistant. No document context is currently available, so answer using your general knowledge.`;
    // --- END NEW ---

    const result = await callWithBackoff(() =>
      Promise.resolve(
        streamText({
          model: anthropic('claude-sonnet-4-6'),
          system: systemPrompt,
          messages: convertToModelMessages(messages),
          maxOutputTokens: 1000,
        })
      )
    );

    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finishedMessages }) => {
        const assistantMessage = finishedMessages[finishedMessages.length - 1];
        const assistantText = assistantMessage.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantText,
        });
      },
      onError: (error) => {
        console.error('Streaming error:', error);
        return 'Something went wrong while generating a response. Please try again.';
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    if (error.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
