import type { Slot } from '../api/types';

export const SLOT_LABEL: Record<Slot, string> = {
  PUTT_AND_APPROACH: 'Putt & approach',
  MIDRANGE: 'Midrange',
  FAIRWAY_DRIVER: 'Fairway driver',
  DISTANCE_DRIVER: 'Distance driver',
};

/** Flight numbers can arrive as decimals (e.g. -0.5); keep them compact. */
export const num = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Signed form, for flight deltas. */
export const delta = (value: number) => `${value > 0 ? '+' : ''}${num(value)}`;

/**
 * Whether a retrieval mode's `similarity` figures are real cosine similarities.
 *
 * When the embedding service is unavailable the server falls back to
 * flight-number search, and the score it reports there is not a similarity —
 * it can be negative. Showing it as "-12% match" is worse than showing nothing.
 */
export const isVectorRetrieval = (mode: string) => mode === 'VECTOR_SIMILARITY';

/**
 * Weights discs are actually sold at, offered as a datalist so the weight field
 * stays free text — most players know the number stamped on the disc.
 */
export const COMMON_DISC_GRAMS = [
  150, 155, 160, 165, 167, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180,
];
