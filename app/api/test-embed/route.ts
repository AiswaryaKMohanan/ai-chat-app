import { embedText } from '@/lib/voyage';

export async function GET() {
  const embedding = await embedText('Hello world', 'document');
  return Response.json({
    length: embedding.length,
    sample: embedding.slice(0, 5),
  });
}