import type {
  BagLineupResponse,
  BagProfileDetail,
  BagProfileSummary,
  BagSummary,
  Disc,
  Plastic,
  SaveProfileRequest,
  ProblemDetail,
  RecommendationRequest,
  RecommendationResponse,
  Weather,
  WeatherReport,
} from './types';
import { WEATHERS } from './types';
import { getAccessToken, supabase } from '../lib/supabase';

/**
 * Empty by default: requests go to the same origin and Vite proxies /api to the
 * backend in dev (see vite.config.ts), which keeps the BAGTIPS_SESSION cookie
 * first-party and sidesteps CORS. Set VITE_API_BASE_URL to point at a deployed
 * API instead.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = await getAccessToken();
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      // Carries the session cookie the API sets.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the bag analysis service. Is the API running on port 8080?');
  }

  if (!res.ok) {
    // A token the API rejects must not keep being sent: retrying anonymously would
    // quietly save the next bag to the session instead of the account.
    if (res.status === 401 && token) {
      await supabase?.auth.signOut();
      throw new ApiError('Your sign-in expired. Please sign in again.', 401);
    }
    let message = `Request failed (${res.status}).`;
    try {
      const problem = (await res.json()) as ProblemDetail;
      // The API speaks RFC 7807; prefer its own wording.
      if (problem.detail || problem.title) message = problem.detail ?? problem.title ?? message;
    } catch {
      /* not problem+json — keep the status message */
    }
    if (res.status === 429) message = 'Rate limited by the API. Give it a moment and try again.';
    throw new ApiError(message, res.status);
  }

  // 204 No Content (profile deletes) has no body to parse.
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return (await res.json()) as T;
}

/* ---------------------------------------------------------------- catalog */

export async function searchDiscs(
  query: string,
  { limit = 12, signal }: { limit?: number; signal?: AbortSignal } = {},
): Promise<Disc[]> {
  const q = query.trim();
  // The catalog search requires a term and returns [] for an empty one.
  if (!q) return [];
  const params = new URLSearchParams({ q, limit: String(limit) });
  return await request<Disc[]>(`/api/v1/discs/search?${params}`, { signal });
}

/**
 * Plastic blends for a brand. The API returns that manufacturer's blends plus
 * the universal ones, so it is the right list to offer for a given disc.
 * Cached per brand: the catalog is small and static within a session.
 */
const plasticCache = new Map<string, Promise<Plastic[]>>();

export function getPlastics(brand: string, { signal }: { signal?: AbortSignal } = {}): Promise<Plastic[]> {
  const key = brand.trim().toLowerCase();
  const cached = plasticCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ brand: brand.trim() });
  const pending = request<Plastic[]>(`/api/v1/plastics?${params}`, { signal }).catch((err: unknown) => {
    // Don't cache a failure — a later open should retry.
    plasticCache.delete(key);
    throw err;
  });
  plasticCache.set(key, pending);
  return pending;
}

/* --------------------------------------------------------------- bag models */

/**
 * Physical bag models. Filters are all optional: `capacity` returns only bags
 * rated for at least that many discs, which is what the bag picker uses once a
 * bag is being built.
 */
export function getBags(
  { capacity, brand, type, signal }: { capacity?: number; brand?: string; type?: string; signal?: AbortSignal } = {},
): Promise<BagSummary[]> {
  const params = new URLSearchParams();
  if (capacity !== undefined) params.set('capacity', String(capacity));
  if (brand) params.set('brand', brand);
  if (type) params.set('type', type);
  const query = params.toString();
  return request<BagSummary[]>(`/api/v1/bags${query ? `?${query}` : ''}`, { signal });
}

export function getBagBrands({ signal }: { signal?: AbortSignal } = {}): Promise<string[]> {
  return request<string[]>('/api/v1/bags/brands', { signal });
}

export function getBag(id: number, { signal }: { signal?: AbortSignal } = {}): Promise<BagSummary> {
  return request<BagSummary>(`/api/v1/bags/${id}`, { signal });
}

/* ----------------------------------------------------------------- profiles */

/**
 * Named saved bags.
 *
 * These are keyed by the BAGTIPS_SESSION cookie server-side, not by a user
 * account — the API exposes no authentication. A profile is therefore invisible
 * to another browser or device (verified: a second client with no cookie gets an
 * empty list and a 404 loading by id), and goes away with the cookie. The bag
 * file export remains the only way to move a bag between devices.
 */
export function listProfiles({ signal }: { signal?: AbortSignal } = {}): Promise<BagProfileSummary[]> {
  return request<BagProfileSummary[]>('/api/v1/profiles', { signal });
}

export function saveProfile(
  body: SaveProfileRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<BagProfileDetail> {
  return request<BagProfileDetail>('/api/v1/profiles', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

export function loadProfile(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<BagProfileDetail> {
  return request<BagProfileDetail>(`/api/v1/profiles/${encodeURIComponent(id)}`, { signal });
}

export async function deleteProfile(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<void> {
  await request<void>(`/api/v1/profiles/${encodeURIComponent(id)}`, { method: 'DELETE', signal });
}

/** Manufacturers in the catalog. These names are what `filters.brands` accepts. */
export function getBrands({ signal }: { signal?: AbortSignal } = {}): Promise<string[]> {
  return request<string[]>('/api/v1/brands', { signal });
}

/** One catalog record by id — used when adding a disc the API named for us. */
export function getDisc(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<Disc> {
  return request<Disc>(`/api/v1/discs/${encodeURIComponent(id)}`, { signal });
}

/* -------------------------------------------------------- recommendations */

export function getRecommendation(
  body: RecommendationRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<RecommendationResponse> {
  return request<RecommendationResponse>('/api/v1/recommendations', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Runs the analysis once per weather so the environment toggle switches between
 * finished answers instead of firing a request per tap. The bag and profile are
 * identical across the five; only `conditions.weather` differs.
 */
export async function getWeatherReport(
  body: Omit<RecommendationRequest, 'conditions'>,
  { signal }: { signal?: AbortSignal } = {},
): Promise<WeatherReport> {
  const responses = await Promise.all(
    WEATHERS.map((weather) => getRecommendation({ ...body, conditions: { weather } }, { signal })),
  );
  return Object.fromEntries(
    WEATHERS.map((weather, i) => [weather, responses[i]]),
  ) as Record<Weather, RecommendationResponse>;
}

/* ------------------------------------------------------------------ lineup */

/**
 * The bag slot by slot, with per-gap suggestions.
 *
 * Replaces an earlier client-side workaround that re-asked /recommendations
 * with each pick added to walk across the slots. This is one call, it covers
 * every slot rather than the top four gaps, and it honours `filters`.
 *
 * It does not call the reasoning model, so there is no prose per gap — and it
 * can be slow when the embedding service is down and retrieval falls back.
 */
export function getLineup(
  body: RecommendationRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<BagLineupResponse> {
  return request<BagLineupResponse>('/api/v1/lineup', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

/* ---------------------------------------------------------------- account */

export interface ClaimResult {
  moved: number;
  renamed: number;
  leftBehind: number;
}

/** Moves bags saved while anonymous onto the signed-in account. Safe to repeat. */
export function claimSession(): Promise<ClaimResult> {
  return request<ClaimResult>('/api/v1/account/claim-session', { method: 'POST' });
}
