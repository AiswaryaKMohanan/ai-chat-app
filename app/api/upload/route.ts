import { PDFParse } from 'pdf-parse';
import { jsonError, rateLimit } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { embedTextBatch } from '@/lib/voyage';

// NOT edge — pdf-parse needs Node.js APIs, unlike  chat route
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CHUNKS = 500;
const INSERT_BATCH_SIZE = 100;

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - overlap; // step back by `overlap` so chunks share context
  }

  return chunks.filter((c) => c.trim().length > 0);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    // Postgres text columns reject NUL bytes
    return result.text.replace(/\u0000/g, '');
  } finally {
    await parser.destroy();
  }
}

export async function POST(req: Request) {
  const limited = rateLimit(req, 'upload', 5, 10 * 60_000);
  if (limited) return limited;

  try {
    if (Number(req.headers.get('content-length') ?? 0) > MAX_FILE_BYTES + 1024 * 1024) {
      return jsonError('File is too large (max 10 MB).', 413);
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return jsonError('No file provided.', 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return jsonError('File is too large (max 10 MB).', 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return jsonError('Only PDF files are supported.', 415);
    }

    // 1. Extract text from the PDF
    let fullText: string;
    try {
      fullText = await extractPdfText(buffer);
    } catch (error) {
      console.error('PDF parse error:', error);
      return jsonError('Could not read this PDF. It may be corrupted or password-protected.', 422);
    }

    // 2. Split into overlapping chunks
    const chunks = chunkText(fullText);
    if (chunks.length === 0) {
      return jsonError('No text found in this PDF. Scanned documents are not supported.', 422);
    }
    if (chunks.length > MAX_CHUNKS) {
      return jsonError('This document is too long to index. Try a shorter PDF.', 413);
    }

    // 3. Embed the chunks, then store them in batches
    const embeddings = await embedTextBatch(chunks, 'document');
    const documentName = file.name.slice(0, 200);

    const rows = chunks.map((chunk, i) => ({
      document_name: documentName,
      chunk_text: chunk,
      embedding: embeddings[i],
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
      const { error } = await supabase
        .from('document_chunks')
        .insert(rows.slice(i, i + INSERT_BATCH_SIZE));

      if (error) {
        console.error('Failed to save chunks:', error);
        return jsonError('Failed to save the document. Please try again.', 500);
      }
    }

    return Response.json({
      success: true,
      fileName: documentName,
      totalChunks: chunks.length,
      savedChunks: rows.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return jsonError('Failed to process PDF.', 500);
  }
}
