import { PDFParse } from 'pdf-parse';
import { supabase } from '@/lib/supabase';
import { embedText, embedTextBatch } from '@/lib/voyage';

// NOT edge — pdf-parse needs Node.js APIs, unlike  chat route
export const runtime = 'nodejs';

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    start = end - overlap; // step back by `overlap` so chunks share context
  }

  return chunks.filter((c) => c.trim().length > 0);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Extract text from the PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const fullText = result.text;

    // 2. Split into overlapping chunks
    const chunks = chunkText(fullText);
    console.log(`Extracted ${fullText.length} chars, split into ${chunks.length} chunks`);

   // 3. Embed all chunks in ONE batch call, then store them
const embeddings = await embedTextBatch(chunks, 'document');

let savedCount = 0;
for (let i = 0; i < chunks.length; i++) {
  const { error } = await supabase.from('document_chunks').insert({
    document_name: file.name,
    chunk_text: chunks[i],
    embedding: embeddings[i],
  });

  if (error) {
    console.error('Failed to save chunk:', error);
  } else {
    savedCount++;
  }
}

    return Response.json({
      success: true,
      fileName: file.name,
      totalChunks: chunks.length,
      savedChunks: savedCount,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Failed to process PDF' }, { status: 500 });
  }
}