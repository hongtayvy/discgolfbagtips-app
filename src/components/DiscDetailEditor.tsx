import { useEffect, useId, useState } from 'react';
import { getPlastics } from '../api/client';
import type { BagEntry, Plastic, ResolvedBagDisc, Wear } from '../api/types';
import { WEARS } from '../api/types';
import { MAX_DISC_GRAMS, MIN_DISC_GRAMS } from '../lib/validate';
import { COMMON_DISC_GRAMS } from '../lib/format';

const WEAR_LABEL: Record<Wear, string> = {
  NEW: 'New',
  SEASONED: 'Seasoned',
  BEAT_IN: 'Beat in',
  WELL_WORN: 'Well worn',
};

const shift = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

interface Props {
  entry: BagEntry;
  /** The server's resolution of this disc, once an analysis has run. */
  resolved?: ResolvedBagDisc;
  onChange: (patch: Partial<BagEntry>) => void;
}

/**
 * Plastic, weight and wear for one disc. All three feed the server's effective
 * stability, and wear moves it hardest — a well-worn base-plastic midrange
 * resolves several steps understable, which changes what the bag is missing.
 *
 * Plastics load lazily on first open and are cached per brand.
 */
export function DiscDetailEditor({ entry, resolved, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [plastics, setPlastics] = useState<Plastic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || plastics) return;
    let cancelled = false;
    getPlastics(entry.brand)
      .then((list) => {
        if (!cancelled) setPlastics(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load plastics.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, plastics, entry.brand]);

  const selected = plastics?.find((p) => p.name === entry.plastic);

  // Group by family so the list reads as base-grade → premium rather than as 64
  // undifferentiated names.
  const families = [...new Set((plastics ?? []).map((p) => p.family))];

  const summary = [
    entry.plastic,
    entry.weightGrams ? `${entry.weightGrams} g` : null,
    entry.wear && entry.wear !== 'NEW' ? WEAR_LABEL[entry.wear].toLowerCase() : null,
  ].filter(Boolean);

  return (
    <div className="detail">
      <button
        type="button"
        className="detail__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="detail__toggle-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {summary.length ? summary.join(' · ') : 'Add plastic, weight, wear'}
      </button>

      {open && (
        <div className="detail__body">
          {error && <p className="detail__error">{error}</p>}

          <label className="field">
            <span className="field__label">Plastic</span>
            <select
              className="field__control"
              value={entry.plastic ?? ''}
              onChange={(e) => onChange({ plastic: e.target.value || undefined })}
              disabled={!plastics}
            >
              {/* The catalog itself contains a blend named "Unspecified", so this
                  placeholder has to read differently to stay distinguishable. */}
              <option value="">{plastics ? "Not set — I don't know" : 'Loading…'}</option>
              {families.map((family) => (
                <optgroup key={family} label={family}>
                  {(plastics ?? [])
                    .filter((p) => p.family === family)
                    .map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({shift(p.stabilityShift)})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          {selected && (
            <p className="detail__plastic-note">
              <span className="detail__pills">
                <span className="pill">durability {selected.durability}/5</span>
                <span className="pill">grip {selected.grip}/5</span>
                <span className="pill">stability {shift(selected.stabilityShift)}</span>
              </span>
              {selected.description}
            </p>
          )}

          <div className="detail__row">
            <WeightField grams={entry.weightGrams} onChange={(weightGrams) => onChange({ weightGrams })} />

            <fieldset className="field field--wear">
              <legend className="field__label">Wear</legend>
              <div className="wear-toggle">
                {WEARS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={(entry.wear ?? 'NEW') === w}
                    className={`wear-toggle__option${(entry.wear ?? 'NEW') === w ? ' is-selected' : ''}`}
                    onClick={() => onChange({ wear: w })}
                  >
                    {WEAR_LABEL[w]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {resolved && (
            <p className="detail__resolved">
              <span className="detail__resolved-value">
                Plays {resolved.stability} ({shift(resolved.effectiveStabilityIndex)})
              </span>
              <code>{resolved.stabilityExplanation}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The weight stamped on the disc, in grams. Free text with a datalist of the
 * weights discs are actually sold at — you usually know the number, so typing
 * it beats stepping to it, and the list is there when you'd rather pick.
 *
 * The draft is held locally so a half-typed "16" isn't discarded as
 * out-of-range before you finish typing "165".
 */
function WeightField({
  grams,
  onChange,
}: {
  grams?: number;
  onChange: (grams: number | undefined) => void;
}) {
  const listId = useId();
  const [draft, setDraft] = useState(grams === undefined ? '' : String(grams));

  // Adjust the draft when the value changes from outside (an import, a reset)
  // without clobbering what is being typed. React's documented alternative to
  // syncing props into state with an effect.
  const [lastGrams, setLastGrams] = useState(grams);
  if (grams !== lastGrams) {
    setLastGrams(grams);
    setDraft(grams === undefined ? '' : String(grams));
  }

  const commit = (next: string) => {
    setDraft(next);
    const trimmed = next.trim();
    if (!trimmed) {
      onChange(undefined);
      return;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value)) return;
    if (value < MIN_DISC_GRAMS || value > MAX_DISC_GRAMS) return;
    onChange(value);
  };

  return (
    <label className="field field--weight">
      <span className="field__label">Weight</span>
      <span className="field__suffix">
        <input
          className="field__control"
          type="text"
          inputMode="numeric"
          list={listId}
          placeholder="—"
          value={draft}
          onChange={(e) => commit(e.target.value)}
          // Snap back to the stored value if you wander off mid-number.
          onBlur={() => setDraft(grams === undefined ? '' : String(grams))}
        />
        <span aria-hidden="true">g</span>
        <datalist id={listId}>
          {COMMON_DISC_GRAMS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </span>
    </label>
  );
}
