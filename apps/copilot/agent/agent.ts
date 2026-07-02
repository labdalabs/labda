import { defineAgent } from 'eve';

// The antagonistic research copilot (issue #10). Its tools call the labda
// GraphQL API's grounded challenge engine, so every push-back the agent makes
// is backed by a real Reference quote or a concrete gap — no vibes.
//
// Model: the scaffold default routes through the Vercel AI Gateway and needs
// AI_GATEWAY_API_KEY (or `vercel link` for VERCEL_OIDC_TOKEN). To use Anthropic
// directly instead, swap this for `anthropic('claude-...')` from
// `@ai-sdk/anthropic` and set ANTHROPIC_API_KEY.
export default defineAgent({
  // A bare model-id string is resolved by eve at runtime via the AI SDK default
  // provider. The cast bridges the workspace's older `ai` LanguageModel type
  // (pinned to v4 for the assistant-ui path) with eve's newer expectation.
  model:
    'anthropic/claude-sonnet-4.6' as unknown as Parameters<
      typeof defineAgent
    >[0]['model'],
});
