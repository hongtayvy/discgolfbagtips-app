/**
 * Working out which brands a player actually throws, from the discs in the bag.
 *
 * "Only Innova" bag → suggest Innova. "Innova and Discmania" bag → suggest from
 * both. A bag with one disc is weak evidence of loyalty to anything, so nothing
 * is inferred until there are at least two.
 */

/** Below this, a bag says too little about brand preference to act on. */
export const MIN_DISCS_TO_INFER = 2;

export interface InferredBrands {
  /** Display names, most-used first. */
  brands: string[];
  counts: Record<string, number>;
  /** False when the bag is too small to infer anything from. */
  confident: boolean;
}

export function inferBrands(bag: { brand: string }[]): InferredBrands {
  // Brands compare case- and whitespace-insensitively, but keep the catalog's
  // own spelling for display and for the request (the API matches on it).
  const byKey = new Map<string, { name: string; count: number }>();
  for (const disc of bag) {
    const name = disc.brand?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { name, count: 1 });
  }

  const ranked = [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    brands: ranked.map((r) => r.name),
    counts: Object.fromEntries(ranked.map((r) => [r.name, r.count])),
    confident: bag.length >= MIN_DISCS_TO_INFER && ranked.length > 0,
  };
}

export type BrandSource = 'chosen' | 'bag' | 'none';

/**
 * Which brands the request will carry, and why.
 *
 * Brands the player picked by hand always win: matching the bag is a default,
 * never an override of an explicit choice.
 */
export function resolveBrands(opts: {
  chosen: string[] | undefined;
  inferred: InferredBrands;
  matchBag: boolean;
}): { brands: string[]; source: BrandSource } {
  if (opts.chosen?.length) return { brands: opts.chosen, source: 'chosen' };
  if (opts.matchBag && opts.inferred.confident) return { brands: opts.inferred.brands, source: 'bag' };
  return { brands: [], source: 'none' };
}

/** "Innova", "Innova and Discmania", "Innova, Discmania and MVP". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
