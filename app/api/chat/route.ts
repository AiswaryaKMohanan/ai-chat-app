import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  //stores the entire state of the request , each session 
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: 'You are a helpful, concise assistant for a frontend developer learning AI engineering.',
   messages: convertToModelMessages(messages),  });

  return result.toUIMessageStreamResponse();
}