'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { supabase } from '@/lib/supabase';

export default function Chat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);

  useEffect(() => {
    async function loadOrCreateConversation() {
      // 1. Try to find the most recent existing conversation
      const { data: existingConvo, error: convoError } = await supabase
        .from('conversations')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convoError) {
        console.error('Failed to fetch conversations:', convoError);
        setIsInitializing(false);
        return;
      }

      if (existingConvo) {
        // 2a. Found one — load its messages
        setConversationId(existingConvo.id);

        const { data: pastMessages, error: messagesError } = await supabase
          .from('messages')
          .select('id, role, content')
          .eq('conversation_id', existingConvo.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Failed to fetch messages:', messagesError);
        } else if (pastMessages) {
          // Convert DB rows into the UIMessage shape useChat expects
          const formatted = pastMessages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: [{ type: 'text' as const, text: m.content }],
          }));
          setInitialMessages(formatted);
        }
      } else {
        // 2b. No conversations exist yet — create the first one
        const { data: newConvo, error: createError } = await supabase
          .from('conversations')
          .insert({ title: 'New conversation' })
          .select()
          .single();

        if (newConvo) setConversationId(newConvo.id);
        if (createError) console.error('Failed to create conversation:', createError);
      }

      setIsInitializing(false);
    }

    loadOrCreateConversation();
  }, []);

  const { messages, sendMessage, status, error, regenerate } = useChat({
    messages: initialMessages, // seed with loaded history
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;
    sendMessage({ text: input }, { body: { conversationId } });
    setInput('');
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto py-12 h-screen">
      <div className="text-sm text-gray-500 mb-2">Messages: {messages.length}</div>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {isInitializing && (
          <div className="text-gray-400 text-sm">Loading conversation…</div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-lg max-w-[80%] ${m.role === 'user'
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-gray-100 text-gray-900'
              }`}
          >
            {m.parts.map((part, i) => {
              if (part.type !== 'text') return null;

              if (m.role === 'user') {
                return <span key={i}>{part.text}</span>;
              }

              return (
                <ReactMarkdown
                  key={i}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className="bg-gray-200 px-1 rounded" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {part.text}
                </ReactMarkdown>
              );
            })}
          </div>
        ))}

        {isLoading && <div className="text-gray-400 text-sm">Claude is thinking…</div>}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error.message.includes('429')
              ? 'Too many requests — please wait a moment and try again.'
              : 'Something went wrong. Please try again.'}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isInitializing ? 'Loading…' : 'Ask something…'}
          className="flex-1 border rounded-lg px-4 py-2"
          disabled={isLoading || isInitializing}
        />
        <button
          type="submit"
          disabled={isLoading || isInitializing}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          className="shrink-0 bg-red-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-700"
          onClick={() => regenerate()}
        >
          Retry
        </button>
      </form>
    </div>
  );
}