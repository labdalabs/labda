'use client';

// A lightweight Python code editor: a syntax-highlighted <pre> under a
// transparent <textarea>. The textarea stays the real, accessible input
// (labels, fill, selection all work); the pre is purely presentational.
// No editor dependency, perfectly in sync because both render the same
// text with identical font metrics.

const TOKEN =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|@\w+|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?j?\b|\b[A-Za-z_]\w*\b)/g;

const KEYWORDS = new Set([
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in',
  'not', 'and', 'or', 'import', 'from', 'as', 'with', 'try', 'except',
  'finally', 'raise', 'lambda', 'yield', 'pass', 'break', 'continue',
  'global', 'nonlocal', 'assert', 'del', 'is', 'None', 'True', 'False',
  'async', 'await', 'match', 'case',
]);

const BUILTINS = new Set([
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sum',
  'min', 'max', 'abs', 'round', 'sorted', 'reversed', 'list', 'dict',
  'set', 'tuple', 'str', 'int', 'float', 'bool', 'type', 'isinstance',
  'open', 'input', 'super', 'self', 'cls',
]);

// Pastel palette on the deep-slate editor surface — brand-adjacent, calm.
function classify(token: string): string | null {
  if (token.startsWith('#')) return 'text-slate-400 italic';
  if (/^["']/.test(token)) return 'text-amber-200';
  if (token.startsWith('@')) return 'text-violet-300';
  if (/^\d/.test(token)) return 'text-fuchsia-300';
  if (KEYWORDS.has(token)) return 'text-sky-300';
  if (BUILTINS.has(token)) return 'text-emerald-300';
  return null;
}

function highlight(source: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of source.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) nodes.push(source.slice(last, i));
    const cls = classify(m[0]);
    nodes.push(
      cls ? (
        <span key={key++} className={cls}>
          {m[0]}
        </span>
      ) : (
        m[0]
      ),
    );
    last = i + m[0].length;
  }
  if (last < source.length) nodes.push(source.slice(last));
  return nodes;
}

const METRICS =
  'whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-6';

export function PythonEditor({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-h-16 bg-slate-900">
      <pre aria-hidden className={`${METRICS} pointer-events-none text-slate-100`}>
        {highlight(value)}
        {'\n'}
      </pre>
      <textarea
        className={`${METRICS} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-white outline-none selection:bg-sky-500/30`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
    </div>
  );
}
