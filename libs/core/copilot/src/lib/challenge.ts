// Deterministic, evidence-grounded challenge engine for the antagonistic
// copilot. Every finding is grounded by construction — it links a specific
// Reference (with a quoted sentence) or names a concrete logic gap / missing
// control. No free-form generation: no vibes-based output.
//
// This is the "naive supports/contradicts split" (issue #10); deeper
// hypothesis-specific reasoning is a fast-follow.

export type FindingKind =
  | 'contradicts'
  | 'supports'
  | 'logic_gap'
  | 'missing_step';

export interface Finding {
  kind: FindingKind;
  summary: string;
  referenceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  quote?: string;
}

export interface ReferenceInput {
  id: string;
  title: string;
  abstract?: string | null;
  url?: string | null;
}

// Cues are checked in order; contradiction cues win over support cues so
// "did not increase" reads as a contradiction, not a support.
const CONTRADICTION_CUES = [
  'no significant',
  'did not',
  "didn't",
  'do not',
  'does not',
  'not increase',
  'no effect',
  'no evidence',
  'failed',
  'fails to',
  'contrary',
  'contradict',
  'unlike',
  'no change',
  'not associated',
  'no association',
  'not affect',
  'without effect',
  'decreas',
  'reduc',
  'lower',
  'inhibit',
  'suppress',
  'negativ',
];

const SUPPORT_CUES = [
  'increas',
  'improv',
  'enhanc',
  'higher',
  'confirm',
  'consistent with',
  'support',
  'demonstrat',
  'promot',
  'positiv',
  'associated with',
  'effective',
  'significant increase',
];

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'will', 'would',
  'when', 'what', 'which', 'these', 'those', 'their', 'there', 'been', 'were',
  'into', 'more', 'than', 'then', 'they', 'them', 'such', 'some', 'over',
]);

function terms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  );
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function overlaps(sentence: string, hypoTerms: string[]): number {
  const low = sentence.toLowerCase();
  return hypoTerms.filter((t) => low.includes(t.slice(0, 5))).length;
}

// Classify one Reference's stance toward the Hypothesis. Returns a grounded
// finding (with the quoted sentence) or null if the Reference doesn't clearly
// bear on the claim.
export function classifyReference(
  hypothesis: string,
  ref: ReferenceInput,
): Finding | null {
  const hypoTerms = terms(hypothesis);
  const text = [ref.title, ref.abstract ?? ''].join('. ');
  const candidates = sentences(text)
    .map((s) => ({ s, score: overlaps(s, hypoTerms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { s } of candidates) {
    const low = s.toLowerCase();
    if (CONTRADICTION_CUES.some((c) => low.includes(c))) {
      return {
        kind: 'contradicts',
        summary: `"${ref.title}" appears to contradict this Hypothesis.`,
        referenceId: ref.id,
        sourceTitle: ref.title,
        sourceUrl: ref.url ?? undefined,
        quote: s,
      };
    }
    if (SUPPORT_CUES.some((c) => low.includes(c))) {
      return {
        kind: 'supports',
        summary: `"${ref.title}" appears to support this Hypothesis.`,
        referenceId: ref.id,
        sourceTitle: ref.title,
        sourceUrl: ref.url ?? undefined,
        quote: s,
      };
    }
  }
  return null;
}

export function classifyReferences(
  hypothesis: string,
  refs: ReferenceInput[],
): Finding[] {
  return refs
    .map((r) => classifyReference(hypothesis, r))
    .filter((f): f is Finding => f !== null);
}

// Logic/knowledge-gap detection on a Hypothesis statement. Each gap is a
// concrete, grounded push-back (a named missing element).
export function detectHypothesisGaps(hypothesis: string): Finding[] {
  const low = hypothesis.toLowerCase();
  const gaps: Finding[] = [];
  if (!/control|comparison|compared|versus|\bvs\b|placebo|baseline/.test(low)) {
    gaps.push({
      kind: 'logic_gap',
      summary:
        'No control or comparison group is specified — a result could not be attributed to the manipulation.',
    });
  }
  if (!/because|via|through|mechanism|mediat|due to|driv/.test(low)) {
    gaps.push({
      kind: 'logic_gap',
      summary:
        'No mechanism is proposed — the Hypothesis states an association but not why it would hold.',
    });
  }
  return gaps;
}

// Missing-step detection over a Protocol notebook's combined cell text.
export function detectProtocolGaps(notebookText: string): Finding[] {
  const low = notebookText.toLowerCase();
  const gaps: Finding[] = [];
  if (!/control/.test(low)) {
    gaps.push({
      kind: 'missing_step',
      summary: 'No control condition appears anywhere in the Protocol.',
    });
  }
  if (!/replicat|\bn\s*=|repeat|sample size/.test(low)) {
    gaps.push({
      kind: 'missing_step',
      summary: 'No replication or sample size is specified in the Protocol.',
    });
  }
  if (!/random/.test(low)) {
    gaps.push({
      kind: 'missing_step',
      summary: 'No randomization step is described in the Protocol.',
    });
  }
  if (!/stat|p-value|p <|p<|significan|t-test|anova|regression/.test(low)) {
    gaps.push({
      kind: 'missing_step',
      summary: 'No statistical analysis step is described in the Protocol.',
    });
  }
  return gaps;
}
