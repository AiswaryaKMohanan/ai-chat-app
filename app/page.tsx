'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export default function Chat() {
  // messsages -  keeps the full message history (messages array in useChat) and resends it
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col max-w-2xl mx-auto py-12 h-screen">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-lg max-w-[80%] ${
              m.role === 'user'
                ? 'bg-blue-500 text-white ml-auto'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div className="text-sm text-gray-500 mb-2">
  Messages: {messages.length}
</div>
            {m.parts.map((part, i) =>
              part.type === 'text' ? <span key={i}>{part.text}</span> : null
            )}
            
          </div>
          
        ))}
        {isLoading && <div className="text-gray-400 text-sm">Claude is thinking…</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          className="flex-1 border rounded-lg px-4 py-2"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}