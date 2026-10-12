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
 */
export const PDGA_BANDS: { level: SkillLevel; min: number; max: number | null }[] = [
  { level: 'BEGINNER', min: 0, max: 849 },
  { level: 'INTERMEDIATE', min: 850, max: 899 },
  { level: 'ADVANCED', min: 900, max: 969 },
  { level: 'PROFESSIONAL', min: 970, max: null },
];

/** Outside this, a typed number is almost certainly a typo, not a rating. */
export const MIN_RATING = 200;
export const MAX_RATING = 1200;

export function levelForRating(rating: number): SkillLevel {
  const band = PDGA_BANDS.find((b) => rating >= b.min && (b.max === null || rating <= b.max));
  return band?.level ?? 'BEGINNER';
}

/** The rating text as a number, or null when it is not a plausible rating. */
export function parseRating(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{3,4}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= MIN_RATING && n <= MAX_RATING ? n : null;
}

export function rangeLabel(level: SkillLevel): string {
  const band = PDGA_BANDS.find((b) => b.level === level);
  if (!band) return '';
  if (band.max === null) return `${band.min}+`;
  return band.min === 0 ? `under ${band.max + 1}` : `${band.min}–${band.max}`;
}
