'use client';

import { useState, useRef, useEffect } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const res = await fetch('/api/reasoning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': 'some-correlation-id',
        },
        body: JSON.stringify({ request: text }),
      });
      if (!res.ok) throw new Error(res.statusText);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.name === 'message-stream-chunk') {
                const chunk = data.payload?.chunk ?? '';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + chunk }
                      : m,
                  ),
                );
                if (data.payload?.isFinal) {
                  setLoading(false);
                  break;
                }
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `Error: ${e instanceof Error ? e.message : String(e)}`,
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m,
        ),
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto flex h-screen w-full max-w-2xl flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
                      )}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex gap-3">
            <textarea
              className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-900 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-5 font-medium text-white transition-opacity hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (
                <span className="text-sm">Sending...</span>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 2 9 18z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
