import { eveChannel } from 'eve/channels/eve';
import { extractBearerToken, localDev, type AuthFn } from 'eve/channels/auth';

// Route-auth for the EVE HTTP channel. The agent acts as the *signed-in
// researcher*: the labda web app forwards the user's Supabase access token as a
// Bearer (via its /eve/v1 proxy, which reads the token server-side from the
// session cookie). We verify that token against Supabase and, on success,
// return a session-auth context carrying the token so tools can call the labda
// API as the caller (see `callerToken` in lib/labda.ts).
//
// Env (production):
//   SUPABASE_URL        the project URL (e.g. https://<ref>.supabase.co)
//   SUPABASE_ANON_KEY   anon apikey (required by the /auth/v1/user endpoint)
//
// `localDev()` keeps `eve dev` and the local e2e open on loopback hosts.
function supabaseAuth(): AuthFn<Request> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  return async (request) => {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token || !supabaseUrl || !anonKey) return null; // skip → next entry
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null; // invalid/expired token → skip (walk 401s)
    const user = (await res.json()) as { id?: string; email?: string };
    if (!user.id) return null;
    return {
      // Surfaces at ctx.session.auth.current.attributes in tools.
      attributes: { token, email: user.email ?? '' },
      authenticator: 'supabase',
      principalId: user.id,
      principalType: 'user',
    };
  };
}

export default eveChannel({
  auth: [supabaseAuth(), localDev()],
});
