import { connectSlackCredentials } from '@vercel/connect/eve';
import { slackChannel } from 'eve/channels/slack';

// Slack channel for the Labda research agent: answers @mentions and DMs in the
// workspace, in-thread. Credentials run through Vercel Connect (no
// SLACK_BOT_TOKEN / SLACK_SIGNING_SECRET to manage) — see this repo's
// apps/copilot/README.md for the one-time `vercel connect` setup.
//
// The agent's tools are the grounded challenge/knowledge/new-papers engine, so
// Slack answers stay evidence-grounded. The daily digest (agent/schedules) can
// post proactively into a thread via `receive(slack, ...)`.
export default slackChannel({
  credentials: connectSlackCredentials('slack/labda'),
  // See only direct mentions unless a thread needs prior context; enable
  // `threadContext` here if the agent should read the surrounding thread.
});
