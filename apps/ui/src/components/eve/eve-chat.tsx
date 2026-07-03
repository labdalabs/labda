'use client';

import { useEveAgentRuntime } from '@assistant-ui/eve';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';

// Frontend for the EVE research agent (apps/copilot). `useEveAgentRuntime` talks
// to same-origin `/eve/v1/*`, which the UI's route handler proxies to the agent
// (attaching the researcher's Supabase token). The agent's tools call the
// grounded challenge/knowledge engine, so answers stay evidence-grounded.
//
// The active project id rides along as ephemeral client context on every turn
// (never persisted to history, never shown in the thread), so the agent's tools
// know which project to act on.
export function EveChat({
  projectId,
  goal,
  className,
}: {
  projectId?: string;
  goal?: string;
  className?: string;
}) {
  const runtime = useEveAgentRuntime(
    projectId
      ? {
          prepareSend: (input) => ({
            ...input,
            clientContext: [
              `Active project id: ${projectId}`,
              goal ? `Session goal: ${goal}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          }),
        }
      : undefined,
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        data-testid="eve-chat"
        className={
          className ??
          'flex h-[70vh] flex-col overflow-hidden rounded-lg border'
        }
      >
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
}
