'use client';

import remarkGfm from 'remark-gfm';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';

// Renders assistant message text as GitHub-flavored markdown. The agent replies
// with bold, lists, tables, and code, so plain text would read poorly.
const MARKDOWN_CLASS = [
  'text-sm leading-relaxed',
  '[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold',
  '[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_strong]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
  '[&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-background [&_pre]:p-2',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
  '[&_td]:border [&_td]:px-2 [&_td]:py-1',
].join(' ');

export function MarkdownText() {
  return (
    <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} className={MARKDOWN_CLASS} />
  );
}
