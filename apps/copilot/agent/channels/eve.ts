import { eveChannel } from 'eve/channels/eve';
import {
  extractBearerToken,
  localDev,
  verifyOidc,
  type AuthFn,
} from 'eve/channels/auth';

// Route-auth for the EVE HTTP channel. The agent acts as the *signed-in
// researcher*: the labda web app forwards the user's Supabase access token as a
// Bearer (its /eve/v1 proxy reads the token server-side from the session
// cookie). We verify that token's signature against the Supabase project's
// JWKS (OIDC discovery) and, on success, carry the raw token on the session
// auth so tools can call the labda API as the caller (see `callerToken` in
// lib/labda.ts). Supabase issues ES256 JWTs; verification is asymmetric, so no
// shared secret or anon key is needed — only the project URL.
//
// Env (production):
//   SUPABASE_URL   the project URL (e.g. https://<ref>.supabase.co)
//
// `localDev()` keeps `eve dev` and the local e2e open on loopback hosts.
function supabaseAuth(): AuthFn<Request> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined;
  return async (request) => {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token || !issuer) return null; // skip → next entry
    const result = await verifyOidc(token, {
      issuer,
      audiences: ['authenticated'],
    });
    if (!result.ok) return null; // bad signature/claims → skip (walk 401s)
    // Carry the raw token so tools can call the API as this researcher; it
    // surfaces at ctx.session.auth.current.attributes.token.
    return {
      ...result.sessionAuth,
      attributes: { ...result.sessionAuth.attributes, token },
    };
  };
}

export default eveChannel({
  auth: [supabaseAuth(), localDev()],
});
