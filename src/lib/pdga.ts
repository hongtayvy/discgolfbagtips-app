import type { SkillLevel } from '../api/types';

/**
 * PDGA player rating → the four skill levels the API understands.
 *
 * PDGA's own ratings-based divisions top out at 800, 850, 900, 935 and 970, with
 * 970+ being its Professional division (https://www.pdga.com/divisions). The API
 * only takes four levels, so those are grouped at the round numbers 850, 900 and
 * 970. That grouping is this app's judgement, not PDGA's: PDGA publishes
 * division ceilings, not "beginner" or "advanced". The UI shows the cutoffs and
 * keeps the level buttons, so a rating is a convenience and never a trap.
 *
 * The top level is split for display only: 970–999 reads as a local pro and
 * 1000+ as a touring pro. Both send PROFESSIONAL, because the API has no finer
 * level than that.
 */
export interface PdgaTier {
  name: string;
  level: SkillLevel;
  min: number;
  max: number | null;
}

export const PDGA_TIERS: PdgaTier[] = [
  { name: 'Beginner', level: 'BEGINNER', min: 0, max: 849 },
  { name: 'Intermediate', level: 'INTERMEDIATE', min: 850, max: 899 },
  { name: 'Advanced', level: 'ADVANCED', min: 900, max: 969 },
  { name: 'Local pro', level: 'PROFESSIONAL', min: 970, max: 999 },
  { name: 'Touring pro', level: 'PROFESSIONAL', min: 1000, max: null },
];

/** Outside this, a typed number is almost certainly a typo, not a rating. */
export const MIN_RATING = 200;
export const MAX_RATING = 1200;

export function tierForRating(rating: number): PdgaTier {
  return PDGA_TIERS.find((t) => rating >= t.min && (t.max === null || rating <= t.max)) ?? PDGA_TIERS[0];
}

export function levelForRating(rating: number): SkillLevel {
  return tierForRating(rating).level;
}

/** The rating text as a number, or null when it is not a plausible rating. */
export function parseRating(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{3,4}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_RATING && n <= MAX_RATING ? n : null;
}

export function rangeLabel(tier: PdgaTier): string {
  if (tier.max === null) return `${tier.min}+`;
  return tier.min === 0 ? `under ${tier.max + 1}` : `${tier.min}–${tier.max}`;
}
