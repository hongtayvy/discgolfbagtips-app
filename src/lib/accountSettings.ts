import type { CourseType, PlayerSettingsWire, SkillLevel, ThrowingStyle } from '../api/types';
import type { Theme } from './theme.ts';

/**
 * A player's standing preferences as the front end holds them: lowercase, with
 * null meaning "not chosen". The API spells enums in uppercase; `toWire` and
 * `fromWire` are the only places that difference is handled.
 */
export interface SettingsSnapshot {
  skillLevel: SkillLevel | null;
  skillInputMode: 'level' | 'pdga' | null;
  pdgaRating: number | null;
  throwingStyle: ThrowingStyle | null;
  courseType: CourseType | null;
  theme: Theme | null;
}

export const NO_SETTINGS: SettingsSnapshot = {
  skillLevel: null,
  skillInputMode: null,
  pdgaRating: null,
  throwingStyle: null,
  courseType: null,
  theme: null,
};

const FIELDS = Object.keys(NO_SETTINGS) as (keyof SettingsSnapshot)[];

const SKILL: readonly string[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'];
const STYLE: readonly string[] = ['BACKHAND', 'FOREHAND', 'BOTH'];
const COURSE: readonly string[] = ['WOODED', 'OPEN', 'MIXED'];

const oneOf = <T extends string>(allowed: readonly string[], value: unknown): T | null =>
  typeof value === 'string' && allowed.includes(value) ? (value as T) : null;

/**
 * Reads the API's answer defensively. A value this build does not know — a
 * field added by a newer backend, or junk — becomes "not chosen" rather than
 * crashing the page or being applied.
 */
export function fromWire(raw: unknown): SettingsSnapshot {
  if (typeof raw !== 'object' || raw === null) return NO_SETTINGS;
  const r = raw as Record<string, unknown>;
  const mode = oneOf<'LEVEL' | 'PDGA'>(['LEVEL', 'PDGA'], r.skillInputMode);
  const theme = oneOf<'LIGHT' | 'DARK'>(['LIGHT', 'DARK'], r.theme);
  const rating = r.pdgaRating;
  return {
    skillLevel: oneOf<SkillLevel>(SKILL, r.skillLevel),
    skillInputMode: mode === 'LEVEL' ? 'level' : mode === 'PDGA' ? 'pdga' : null,
    pdgaRating: typeof rating === 'number' && Number.isInteger(rating) ? rating : null,
    throwingStyle: oneOf<ThrowingStyle>(STYLE, r.throwingStyle),
    courseType: oneOf<CourseType>(COURSE, r.courseType),
    theme: theme === 'LIGHT' ? 'light' : theme === 'DARK' ? 'dark' : null,
  };
}

/** Only the fields present in `patch` are sent; a null clears the stored value. */
export function toWire(patch: Partial<SettingsSnapshot>): Partial<PlayerSettingsWire> {
  const wire: Partial<PlayerSettingsWire> = {};
  if ('skillLevel' in patch) wire.skillLevel = patch.skillLevel ?? null;
  if ('skillInputMode' in patch) {
    wire.skillInputMode = patch.skillInputMode == null ? null : patch.skillInputMode === 'pdga' ? 'PDGA' : 'LEVEL';
  }
  if ('pdgaRating' in patch) wire.pdgaRating = patch.pdgaRating ?? null;
  if ('throwingStyle' in patch) wire.throwingStyle = patch.throwingStyle ?? null;
  if ('courseType' in patch) wire.courseType = patch.courseType ?? null;
  if ('theme' in patch) wire.theme = patch.theme == null ? null : patch.theme === 'dark' ? 'DARK' : 'LIGHT';
  return wire;
}

/** What `local` would change on the server: the fields where the two differ. */
export function diffSettings(server: SettingsSnapshot, local: SettingsSnapshot): Partial<SettingsSnapshot> {
  const patch: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (server[field] !== local[field]) patch[field] = local[field];
  }
  return patch as Partial<SettingsSnapshot>;
}

/** The fields the player has actually chosen, i.e. the ones worth applying locally. */
export function chosenSettings(server: SettingsSnapshot): Partial<SettingsSnapshot> {
  const chosen: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (server[field] !== null) chosen[field] = server[field];
  }
  return chosen as Partial<SettingsSnapshot>;
}

export const isEmpty = (patch: object) => Object.keys(patch).length === 0;
