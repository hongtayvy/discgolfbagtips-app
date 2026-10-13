import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getBags } from '../api/client';
import type { BagFit, BagSummary, CarryWeight } from '../api/types';
import { filterBags } from '../lib/bagSearch';

const lb = (pounds: number | null | undefined) => (pounds == null ? null : `${pounds.toFixed(1)} lb`);

/** Several catalog fields are nullable — not every maker publishes a figure. */
const capacityText = (bag: BagSummary) => {
  if (bag.capacityMax == null) return 'capacity not published';
  return bag.capacityMin && bag.capacityMin !== bag.capacityMax
    ? `${bag.capacityMin}–${bag.capacityMax} discs`
    : `${bag.capacityMax} discs`;
};

const MAX_RESULTS = 40;

/**
 * Type-ahead over the bag-model catalog, in the same shape as the disc search.
 * The catalog is loaded once, so filtering is local and instant.
 */
function BagSearch({
  bags,
  selected,
  onSelect,
}: {
  bags: BagSummary[];
  selected: BagSummary | null;
  onSelect: (id: number | undefined) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => filterBags(bags, query), [bags, query]);
  const shown = matches.slice(0, MAX_RESULTS);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const choose = (bag: BagSummary) => {
    onSelect(bag.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const bag = shown[active];
      if (bag) choose(bag);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={`${listId}-input`}>
        Your bag
      </label>
      <div className="disc-search" ref={rootRef}>
        <div className="disc-search__field">
          <span className="disc-search__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            id={`${listId}-input`}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].id}` : undefined}
            className="disc-search__input"
            placeholder={selected ? `${selected.brand} ${selected.model} — search to change` : 'Search bags by brand or model…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>

        {open && (
          <ul className="disc-search__results" id={listId} role="listbox" aria-label="Bag models">
            {!shown.length && (
              <li className="disc-search__empty">
                {bags.length ? `No bags match “${query.trim()}”.` : 'No bag models loaded yet.'}
              </li>
            )}
            {shown.map((b, i) => (
              <li key={b.id} id={`${listId}-${b.id}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`disc-search__result${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(b)}
                >
                  <span className="disc-search__result-name">
                    {b.brand}
                    <em>{b.model}</em>
                  </span>
                  <span className="disc-search__result-numbers">
                    {capacityText(b)}
                    {b.emptyWeightPounds != null ? ` · ${b.emptyWeightPounds} lb` : ''}
                  </span>
                  <span className="disc-search__result-stability">{b.bagType.toLowerCase()}</span>
                </button>
              </li>
            ))}
            {matches.length > shown.length && (
              <li className="disc-search__empty">
                Showing {shown.length} of {matches.length} — keep typing to narrow it down.
              </li>
            )}
          </ul>
        )}
      </div>

      {selected && (
        <p className="bag-search__current">
          <span>
            Carrying <strong>{selected.brand} {selected.model}</strong>
          </span>
          <button type="button" className="link-button" onClick={() => onSelect(undefined)}>
            Remove
          </button>
        </p>
      )}
    </div>
  );
}

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
        <BagSearch bags={bags} selected={selected} onSelect={onChange} />
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
