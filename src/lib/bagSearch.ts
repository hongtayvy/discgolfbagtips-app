import type { BagSummary } from '../api/types';

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Filters the bag-model catalog by what the player typed.
 *
 * The whole catalog is already loaded (it is a few dozen rows), so this runs
 * locally rather than asking the API. Every typed word must appear somewhere in
 * the brand, model, type or build tier, in any order — "dynamic ballista" and
 * "ballista dynamic" both find it. Matches that start a word rank above ones that
 * only contain the text, then brand and model keep the list stable.
 */
export function filterBags(bags: readonly BagSummary[], query: string): BagSummary[] {
  const terms = words(query);
  const sortKey = (b: BagSummary) => `${b.brand} ${b.model}`.toLowerCase();
  const byName = (a: BagSummary, b: BagSummary) => sortKey(a).localeCompare(sortKey(b));
  if (!terms.length) return [...bags].sort(byName);

  const scored: { bag: BagSummary; prefix: number }[] = [];
  for (const bag of bags) {
    const haystack = `${bag.brand} ${bag.model} ${bag.bagType} ${bag.buildTier ?? ''}`.toLowerCase();
    if (!terms.every((t) => haystack.includes(t))) continue;
    const tokens = words(haystack);
    const prefix = terms.filter((t) => tokens.some((w) => w.startsWith(t))).length;
    scored.push({ bag, prefix });
  }
  return scored.sort((a, b) => b.prefix - a.prefix || byName(a.bag, b.bag)).map((s) => s.bag);
}
