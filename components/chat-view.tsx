'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { Markdown } from '@/components/markdown';
import { messageMetadataSchema, type ChatMessage, type MessageMetadata } from '@/lib/chat-types';
import { supabase } from '@/lib/supabase';

export type Conversation = { id: string; title: string | null };

const MAX_MESSAGE_CHARS = 8000;
const GENERIC_ERROR = 'Something went wrong. Please try again.';

const transport = new DefaultChatTransport({ api: '/api/chat' });

// HTTP errors arrive as the JSON body of the response, stream errors as plain text
function errorText(error: Error): string {
  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.error === 'string') return parsed.error;
  } catch {}
  return error.message && error.message.length < 200 ? error.message : GENERIC_ERROR;
}

function metadataText(metadata: MessageMetadata): string {
  const { createdAt, model, inputTokens, outputTokens, totalTokens, costUsd } = metadata;
  const tokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? `${inputTokens} in / ${outputTokens} out tokens`
      : totalTokens !== undefined && `${totalTokens} tokens`;

  return [
    createdAt !== undefined &&
      new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    model,
    tokens,
    // Replies cost fractions of a cent, so two decimals would show $0.00
    costUsd !== undefined && `$${costUsd.toFixed(4)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

type Props = {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  onConversationCreated: (conversation: Conversation) => void;
};

// Mount with a new `key` to switch conversations: useChat only reads
// `messages` on first render.
export function ChatView({ conversationId, initialMessages, onConversationCreated }: Props) {
  const { messages, sendMessage, status, error, regenerate, stop } = useChat<ChatMessage>({
    messages: initialMessages,
    transport,
    messageMetadataSchema,
  });

  const [input, setInput] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const idRef = useRef(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = isCreating || status === 'submitted' || status === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);

  const submit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setCreateError('');

    // The conversation row is created on the first message, titled after it
    if (!idRef.current) {
      setIsCreating(true);
      const { data, error: insertError } = await supabase
        .from('conversations')
        .insert({ title: text.slice(0, 60) })
        .select('id, title')
        .single();
      setIsCreating(false);

      if (insertError || !data) {
        console.error('Failed to create conversation:', insertError);
        setCreateError('Could not start a conversation. Please try again.');
        return;
      }
      idRef.current = String(data.id);
      onConversationCreated({ id: idRef.current, title: data.title });
    }

    sendMessage({ text }, { body: { conversationId: idRef.current } });
    setInput('');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 pt-24">
              <h2 className="text-lg font-medium text-foreground mb-1">How can I help?</h2>
              <p className="text-sm">
                Ask a question, or upload a PDF to chat with your documents.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg max-w-[85%] w-fit break-words ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white ml-auto whitespace-pre-wrap'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type !== 'text') return null;
                return m.role === 'user' ? (
                  <span key={i}>{part.text}</span>
                ) : (
                  <Markdown key={i} text={part.text} />
                );
              })}
              {m.role === 'assistant' && m.metadata && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {metadataText(m.metadata)}
                </div>
              )}
              {m.role === 'assistant' && !!m.metadata?.sources?.length && (
                <details className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  <summary className="cursor-pointer">
                    Sources ({m.metadata.sources.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {m.metadata.sources.map((source, i) => (
                      <li key={i} className="border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                        <div className="font-medium">
                          [{i + 1}] {source.documentName}
                          {source.similarity !== undefined &&
                            ` · ${Math.round(source.similarity * 100)}% match`}
                        </div>
                        <p className="whitespace-pre-wrap line-clamp-4">{source.text}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}

          {status === 'submitted' && <div className="text-gray-400 text-sm">Claude is thinking…</div>}

          {(error || createError) && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
            >
              <span>{createError || errorText(error!)}</span>
              {error && (
                <button
                  type="button"
                  className="shrink-0 bg-red-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-700"
                  onClick={() => regenerate({ body: { conversationId: idRef.current } })}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-gray-200 dark:border-gray-800 px-4 py-3"
      >
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder="Ask something…"
            aria-label="Message"
            className="flex-1 resize-none max-h-40 border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-4 py-2 [field-sizing:content]"
          />
          {status === 'streaming' ? (
            <button
              type="button"
              onClick={() => stop()}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
