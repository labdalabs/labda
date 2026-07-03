'use client';

import {
  ComposerPrimitive,
  MessagePrimitive,
  type ToolCallMessagePartProps,
  ThreadPrimitive,
  useMessagePartRuntime,
} from '@assistant-ui/react';
import { ArrowUp, Check, Loader2, Wrench } from 'lucide-react';

import { MarkdownText } from './markdown-text';

// The research copilot's tools (apps/copilot). Friendly labels for the tool
// activity chip; unknown names fall back to the raw tool name.
const TOOL_LABELS: Record<string, string> = {
  start_project: 'starting project',
  formulate_hypothesis: 'formulating hypothesis',
  search_papers: 'searching literature',
  attach_paper: 'attaching paper',
  new_papers: 'checking new papers',
  challenge_hypothesis: 'challenging hypothesis',
  find_contradicting_evidence: 'finding contradictions',
  challenge_protocol: 'challenging protocol',
  browse_okf: 'browsing knowledge graph',
  init_okf_local: 'exporting OKF',
};

const SUGGESTIONS: { label: string; prompt: string }[] = [
  {
    label: 'Start a new project',
    prompt: 'Help me start a new research project on a protein I want to study.',
  },
  {
    label: 'Formulate a hypothesis',
    prompt: 'Help me turn my idea into a precise, falsifiable hypothesis.',
  },
  {
    label: 'Challenge my hypothesis',
    prompt:
      'Challenge my current hypothesis — find the attached evidence that contradicts it.',
  },
  {
    label: 'Find contradicting evidence',
    prompt: 'Scan the references on my hypothesis for anything that contradicts it.',
  },
];

// Grounded tool activity: a compact chip showing which grounded tool ran.
function ToolFallback({ toolName, status }: ToolCallMessagePartProps) {
  const running = status?.type === 'running';
  const label = TOOL_LABELS[toolName] ?? toolName;
  return (
    <div className="text-muted-foreground my-1.5 inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-xs">
      {running ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Check className="h-3 w-3 text-primary" />
      )}
      <Wrench className="h-3 w-3" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

interface AskOption {
  id: string;
  label?: string;
  description?: string;
}

// The agent's built-in `ask_question` is a human-in-the-loop request: it pauses
// the turn for the researcher to choose. Render the prompt and its options as
// buttons and answer through the runtime's approval response, which
// @assistant-ui/eve maps back into the eve input request. (Without this it just
// showed a generic tool chip that never resolved.)
function AskQuestion({ args, status }: ToolCallMessagePartProps) {
  const runtime = useMessagePartRuntime();
  const a = (args ?? {}) as { prompt?: string; options?: AskOption[] };
  const prompt = a.prompt ?? 'The agent has a question.';
  const options = Array.isArray(a.options) ? a.options : [];
  const answered = status?.type !== 'requires-action';

  function answer(optionId: string) {
    if (answered) return;
    // The part runtime is scoped to this approval, so only the choice is needed.
    runtime.respondToToolApproval({ optionId });
  }

  return (
    <div
      className="my-2 rounded-lg border border-dashed bg-background/60 p-3"
      data-testid="ask-question"
    >
      <p className="text-sm font-medium">{prompt}</p>
      {options.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={answered}
              onClick={() => answer(o.id)}
              title={o.description}
              className="rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
            >
              {o.label ?? o.id}
            </button>
          ))}
        </div>
      )}
      {answered && (
        <p className="mt-2 text-xs text-muted-foreground">Answered.</p>
      )}
    </div>
  );
}

function AssistantParts() {
  return (
    <MessagePrimitive.Parts
      components={{
        Text: MarkdownText,
        tools: { by_name: { ask_question: AskQuestion }, Fallback: ToolFallback },
      }}
    />
  );
}

export function Thread() {
  return (
    <ThreadPrimitive.Root className="bg-background flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
        <ThreadPrimitive.Empty>
          <div className="mx-auto mt-8 max-w-md">
            <p className="text-muted-foreground mb-3 text-center text-sm">
              Ask the research agent to challenge a hypothesis, find contradicting
              evidence, or browse your knowledge graph — every answer is grounded
              in your project&apos;s references.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <ThreadPrimitive.Suggestion
                  key={s.label}
                  prompt={s.prompt}
                  send
                  className="border-border hover:bg-muted/60 rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                >
                  {s.label}
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
        <ThreadPrimitive.If running>
          <div className="text-muted-foreground mb-4 flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> The agent is working…
          </div>
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-end">
      <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl px-4 py-2 text-sm">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="mb-4 flex justify-start">
      <div className="bg-muted text-foreground w-full max-w-[80%] rounded-2xl px-4 py-2">
        <AssistantParts />
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="border-border flex items-end gap-2 border-t p-4">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Message the research agent…"
        className="border-border focus-visible:ring-ring flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
      />
      <ComposerPrimitive.Send className="bg-primary text-primary-foreground inline-flex h-9 w-9 items-center justify-center rounded-md transition-opacity disabled:opacity-50">
        <ArrowUp className="h-4 w-4" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
}
