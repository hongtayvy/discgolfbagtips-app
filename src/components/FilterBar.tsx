import { useEffect, useId, useState } from 'react';
import { getBrands } from '../api/client';
import type { RecommendationFilters } from '../api/types';

const MAX_BRANDS = 30;

/**
 * Narrows what the pipeline may recommend. These go to the server on both the
 * recommendation and lineup requests, so the picks themselves are filtered —
 * this is not a post-hoc filter over results.
 */
export function FilterBar({
  filters,
  onChange,
}: {
  filters: RecommendationFilters;
  onChange: (next: RecommendationFilters) => void;
}) {
  const listId = useId();
  const [brands, setBrands] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBrands()
      .then((list) => !cancelled && setBrands(list))
      .catch(() => {
        // Without the list the chips still work, just without autocomplete.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = filters.brands ?? [];

  const addBrand = (raw: string) => {
    const name = raw.trim();
    if (!name || selected.length >= MAX_BRANDS) return;
    // Only send names the catalog knows; anything else filters to nothing.
    const match = brands.find((b) => b.toLowerCase() === name.toLowerCase());
    if (!match || selected.includes(match)) {
      setDraft('');
      return;
    }
    onChange({ ...filters, brands: [...selected, match] });
    setDraft('');
  };

  const removeBrand = (name: string) => {
    const next = selected.filter((b) => b !== name);
    onChange({ ...filters, brands: next.length ? next : undefined });
  };

  return (
    <div className="filters">
      <div className="filters__row">
        <label className="field">
          <span className="field__label">Only these brands</span>
          <span className="field__suffix">
            <input
              className="field__control"
              type="text"
              list={listId}
              placeholder={brands.length ? 'Add a brand…' : 'Loading brands…'}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                // Picking from the datalist fires change with the full name.
                if (brands.some((b) => b.toLowerCase() === e.target.value.trim().toLowerCase())) {
                  addBrand(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                addBrand(draft);
              }}
            />
            <datalist id={listId}>
              {brands
                .filter((b) => !selected.includes(b))
                .map((b) => (
                  <option key={b} value={b} />
                ))}
            </datalist>
          </span>
        </label>

        <label className="field field--weight">
          <span className="field__label">Max speed</span>
          <span className="field__suffix">
            <input
              className="field__control"
              type="text"
              inputMode="decimal"
              placeholder="any"
              value={filters.maxSpeed ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  onChange({ ...filters, maxSpeed: undefined });
                  return;
                }
                const value = Number(raw);
                if (!Number.isFinite(value) || value < 1 || value > 20) return;
                onChange({ ...filters, maxSpeed: value });
              }}
            />
          </span>
        </label>

        {(selected.length > 0 || filters.maxSpeed !== undefined) && (
          <button type="button" className="button button--ghost" onClick={() => onChange({})}>
            Clear filters
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="filters__chips">
          {selected.map((b) => (
            <li key={b}>
              <button type="button" className="chip chip--removable" onClick={() => removeBrand(b)}>
                {b}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Remove {b} filter</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
