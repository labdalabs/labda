'use client';

import { useState } from 'react';
import { Button } from '@labda/ui/components/ui/button';
import { Input } from '@labda/ui/components/ui/input';
import { startSession, streamSession } from '@/lib/eve/client';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

// Frontend integration for the EVE research agent (apps/copilot). Talks to the
// agent's HTTP session API through the same-origin /api/eve proxy and streams
// the reply. The agent's tools are the grounded challenge/knowledge engine, so
// its answers stay evidence-grounded.
export function EveChat({ projectId }: { projectId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const prompt = projectId ? `[project ${projectId}] ${text}` : text;
    setInput('');
    setError('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }]);
    try {
      const sessionId = await startSession(prompt);
      await streamSession(sessionId, (delta) => {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') last.text += delta;
          return copy;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3" data-testid="eve-chat">
      <h2 className="text-lg font-semibold">Research agent</h2>

      <ul className="space-y-2" data-testid="eve-messages">
        {messages.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Ask the agent to challenge a hypothesis, find contradicting evidence,
            or browse the knowledge graph.
          </li>
        ) : (
          messages.map((m, i) => (
            <li
              key={i}
              data-role={m.role}
              className={`rounded-md border p-2 text-sm ${
                m.role === 'user' ? 'bg-muted/40' : 'bg-card'
              }`}
            >
              <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">
                {m.role}
              </span>
              {m.text || (busy && m.role === 'assistant' ? '…' : '')}
            </li>
          ))
        )}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the research agent…"
          aria-label="Message the research agent"
          disabled={busy}
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()}>
          {busy ? 'Thinking…' : 'Send'}
        </Button>
      </form>
    </section>
  );
}
