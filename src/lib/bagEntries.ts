import type { BagEntry, Disc } from '../api/types';

/**
 * A bag can hold the same mold more than once — a new Buzzz and a beat-in one are
 * different tools, and the API analyses exactly that. Catalog `id` therefore
 * names the mold, not the entry, so each copy needs its own key.
 *
 * The first copy of a mold keeps its catalog id as its key (so bags from before
 * repeats were allowed need no migration); later copies carry `entryId`, which is
 * `<id>#<n>`. Keys exist for React and for edit/remove, and are never sent to the
 * API, which only sees `discId`.
 */
export const entryKey = (entry: { id: string; entryId?: string }): string => entry.entryId ?? entry.id;

/** A new bag entry for `disc`, keyed so it cannot collide with anything already in `bag`. */
export function newEntry(disc: Disc, bag: readonly BagEntry[]): BagEntry {
  const taken = new Set(bag.map(entryKey));
  if (!taken.has(disc.id)) return { ...disc };
  for (let n = 2; ; n++) {
    const entryId = `${disc.id}#${n}`;
    if (!taken.has(entryId)) return { ...disc, entryId };
  }
}

/** Gives every entry a distinct key, keeping the keys it already has. */
export function withUniqueKeys(bag: readonly BagEntry[]): BagEntry[] {
  const out: BagEntry[] = [];
  for (const entry of bag) {
    const { entryId: _drop, ...rest } = entry;
    const keyed = entry.entryId && !out.some((e) => entryKey(e) === entry.entryId) ? entry : rest;
    out.push(out.some((e) => entryKey(e) === entryKey(keyed)) ? newEntry(keyed, out) : keyed);
  }
  return out;
}

/** How many copies of each catalog disc the bag holds. */
export function countByDisc(bag: readonly BagEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of bag) counts[entry.id] = (counts[entry.id] ?? 0) + 1;
  return counts;
}

/**
 * Pairs each bag entry with the API's resolved disc for it.
 *
 * The API returns resolved discs in request order and only knows `discId`, so two
 * copies of one mold are told apart by position: the nth copy in the bag takes the
 * nth resolved disc with that id. Entries the API could not resolve simply have no
 * match.
 */
export function resolvedByEntry<T extends { discId: string }>(
  bag: readonly BagEntry[],
  resolved: readonly T[],
): Map<string, T> {
  const queues = new Map<string, T[]>();
  for (const r of resolved) {
    const queue = queues.get(r.discId) ?? [];
    queue.push(r);
    queues.set(r.discId, queue);
  }
  const matched = new Map<string, T>();
  for (const entry of bag) {
    const next = queues.get(entry.id)?.shift();
    if (next) matched.set(entryKey(entry), next);
  }
  return matched;
}
