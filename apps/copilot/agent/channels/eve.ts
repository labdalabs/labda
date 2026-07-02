import { eveChannel } from 'eve/channels/eve';
import { httpBasic, localDev } from 'eve/channels/auth';

// Route-auth for the EVE HTTP channel. EVE fails closed in production, so we
// set a real policy: HTTP Basic (shared secret) for deployed traffic, and
// `localDev()` so `eve dev` and the local e2e stay open on localhost.
//
// The labda web app reaches this agent server-to-server through its /api/eve
// proxy, which attaches the same Basic credential. Set in production:
//   EVE_BASIC_USER      (default "labda")
//   EVE_BASIC_PASSWORD  (required in prod — a strong shared secret)
const password = process.env.EVE_BASIC_PASSWORD;

export default eveChannel({
  auth: [
    ...(password
      ? [httpBasic({ username: process.env.EVE_BASIC_USER ?? 'labda', password })]
      : []),
    localDev(),
  ],
});
