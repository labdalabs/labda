import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { decode } from 'jsonwebtoken';
import type { JwksClient } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Shape of a verified Supabase access token payload. Supabase local now signs
// access tokens with ES256 (asymmetric, JWKS-served), while legacy/self-hosted
// projects may still use HS256 with the shared JWT secret. We verify both.
interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: string;
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('supabase.jwtSecret');
    if (!jwtSecret) {
      throw new Error('supabase.jwtSecret is not configured');
    }

    // JWKS endpoint for asymmetric (ES256/RS256) verification. jwks-rsa is
    // ESM-only, so it's lazy-required on first asymmetric token — unit tests
    // (HS256-only) never load it, and the runtime bundles it via webpack.
    const supabaseUrl = configService.get<string>('supabase.url') ?? '';
    let jwksClient: JwksClient | undefined;
    const getJwksClient = (): JwksClient => {
      if (!jwksClient) {
        const { JwksClient: JwksClientCtor } = require('jwks-rsa');
        jwksClient = new JwksClientCtor({
          jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
          cache: true,
          cacheMaxEntries: 5,
          cacheMaxAge: 10 * 60 * 1000,
          rateLimit: true,
        });
      }
      return jwksClient as JwksClient;
    };

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256', 'RS256'],
      // Choose the verification key based on the token's alg header:
      //   HS* → the shared Supabase JWT secret
      //   ES*/RS* → the public key served at the JWKS endpoint (by `kid`)
      secretOrKeyProvider: (
        _request: unknown,
        rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        try {
          const decoded = decode(rawJwtToken, { complete: true });
          const header = decoded?.header;
          if (!header?.alg || header.alg.startsWith('HS')) {
            done(null, jwtSecret);
            return;
          }
          getJwksClient().getSigningKey(header.kid, (err, key) => {
            if (err || !key) {
              done(err ?? new Error('Signing key not found'));
              return;
            }
            done(null, key.getPublicKey());
          });
        } catch (err) {
          done(err as Error);
        }
      },
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'authenticated',
    };
  }
}
