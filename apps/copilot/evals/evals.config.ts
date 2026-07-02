import { defineEvalConfig } from 'eve/evals';

// Shared eval config. A judge model is only needed for LLM-graded assertions;
// the starter evals below assert on tool-call behavior, which needs no judge.
export default defineEvalConfig({});
