import { defineAgent } from 'eve';

// The antagonistic research copilot (issue #10). Its tools call the labda
// GraphQL API's grounded challenge engine, so every push-back the agent makes
// is backed by a real Reference quote or a concrete gap — no vibes.
//
// Model routes through the **Vercel AI Gateway** only — set AI_GATEWAY_API_KEY
// (or run `vercel link` for a VERCEL_OIDC_TOKEN). No direct provider key.
export default defineAgent({
  // A bare model-id string is resolved by eve at runtime via the AI SDK default
  // provider. The cast bridges the workspace's older `ai` LanguageModel type
  // (pinned to v4 for the assistant-ui path) with eve's newer expectation.
  model:
    'anthropic/claude-sonnet-4.6' as unknown as Parameters<
      typeof defineAgent
    >[0]['model'],
});
