import type { UIMessage } from 'ai';
import { z } from 'zod';

// Shared by the chat route (which attaches it) and the client (which validates
// and renders it). Every field is optional: a message stops mid-stream with
// only the `start` fields, and older rows in the DB only have `createdAt`.
export const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  costUsd: z.number().optional(),
  // The retrieved passages the answer was based on
  sources: z
    .array(
      z.object({
        documentName: z.string(),
        text: z.string(),
        similarity: z.number().optional(),
      })
    )
    .optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatMessage = UIMessage<MessageMetadata>;
