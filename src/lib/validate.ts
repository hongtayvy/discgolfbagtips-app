import type {
  BagEntry,
  CourseType,
  PlayerProfile,
  SkillLevel,
  Slot,
  ThrowingStyle,
  Wear,
} from '../api/types';

/**
 * Shape validation for data that comes from outside the running app: imported
 * bag files and restored session storage.
 *
 * Both are untrusted in the same way. A file can be hand-edited, and stored
 * session state can predate a deploy — a bag saved before the API rewrite has a
 * numeric `stability` and lowercase enums, which used to crash the first card
 * that rendered it. Anything that does not match the current shape is rejected
 * rather than coerced, and the caller falls back to a clean default.
 */

export const MAX_BAG_SIZE = 30; // matches the API's BagAnalysisRequest limit
const MAX_TEXT = 120;

const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'] as const;
const STYLES = ['BACKHAND', 'FOREHAND', 'BOTH'] as const;
const COURSES = ['WOODED', 'OPEN', 'MIXED'] as const;
const SLOTS = ['PUTT_AND_APPROACH', 'MIDRANGE', 'FAIRWAY_DRIVER', 'DISTANCE_DRIVER'] as const;
const WEARS = ['NEW', 'SEASONED', 'BEAT_IN', 'WELL_WORN'] as const;

/** The server's accepted range for BagDiscRequest.weightGrams. */
export const MIN_DISC_GRAMS = 100;
export const MAX_DISC_GRAMS = 200;

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
};

export const bounded = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v >= min && v <= max ? v : null;
};

export function parseDisc(raw: unknown): BagEntry | null {
  if (!isObject(raw)) return null;
  const id = text(raw.id);
  const name = text(raw.name);
  const brand = text(raw.brand);
  const slot = oneOf<Slot>(raw.slot, SLOTS);
  const speed = bounded(raw.speed, 1, 20);
  const glide = bounded(raw.glide, 0, 10);
  const turn = bounded(raw.turn, -10, 5);
  const fade = bounded(raw.fade, -2, 10);
  if (!id || !name || !brand || !slot) return null;
  if (speed === null || glide === null || turn === null || fade === null) return null;
  // Optional ownership detail. Absent is meaningful — it means "unspecified",
  // which the server treats as published numbers with no shift — so a bad value
  // is dropped rather than failing the whole disc. The keys are omitted rather
  // than set to undefined, so an unset disc is `{}`-equal to a fresh one.
  const plastic = text(raw.plastic);
  const weightGrams = bounded(raw.weightGrams, MIN_DISC_GRAMS, MAX_DISC_GRAMS);
  const wear = oneOf<Wear>(raw.wear, WEARS);
  const imageUrl = text(raw.imageUrl);

  return {
    id,
    name,
    brand,
    slot,
    speed,
    glide,
    turn,
    fade,
    category: text(raw.category) ?? '',
    // Must be a string: the API ships a display label, and older sessions
    // stored a number here.
    stability: text(raw.stability) ?? '',
    ...(imageUrl ? { imageUrl } : {}),
    ...(plastic ? { plastic } : {}),
    ...(weightGrams !== null ? { weightGrams } : {}),
    ...(wear ? { wear } : {}),
  };
}

export function parseProfile(raw: unknown): PlayerProfile | null {
  if (!isObject(raw)) return null;
  const skillLevel = oneOf<SkillLevel>(raw.skillLevel, SKILL_LEVELS);
  const throwingStyle = oneOf<ThrowingStyle>(raw.throwingStyle, STYLES);
  const courseType = oneOf<CourseType>(raw.courseType, COURSES);
  if (!skillLevel || !throwingStyle || !courseType) return null;
  return { skillLevel, throwingStyle, courseType };
}

/** All-or-nothing: a partly-readable bag is a stale bag. */
export function parseBag(raw: unknown): BagEntry[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_BAG_SIZE) return null;
  const discs = raw.map(parseDisc);
  if (discs.some((d) => d === null)) return null;

  // Drop duplicates rather than letting one disc appear twice in the bag.
  const seen = new Set<string>();
  return (discs as BagEntry[]).filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
}

/**
 * The carried bag's catalog id, restored from session storage.
 *
 * `undefined` is a real value here — it means no bag is selected — so it is
 * returned as valid. `null` signals a stored value the current code cannot use,
 * which the caller drops.
 */
export function parseBagModelId(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}
