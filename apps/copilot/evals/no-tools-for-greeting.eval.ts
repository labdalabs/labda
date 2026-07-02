import { defineEval } from 'eve/evals';

// A plain greeting should not trigger any challenge tool — the copilot only
// reaches for tools when asked to challenge something.
export default defineEval({
  async test(t) {
    await t.send('Hello!');
    t.succeeded();
    t.notCalledTool('challenge_hypothesis');
    t.notCalledTool('challenge_protocol');
  },
});
