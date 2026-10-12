import type { RecommendationFilters } from '../api/types';
import type { BrandSource, InferredBrands } from '../lib/brands';
import { joinNames } from '../lib/brands';
import { FilterBar } from './FilterBar';

/**
 * Which brands the suggestions come from.
 *
 * By default this follows the bag: an all-Innova bag suggests Innova, a bag that
 * mixes Innova and Discmania suggests from both. Brands the player picks by hand
 * always win, and matching the bag can be switched off. The panel says which of
 * those is in effect so the filter is never a surprise.
 */
export function BrandPanel({
  filters,
  onFiltersChange,
  inferred,
  source,
  effective,
  matchBag,
  onMatchBagChange,
}: {
  filters: RecommendationFilters;
  onFiltersChange: (next: RecommendationFilters) => void;
  inferred: InferredBrands;
  source: BrandSource;
  effective: string[];
  matchBag: boolean;
  onMatchBagChange: (next: boolean) => void;
}) {
  const mixed = inferred.brands.length > 1;

  return (
    <div className="brand-panel">
      {source === 'bag' && (
        <div className="brand-panel__status brand-panel__status--on">
          <p>
            <strong>Matching your bag.</strong>{' '}
            {mixed
              ? `You throw ${joinNames(effective)}, so suggestions come from all of those.`
              : `Everything in your bag is ${effective[0]}, so suggestions are ${effective[0]} discs.`}
          </p>
          <ul className="brand-panel__chips" aria-label="Brands in your bag">
            {effective.map((b) => (
              <li key={b} className="chip">
                {b}
                <span className="brand-panel__count">×{inferred.counts[b] ?? 0}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={() => onMatchBagChange(false)}>
            Show all brands instead
          </button>
        </div>
      )}

      {source === 'chosen' && (
        <div className="brand-panel__status">
          <p>
            <strong>Using the brands you picked.</strong> Your bag's own brands aren't being used while
            you have a selection.
          </p>
        </div>
      )}

      {source === 'none' && (
        <div className="brand-panel__status">
          {inferred.confident && !matchBag ? (
            <>
              <p>
                <strong>Suggesting from every brand.</strong>
              </p>
              <button type="button" className="link-button" onClick={() => onMatchBagChange(true)}>
                Match my bag ({joinNames(inferred.brands)})
              </button>
            </>
          ) : (
            <p>
              <strong>Suggesting from every brand.</strong> Add another disc and suggestions will match the
              brands in your bag.
            </p>
          )}
        </div>
      )}

      <FilterBar filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
