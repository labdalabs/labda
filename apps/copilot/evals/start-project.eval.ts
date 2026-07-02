import { defineEval } from 'eve/evals';

// Asking the agent to start a project must drive the start_project tool.
export default defineEval({
  async test(t) {
    await t.send('Start a new project called "Yield study".');
    t.succeeded();
    t.calledTool('start_project');
  },
});
