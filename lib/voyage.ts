import { VoyageAIClient } from 'voyageai';

const MODEL = 'voyage-3.5';
const OUTPUT_DIMENSION = 1024;
// Keeps each request comfortably under Voyage's per-request input and token limits
const BATCH_SIZE = 64;

let client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (!client) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error('Missing VOYAGE_API_KEY environment variable.');
    client = new VoyageAIClient({ apiKey });
  }
  return client;
}

export async function embedText(
  text: string,
  inputType: 'query' | 'document'
): Promise<number[]> {
  const [embedding] = await embedTextBatch([text], inputType);
  return embedding;
}

export async function embedTextBatch(
  texts: string[],
  inputType: 'query' | 'document'
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await getClient().embed({
      input: batch,
      model: MODEL,
      inputType,
      outputDimension: OUTPUT_DIMENSION,
    });

    const data = result.data ?? [];
    if (data.length !== batch.length || data.some((d) => !d.embedding)) {
      throw new Error('Voyage returned an unexpected number of embeddings.');
    }
    embeddings.push(...data.map((d) => d.embedding!));
  }

  return embeddings;
}