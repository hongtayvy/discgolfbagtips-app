/**
 * Wire types for the Disc Golf Bag Tips API (Spring Boot, /api/v1).
 *
 * Mirrors the server's OpenAPI schemas — see http://localhost:8080/v3/api-docs.
 * Endpoints consumed:
 *   GET  /api/v1/discs/search?q=<query>&limit=<n>  -> Disc[]
 *   POST /api/v1/recommendations                   -> RecommendationResponse
 *
 * Enum values are the server's uppercase constants; display labels live in the
 * components. Session continuity is the BAGTIPS_SESSION cookie, so requests are
 * sent with credentials.
 */

export type Slot = 'PUTT_AND_APPROACH' | 'MIDRANGE' | 'FAIRWAY_DRIVER' | 'DISTANCE_DRIVER';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';
export type ThrowingStyle = 'BACKHAND' | 'FOREHAND' | 'BOTH';
export type CourseType = 'WOODED' | 'OPEN' | 'MIXED';

/** The server models conditions as one weather enum rather than separate axes. */
export type Weather = 'HOT' | 'NORMAL' | 'RAINY' | 'COLD' | 'WINDY';

export const WEATHERS: readonly Weather[] = ['HOT', 'NORMAL', 'RAINY', 'COLD', 'WINDY'];

export interface FlightNumbers {
  speed: number;
  glide: number;
  turn: number;
  fade: number;
}

/** `DiscSummary` from the catalog search. `stability` is a display string. */
export interface Disc extends FlightNumbers {
  id: string;
  name: string;
  brand: string;
  category: string;
  stability: string;
  slot: Slot;
  imageUrl?: string;
}

/** How beaten-in a disc is. Wear moves effective stability more than plastic. */
export type Wear = 'NEW' | 'SEASONED' | 'BEAT_IN' | 'WELL_WORN';

export const WEARS: readonly Wear[] = ['NEW', 'SEASONED', 'BEAT_IN', 'WELL_WORN'];

/** `PlasticSummary` — a blend from the catalog. */
export interface Plastic {
  id: number;
  brand: string;
  name: string;
  slug: string;
  family: string;
  /** Signed shift applied to the disc's published stability. */
  stabilityShift: number;
  /** 1..5 */
  durability: number;
  /** 1..5 */
  grip: number;
  description: string;
}

export interface PlayerProfile {
  skillLevel: SkillLevel;
  throwingStyle: ThrowingStyle;
  courseType: CourseType;
}

/**
 * `BagDiscRequest`. Plastic, weight and wear are optional; the server folds
 * each into an effective stability that can differ sharply from the published
 * numbers — a beat-in base-plastic midrange resolves several steps understable.
 * An unrecognised plastic name is silently ignored server-side, so only send
 * values that came from the plastics catalog.
 */
export interface BagDiscRequest {
  discId: string;
  plastic?: string;
  weightGrams?: number;
  wear?: Wear;
}

/** A disc in the bag, plus how this player owns it. */
export interface BagEntry extends Disc {
  plastic?: string;
  weightGrams?: number;
  wear?: Wear;
}

/** Narrows what the pipeline may recommend. Applies to both endpoints. */
export interface RecommendationFilters {
  /** Only these manufacturers. Names must come from `GET /api/v1/brands`. */
  brands?: string[];
  excludeBrands?: string[];
  /** 1..20. Useful for capping at what a player can actually bring up to speed. */
  maxSpeed?: number;
}

/** Which physical bag the discs are being carried in. */
export interface CarriedBag {
  bagModelId: number;
  brand?: string | null;
  model?: string | null;
}

export interface RecommendationRequest {
  bag: BagDiscRequest[];
  profile: PlayerProfile;
  conditions: { weather: Weather };
  filters?: RecommendationFilters;
  carriedBag?: CarriedBag;
}

/* -------------------------------------------------------------- response */

export interface RecommendedDisc extends FlightNumbers {
  discId: string;
  name: string;
  brand: string;
  category: string;
  stability: string;
  slot: Slot;
  imageUrl?: string;
  sourceUrl?: string;
  headline: string;
  summary: string;
  reasoning: string[];
  whenToThrowIt?: string;
  plasticAdvice?: string;
  weightAdvice?: string;
  suggestedWeightRange?: string;
  confidence: number;
}

export interface AlternativeDisc extends FlightNumbers {
  discId: string;
  name: string;
  brand: string;
  stability: string;
  imageUrl?: string;
  similarity: number;
  rank: number;
  whyItWasConsidered: string;
}

export interface ResolvedBagDisc extends FlightNumbers {
  discId: string;
  name: string;
  brand: string;
  plastic: string | null;
  weightGrams: number | null;
  weightClass: string;
  wear: string;
  slot: Slot;
  stability: string;
  publishedStability: string;
  /** Signed contributions folded into `effectiveStabilityIndex`. */
  plasticStabilityShift: number;
  weightStabilityShift: number;
  wearStabilityShift: number;
  effectiveStabilityIndex: number;
  stabilityExplanation: string;
}

export interface BagAnalysisSummary {
  discCount: number;
  /** 0..100 */
  coverageScore: number;
  /** "MIDRANGE/STABLE" -> count */
  coverage: Record<string, number>;
  notes: string[];
  unresolvedEntries: string[];
  resolvedBag: ResolvedBagDisc[];
  redundancies: RedundancyReport[];
}

export interface NearestBagDisc {
  discId: string;
  name: string;
  brand: string;
  plastic: string | null;
  weightGrams: number | null;
  wear: string;
  flight: FlightNumbers;
  plays: string;
  stability: string;
}

export interface FlightGapExplanation {
  slot: Slot;
  /** Uppercase stability class, e.g. STABLE, VERY_OVERSTABLE. */
  stabilityClass: string;
  kind: string;
  /** Larger is worse; the server does not bound this. */
  severity: number;
  reason: string;
  target: FlightNumbers;
  targetWeightRange?: string;
  targetWeightRationale?: string;
  nearestInBag?: NearestBagDisc;
  delta?: FlightNumbers;
  /** True for the gap the recommendation was chosen against. */
  selected: boolean;
}

export interface VectorMatch {
  rank: number;
  discId: string;
  name: string;
  brand: string;
  similarity: number;
  distance: number;
  matchedDescriptors: string[];
  deltaVsGapTarget?: FlightNumbers;
  passageExcerpt?: string;
  chosen: boolean;
}

export interface Explainability {
  retrievalMode: string;
  retrievalQuery: string;
  appliedFilters?: string;
  embedding: { provider: string; model: string; dimensions: number; stubbed: boolean };
  generation: { provider: string; model: string; source: string; note?: string; stubbed: boolean };
  vectorMatches: VectorMatch[];
  flightGaps: FlightGapExplanation[];
  citations: string[];
  timings: { analyzeMs: number; retrieveMs: number; generateMs: number; totalMs: number };
  degradations: string[];
}

export interface RecommendationResponse {
  sessionId: string;
  generatedAt: string;
  recommendation: RecommendedDisc;
  alternatives: AlternativeDisc[];
  analysis: BagAnalysisSummary;
  explainability: Explainability;
}

/** One analysis per weather, computed together so the toggle is instant. */
export type WeatherReport = Record<Weather, RecommendationResponse>;

/** RFC 7807 problem+json, which is what this API returns on errors. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

/* ------------------------------------------------------------------ lineup */
/* POST /api/v1/lineup — the bag slot by slot. Structural rather than generated:
   it does not call the reasoning model, so there is no prose per gap. */

export type SlotStatus = 'COMPLETE' | 'THIN' | 'EMPTY';

export interface StabilityCell {
  stabilityClass: string;
  label: string;
  count: number;
  covered: boolean;
}

export interface SuggestedDisc extends FlightNumbers {
  discId: string;
  name: string;
  brand: string;
  stability: string;
  imageUrl?: string;
  similarity: number;
  deltaVsTarget?: FlightNumbers;
}

export interface SlotGap {
  stabilityClass: string;
  label: string;
  /** Plain-language description of the flight this gap wants. */
  behaviour: string;
  severity: number;
  reason: string;
  target: FlightNumbers;
  targetWeightRange?: string;
  suggestions: SuggestedDisc[];
}

export interface SlotLineup {
  slot: Slot;
  label: string;
  purpose: string;
  minSpeed: number;
  maxSpeed: number;
  status: SlotStatus;
  discCount: number;
  inBag: ResolvedBagDisc[];
  stabilityCoverage: StabilityCell[];
  gaps: SlotGap[];
  redundancies: RedundancyReport[];
  summary: string;
}

export interface LineupExplainability {
  retrievalMode: string;
  /** Human-readable echo of the filters the server applied. */
  appliedFilters: string;
  embedding: { provider: string; model: string; dimensions: number; stubbed: boolean };
  gapsConsidered: number;
  gapsRetrieved: number;
  degradations: string[];
  totalMs: number;
}

export interface BagLineupResponse {
  sessionId: string;
  generatedAt: string;
  coverageScore: number;
  discCount: number;
  slots: SlotLineup[];
  carriedBag: BagSummary | null;
  carryWeight: CarryWeight | null;
  betterFittingBags: BagFit[];
  notes: string[];
  unresolvedEntries: string[];
  explainability: LineupExplainability;
}

/* -------------------------------------------------------------- bag models */

export type BagType = 'BACKPACK' | 'CART' | 'DUFFLE' | 'SHOULDER';

/**
 * A physical bag from the catalog. Several fields are nullable: the catalog is
 * researched per model and not every manufacturer publishes a weight or a
 * minimum capacity.
 */
export interface BagSummary {
  id: number;
  brand: string;
  model: string;
  capacityMin: number | null;
  capacityMax: number | null;
  emptyWeightGrams: number | null;
  emptyWeightPounds: number | null;
  heightIn: number | null;
  widthIn: number | null;
  depthIn: number | null;
  carryOnCompliant: boolean | null;
  buildTier: string | null;
  bagType: BagType | string;
  source: string | null;
  notes: string | null;
}

/** An alternative bag, with the server's own comparison against the current one. */
export interface BagFit {
  bag: BagSummary;
  headroom: number;
  totalCarryGrams: number | null;
  totalCarryPounds: number | null;
  comparison: string;
}

/** Server-computed carry load. Replaces the front end's earlier local estimate. */
export interface CarryWeight {
  bagWeightGrams: number | null;
  discWeightGrams: number;
  totalGrams: number;
  totalPounds: number | null;
  /** True when some disc weights were assumed rather than entered. */
  estimated: boolean;
  assumedWeights: number;
  discCount: number;
  capacity: number | null;
  overpacked: boolean;
  notes: string[];
}

/* ------------------------------------------------------------- redundancy */

/** The API calls this `Disc`; renamed here so it cannot be confused with a
 *  catalog disc, which is a different shape. */
export interface RedundancyDisc {
  discId: string;
  name: string;
  brand: string;
  plastic: string | null;
  weightGrams: number | null;
  wear: string | null;
  plays: string | null;
}

export interface RedundancyReport {
  slot: Slot;
  stabilityClass: string;
  /** e.g. WARNING, NOTE. */
  level: string;
  severity: number;
  /** How far apart the discs are; 0 means effectively interchangeable. */
  separation: number;
  discs: RedundancyDisc[];
  reason: string;
}

/* ---------------------------------------------------------------- profiles */

export interface SaveProfileRequest {
  name: string;
  description?: string;
  bag: RecommendationRequest;
}

export interface BagProfileSummary {
  id: string;
  name: string;
  description: string | null;
  discCount: number;
  bagModelId: number | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
}

export interface BagProfileDetail {
  profile: BagProfileSummary;
  request: RecommendationRequest;
}
