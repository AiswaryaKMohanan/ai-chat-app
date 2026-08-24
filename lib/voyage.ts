import { VoyageAIClient } from 'voyageai';

const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });

export async function embedText(
  text: string,
  inputType: 'query' | 'document'
): Promise<number[]> {
  const result = await client.embed({
    input: text,
    model: 'voyage-3.5',
    inputType,
    outputDimension: 1024,
  });
  return result.data![0].embedding!;
}

// New: batch version for embedding many chunks in one API call
export async function embedTextBatch(
  texts: string[],
  inputType: 'query' | 'document'
): Promise<number[][]> {
  const result = await client.embed({
    input: texts,
    model: 'voyage-3.5',
    inputType,
    outputDimension: 1024,
  });
  return result.data!.map((d) => d.embedding!);
}