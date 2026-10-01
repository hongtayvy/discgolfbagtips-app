import { useEffect, useState } from 'react';
import { getBags } from '../api/client';
import type { BagFit, BagSummary, CarryWeight } from '../api/types';

const lb = (pounds: number | null | undefined) => (pounds == null ? null : `${pounds.toFixed(1)} lb`);

/** Several catalog fields are nullable — not every maker publishes a figure. */
const capacityText = (bag: BagSummary) => {
  if (bag.capacityMax == null) return 'capacity not published';
  return bag.capacityMin && bag.capacityMin !== bag.capacityMax
    ? `${bag.capacityMin}–${bag.capacityMax} discs`
    : `${bag.capacityMax} discs`;
};

/**
 * Which bag the discs are carried in, from `GET /api/v1/bags`.
 *
 * Replaces a hand-written list of bag classes with typical weights. The catalog
 * carries real published specs, so the carry total below is now the server's
 * arithmetic rather than an estimate made here.
 */
export function BagPicker({
  bagModelId,
  discCount,
  carriedBag,
  carryWeight,
  betterFittingBags,
  onChange,
}: {
  bagModelId?: number;
  discCount: number;
  carriedBag: BagSummary | null;
  carryWeight: CarryWeight | null;
  betterFittingBags: BagFit[];
  onChange: (bagModelId: number | undefined) => void;
}) {
  const [bags, setBags] = useState<BagSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBags()
      .then((list) => !cancelled && setBags(list))
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load bag models.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer the server's echo of the bag, which carries the full spec.
  const selected = carriedBag ?? bags.find((b) => b.id === bagModelId) ?? null;

  return (
    <div className="carry">
      {carryWeight ? (
        <>
          <div className="carry__total">
            <span className="carry__value">{carryWeight.totalPounds?.toFixed(1) ?? '—'}</span>
            <span className="carry__unit">lb</span>
            <span className="carry__alt">{(carryWeight.totalGrams / 1000).toFixed(2)} kg</span>
            {carryWeight.overpacked && <span className="carry__flag">over capacity</span>}
          </div>

          <ul className="carry__breakdown">
            <li>
              <span>
                {carryWeight.discCount} disc{carryWeight.discCount === 1 ? '' : 's'}
              </span>
              <span className="carry__num">{lb(carryWeight.discWeightGrams / 453.592) ?? '—'}</span>
            </li>
            <li>
              <span>{selected ? `${selected.brand} ${selected.model}` : 'No bag selected'}</span>
              <span className="carry__num">
                {carryWeight.bagWeightGrams != null
                  ? lb(carryWeight.bagWeightGrams / 453.592)
                  : 'not published'}
              </span>
            </li>
          </ul>

          {carryWeight.notes.map((n) => (
            <p key={n} className="carry__caveat">
              {n}
            </p>
          ))}
          {carryWeight.estimated && (
            <p className="carry__caveat">
              {carryWeight.assumedWeights} disc{carryWeight.assumedWeights === 1 ? '' : 's'} had no weight
              set, so the total includes an assumption. Set weights on the cards above for a real number.
            </p>
          )}
        </>
      ) : (
        <p className="carry__caveat">
          Pick a bag and run the analysis — the carry total is computed server-side from the model's
          published weight and your disc weights.
        </p>
      )}

      <div className="carry__controls">
        <label className="field">
          <span className="field__label">Your bag</span>
          <select
            className="field__control"
            value={bagModelId ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">No bag selected</option>
            {bags.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand} {b.model} — {capacityText(b)}
                {b.emptyWeightPounds != null ? `, ${b.emptyWeightPounds} lb` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="detail__error">{error}</p>}

      {selected && (
        <p className="carry__note">
          {capacityText(selected)} · {selected.bagType.toLowerCase()}
          {selected.buildTier ? ` · ${selected.buildTier.toLowerCase()} build` : ''}
          {selected.carryOnCompliant ? ' · carry-on compliant' : ''}
          {selected.notes ? ` — ${selected.notes}` : ''}
        </p>
      )}

      {betterFittingBags.length > 0 && (
        <div className="bag-fits">
          <h4 className="lineup__subheading">Bags that fit {discCount} discs better</h4>
          <ul className="brand-list">
            {betterFittingBags.map((fit) => (
              <li key={fit.bag.id} className="brand-item">
                <div className="brand-item__body">
                  <p className="brand-item__name">
                    {fit.bag.brand} {fit.bag.model}
                    <span className="brand-item__gap">
                      +{fit.headroom} spare · {lb(fit.totalCarryPounds) ?? 'weight unpublished'}
                    </span>
                  </p>
                  <p className="brand-item__numbers">{fit.comparison}</p>
                </div>
                <button type="button" className="button button--ghost" onClick={() => onChange(fit.bag.id)}>
                  Use this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
