import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  //stores the entire state of the request , each session 
  try{
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: 'You are a helpful, concise assistant for a frontend developer learning AI engineering.',
    messages: convertToModelMessages(messages), 
    maxOutputTokens: 1000,
 });

  return result.toUIMessageStreamResponse({
    onError :(error)=>{
        console.error('Streaming error:', error);
        return 'Something went wrong while generating a response. Please try again.';
    }})
  }
    catch(error :any){
      console.log(error);
      
      if (error.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
     return new Response(
JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
  
}