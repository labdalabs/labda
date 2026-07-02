// Minimal client for the EVE agent's HTTP session API, via the same-origin
// /api/eve proxy. Starts a durable session and streams the NDJSON events,
// surfacing assistant text as it arrives.

export interface EveEvent {
  type?: string;
  role?: string;
  text?: string;
  delta?: string;
  [key: string]: unknown;
}

// Start a session with an initial message; returns the session id.
export async function startSession(message: string): Promise<string> {
  const res = await fetch('/api/eve/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`EVE session failed (${res.status})`);
  const sessionId =
    res.headers.get('x-eve-session-id') ??
    ((await res.clone().json().catch(() => ({}))) as { sessionId?: string })
      .sessionId ??
    '';
  if (!sessionId) throw new Error('EVE did not return a session id');
  return sessionId;
}

// Stream a session's NDJSON events, invoking onText with any assistant text
// deltas as they arrive.
export async function streamSession(
  sessionId: string,
  onText: (text: string) => void,
): Promise<void> {
  const res = await fetch(`/api/eve/session/${sessionId}/stream`);
  if (!res.ok || !res.body) throw new Error(`EVE stream failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line) as EveEvent;
        const text = event.delta ?? (event.role === 'assistant' ? event.text : undefined);
        if (typeof text === 'string' && text) onText(text);
      } catch {
        // ignore non-JSON keepalive lines
      }
    }
  }
}
