import { defineEval } from 'eve/evals';

// Asking the copilot to challenge a Hypothesis must drive the grounded
// `challenge_hypothesis` tool (no answering from memory).
//
// Requires a live model credential and a seeded Hypothesis id
// (LABDA_EVAL_HYPOTHESIS_ID) with the labda API running — see issue #18, which
// grows this into a full eval suite over the agent's research flows.
const hypothesisId =
  process.env.LABDA_EVAL_HYPOTHESIS_ID ??
  '00000000-0000-4000-8000-000000000001';

export default defineEval({
  async test(t) {
    await t.send(`Challenge hypothesis ${hypothesisId}. Find any contradictions.`);
    t.succeeded();
    t.calledTool('challenge_hypothesis');
  },
});
