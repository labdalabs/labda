import { defineEval } from 'eve/evals';

// Asking to find literature must drive the search_papers tool (not memory).
export default defineEval({
  async test(t) {
    await t.send('Find recent papers about CRISPR crop yield.');
    t.succeeded();
    t.calledTool('search_papers');
  },
});
