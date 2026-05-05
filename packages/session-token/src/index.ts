import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// TTL for all session tokens: 95 minutes in seconds.
const SESSION_TOKEN_TTL_S = 95 * 60;

export type BudgetTier = 'standard' | 'extended' | 'long-context';

/**
 * The full set of claims embedded in every session token.
 * Standard JWT fields (iss, aud, sub, sid, iat, exp) plus our custom claims.
 */
export interface SessionTokenClaims {
  /** Issuer — always "claudekloud-proxy" */
  iss: string;
  /** Audience — always "claudekloud-lab" */
  aud: string;
  /** Subject — Clerk user ID */
  sub: string;
  /** Session ID (UUID) */
  sid: string;
  /** Lab ID */
  lab: string;
  /** Token budget tier */
  budget_tier: BudgetTier;
  /**
   * If set, the proxy MUST reject any request that specifies a model other
   * than this value. Enforcement lives in PR-LR-07; the claim is accepted now
   * so we don't need a breaking schema change later.
   */
  model_pin?: string;
  /**
   * Additional models permitted beyond the global allowlist.
   * Currently unused at runtime but accepted in the claim set for
   * forward-compatibility.
   */
  extra_models?: string[];
}

/**
 * Input shape for minting a new session token.
 * iss, aud, iat, and exp are injected automatically.
 */
export type IssueSessionTokenInput = Pick<
  SessionTokenClaims,
  'sub' | 'sid' | 'lab' | 'budget_tier' | 'model_pin' | 'extra_models'
>;

/**
 * Verified payload returned from verifySessionToken.
 * We narrow the generic JWTPayload to our own claim set.
 */
export type VerifiedSessionToken = SessionTokenClaims & {
  iat: number;
  exp: number;
};

const ISSUER = 'claudekloud-proxy';
const AUDIENCE = 'claudekloud-lab';

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Mint a signed HS256 JWT with a 95-minute TTL.
 * Uses jose's SignJWT which produces a compact serialization.
 */
export async function issueSessionToken(
  claims: IssueSessionTokenInput,
  secret: string,
): Promise<string> {
  const payload: Record<string, unknown> = {
    sid: claims.sid,
    lab: claims.lab,
    budget_tier: claims.budget_tier,
  };

  if (claims.model_pin !== undefined) {
    payload['model_pin'] = claims.model_pin;
  }
  if (claims.extra_models !== undefined && claims.extra_models.length > 0) {
    payload['extra_models'] = claims.extra_models;
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TOKEN_TTL_S}s`)
    .sign(encodeSecret(secret));

  return token;
}

/**
 * Verify a session token.
 * jose's jwtVerify performs constant-time signature comparison internally.
 * Throws a JWTExpired / JWSSignatureVerificationFailed / etc. on failure.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<VerifiedSessionToken> {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  });

  return extractClaims(payload);
}

function extractClaims(payload: JWTPayload): VerifiedSessionToken {
  const sid = payload['sid'];
  const lab = payload['lab'];
  const budget_tier = payload['budget_tier'];
  const model_pin = payload['model_pin'];
  const extra_models = payload['extra_models'];

  if (typeof sid !== 'string') {
    throw new Error('session token missing sid claim');
  }
  if (typeof lab !== 'string') {
    throw new Error('session token missing lab claim');
  }
  if (budget_tier !== 'standard' && budget_tier !== 'extended' && budget_tier !== 'long-context') {
    throw new Error('session token missing or invalid budget_tier claim');
  }
  if (typeof payload.sub !== 'string') {
    throw new Error('session token missing sub claim');
  }
  if (typeof payload.iss !== 'string') {
    throw new Error('session token missing iss claim');
  }
  if (typeof payload.iat !== 'number') {
    throw new Error('session token missing iat claim');
  }
  if (typeof payload.exp !== 'number') {
    throw new Error('session token missing exp claim');
  }

  const result: VerifiedSessionToken = {
    iss: payload.iss,
    aud: AUDIENCE,
    sub: payload.sub,
    sid,
    lab,
    budget_tier,
    iat: payload.iat,
    exp: payload.exp,
  };

  if (typeof model_pin === 'string') {
    result.model_pin = model_pin;
  }
  if (Array.isArray(extra_models)) {
    result.extra_models = extra_models as string[];
  }

  return result;
}
