import { supabase } from '@/lib/supabase';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages } from 'ai';

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

    const lastUserMessage = messages[messages.length - 1];
    const lastUserText = lastUserMessage.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');


    const { data: userInsertData, error: userInsertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: lastUserText,
      })
      .select();


    const result = await callWithBackoff(() =>
      Promise.resolve(
        streamText({
          model: anthropic('claude-sonnet-4-6'),
          system: 'You are a helpful, concise assistant for a frontend developer learning AI engineering.',
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

        const { data: assistantInsertData, error: assistantInsertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText,
          })
          .select();

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