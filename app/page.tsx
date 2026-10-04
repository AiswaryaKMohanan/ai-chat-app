'use client';

import type { UIMessage } from 'ai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatView, type Conversation } from '@/components/chat-view';
import { UploadButton } from '@/components/upload-button';
import { supabase } from '@/lib/supabase';

type ActiveChat = {
  // Changing `key` remounts ChatView; `id` is null until the first message is sent
  key: string;
  id: string | null;
  messages: UIMessage[];
};

const newChat = (): ActiveChat => ({ key: crypto.randomUUID(), id: null, messages: [] });

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const latestRequest = useRef(0);

  const openConversation = useCallback(async (id: string) => {
    const request = ++latestRequest.current;
    setSidebarOpen(false);
    setLoadError('');

    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    // A newer selection was made while this one was loading
    if (request !== latestRequest.current) return;

    if (error) {
      console.error('Failed to fetch messages:', error);
      setLoadError('Could not load this conversation. Please try again.');
      return;
    }

    // Convert DB rows into the UIMessage shape useChat expects
    const messages: UIMessage[] = (data ?? []).map((m) => ({
      id: String(m.id),
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    }));
    setActive({ key: id, id, messages });
  }, []);

  const startNewChat = () => {
    latestRequest.current++;
    setSidebarOpen(false);
    setLoadError('');
    setActive(newChat());
  };

  useEffect(() => {
    async function loadConversations() {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to fetch conversations:', error);
        setLoadError('Could not load your conversations. You can still start a new chat.');
        setActive(newChat());
        return;
      }

      const list = (data ?? []).map((c) => ({ id: String(c.id), title: c.title }));
      setConversations(list);

      // Resume the most recent conversation, or start fresh
      if (list.length > 0) await openConversation(list[0].id);
      else setActive(newChat());
    }

    loadConversations();
  }, [openConversation]);

  return (
    <div className="flex h-dvh">
      <aside
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex absolute md:static inset-y-0 left-0 z-10 w-64 shrink-0 flex-col gap-3 p-3 border-r border-gray-200 dark:border-gray-800 bg-background`}
      >
        <button
          type="button"
          onClick={startNewChat}
          className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700"
        >
          New chat
        </button>

        <nav aria-label="Conversations" className="flex-1 overflow-y-auto space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openConversation(c.id)}
              aria-current={active?.id === c.id ? 'page' : undefined}
              className={`block w-full text-left truncate rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                active?.id === c.id ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''
              }`}
            >
              {c.title || 'New conversation'}
            </button>
          ))}
        </nav>

        <UploadButton />
      </aside>

      <main className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Toggle conversations"
            aria-expanded={sidebarOpen}
            className="md:hidden border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-sm"
          >
            ☰
          </button>
          <h1 className="font-semibold">AI Chat</h1>
        </header>

        {loadError && (
          <div role="alert" className="px-4 py-2 text-sm text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300">
            {loadError}
          </div>
        )}

        {active ? (
          <ChatView
            key={active.key}
            conversationId={active.id}
            initialMessages={active.messages}
            onConversationCreated={(conversation) => {
              setConversations((list) => [conversation, ...list]);
              setActive((current) => current && { ...current, id: conversation.id });
            }}
          />
        ) : (
          !loadError && <div className="p-4 text-gray-400 text-sm">Loading conversation…</div>
        )}
      </main>
    </div>
  );
}
