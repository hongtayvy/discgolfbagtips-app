import type { BagEntry, PlayerProfile } from '../api/types';
import { bounded, isObject, MAX_BAG_SIZE, parseBag, parseDisc, parseProfile } from './validate.ts';

/**
 * Bag export / import.
 *
 * State is session-only by design (no accounts), so a saved file is how a bag
 * survives closing the tab. The file carries the inputs — discs and profile —
 * and nothing derived: the recommendation is recomputed on load, for every
 * weather.
 *
 * Imported files are untrusted input. Everything is validated field by field
 * and anything unrecognised is rejected rather than coerced.
 */

export const BAG_FILE_FORMAT = 'bag-tips.bag';
export const BAG_FILE_VERSION = 4;
/** Oldest version still readable. v2 lacks plastic/weight/wear; they load unset. */
const MIN_READABLE_VERSION = 2;

export interface BagSnapshot {
  bag: BagEntry[];
  profile: PlayerProfile;
  /** Catalog id of the carried bag. Absent in files written before v4. */
  bagModelId?: number;
}

export interface BagFile extends BagSnapshot {
  format: string;
  version: number;
  exportedAt: string;
}

export type ParseResult = { ok: true; data: BagSnapshot } | { ok: false; error: string };

export function parseBagFile(source: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObject(raw)) return { ok: false, error: "That file isn't a bag export." };
  if (raw.format !== BAG_FILE_FORMAT) return { ok: false, error: "That file isn't a Bag Tips export." };

  // Version 1 files hold ids from the old bundled disc list, which the live
  // catalog does not know. Migrating them would produce a bag the API cannot
  // resolve, so say so instead of importing something broken.
  if (raw.version === 1)
    return {
      ok: false,
      error: 'That export is from an older version whose disc ids predate the live catalog. Rebuild the bag from search and export it again.',
    };
  if (bounded(raw.version, MIN_READABLE_VERSION, BAG_FILE_VERSION) === null)
    return { ok: false, error: `Unsupported bag file version — this app reads version ${BAG_FILE_VERSION}.` };

  if (!Array.isArray(raw.bag)) return { ok: false, error: 'That export has no bag in it.' };
  if (raw.bag.length > MAX_BAG_SIZE)
    return { ok: false, error: `That export has more than ${MAX_BAG_SIZE} discs in it.` };
  if (raw.bag.some((d: unknown) => parseDisc(d) === null))
    return { ok: false, error: 'Some discs in that file are missing flight numbers or have unreadable values.' };

  const bag = parseBag(raw.bag);
  if (!bag) return { ok: false, error: 'That export has an unreadable bag.' };

  const profile = parseProfile(raw.profile);
  if (!profile) return { ok: false, error: 'That export has an unreadable player profile.' };

  // Bag model arrived in v4; older files simply have no bag selected.
  const bagModelId = bounded(raw.bagModelId, 1, Number.MAX_SAFE_INTEGER);
  return {
    ok: true,
    data: { bag, profile, ...(bagModelId !== null ? { bagModelId } : {}) },
  };
}

/* ------------------------------------------------------------------ export */

export function serializeBag({ bag, profile, bagModelId }: BagSnapshot): string {
  const file: BagFile = {
    format: BAG_FILE_FORMAT,
    version: BAG_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    bag,
    ...(bagModelId !== undefined ? { bagModelId } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function bagFileName(date = new Date()): string {
  return `bag-tips-${date.toISOString().slice(0, 10)}.json`;
}

/** Hands the snapshot to the browser as a downloaded file. */
export function downloadBag(snapshot: BagSnapshot): void {
  const blob = new Blob([serializeBag(snapshot)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = bagFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
