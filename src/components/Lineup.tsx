import { useState } from 'react';
import type { BagLineupResponse, SlotGap, SlotLineup, SlotStatus, SuggestedDisc } from '../api/types';
import type { FlightContext } from '../lib/flight';
import { humanizeStability } from '../lib/flight';
import { delta, isVectorRetrieval, num } from '../lib/format';
import { FlightNumbersRow } from './DiscCard';
import { FlightPath } from './FlightPath';
import { Redundancies } from './Redundancies';

const STATUS_LABEL: Record<SlotStatus, string> = {
  COMPLETE: 'Well covered',
  THIN: 'Thin',
  EMPTY: 'Empty',
};

const STATUS_MARK: Record<SlotStatus, string> = {
  COMPLETE: '✓',
  THIN: '◐',
  EMPTY: '!',
};

/**
 * The bag one slot at a time, straight from `POST /api/v1/lineup`.
 *
 * Everything here — which slots are covered, what each gap wants, and which
 * discs fit it — is the server's answer. An earlier version approximated all
 * three client-side because the endpoint did not exist yet.
 */
export function Lineup({
  data,
  ctx,
  onAddToBag,
  bagIds,
}: {
  data: BagLineupResponse;
  ctx: FlightContext;
  onAddToBag: (discId: string) => void;
  bagIds: string[];
}) {
  const [active, setActive] = useState(0);
  const slots = data.slots;
  const slot = slots[active] ?? slots[0];
  const showSimilarity = isVectorRetrieval(data.explainability.retrievalMode);
  if (!slot) return null;

  return (
    <section className="lineup" aria-labelledby="lineup-heading">
      <header className="lineup__header">
        <h2 id="lineup-heading" className="section__title">
          Your lineup
        </h2>
        <p className="section__hint">
          Every slot, with what it is for, what you carry and what each hole wants. Suggestions come from
          the catalog rather than the reasoning model, so there is no prose — just the discs that fit.
        </p>
      </header>

      <div className="lineup__tabs" role="tablist" aria-label="Bag slots">
        {slots.map((s, i) => (
          <button
            key={s.slot}
            role="tab"
            type="button"
            id={`tab-${s.slot}`}
            aria-selected={i === active}
            aria-controls={`panel-${s.slot}`}
            tabIndex={i === active ? 0 : -1}
            className={`lineup__tab${i === active ? ' is-selected' : ''}`}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              setActive((i + (e.key === 'ArrowRight' ? 1 : -1) + slots.length) % slots.length);
            }}
          >
            <span className="lineup__tab-name">{s.label}</span>
            <span className="lineup__tab-meta">
              {s.discCount} disc{s.discCount === 1 ? '' : 's'}
              {s.gaps.length > 0 && (
                <em className="lineup__tab-gaps">
                  {s.gaps.length} gap{s.gaps.length === 1 ? '' : 's'}
                </em>
              )}
              {s.status === 'COMPLETE' && <em className="lineup__tab-ok">✓</em>}
            </span>
          </button>
        ))}
      </div>

      <div className="lineup__panel" role="tabpanel" id={`panel-${slot.slot}`} aria-labelledby={`tab-${slot.slot}`}>
        <p className={`verdict verdict--${slot.status.toLowerCase()}`}>
          <span className="verdict__mark" aria-hidden="true">
            {STATUS_MARK[slot.status]}
          </span>
          <span>
            <strong>{STATUS_LABEL[slot.status]}.</strong> {slot.summary}
          </span>
        </p>

        <p className="lineup__purpose">
          <span>Speed {num(slot.minSpeed)}–{num(slot.maxSpeed)}</span> {slot.purpose}
        </p>

        <div className="stability-strip">
          {slot.stabilityCoverage.map((cell) => (
            <div
              key={cell.stabilityClass}
              className={`strip-cell${cell.covered ? ' is-filled' : ''}${
                !cell.covered && slot.gaps.some((g) => g.stabilityClass === cell.stabilityClass)
                  ? ' is-gap'
                  : ''
              }`}
              title={cell.covered ? `${cell.count} disc${cell.count === 1 ? '' : 's'}` : 'Nothing here'}
            >
              <span className="strip-cell__count">{cell.count || '—'}</span>
              <span className="strip-cell__label">{cell.label}</span>
            </div>
          ))}
        </div>

        {slot.gaps.length === 0 ? (
          <p className="lineup__no-pick">Nothing to add here — every stability class in this slot is covered.</p>
        ) : (
          slot.gaps.map((gap) => (
            <GapPanel
              key={gap.stabilityClass}
              gap={gap}
              ctx={ctx}
              bagIds={bagIds}
              showSimilarity={showSimilarity}
              onAddToBag={onAddToBag}
            />
          ))
        )}

        {slot.redundancies?.length > 0 && (
          <>
            <h3 className="lineup__subheading">Doing the same job</h3>
            <Redundancies reports={slot.redundancies} />
          </>
        )}

        {slot.inBag.length > 0 && <InBag slot={slot} />}
      </div>

      <LineupFooter data={data} />
    </section>
  );
}

function GapPanel({
  gap,
  ctx,
  bagIds,
  showSimilarity,
  onAddToBag,
}: {
  gap: SlotGap;
  ctx: FlightContext;
  bagIds: string[];
  showSimilarity: boolean;
  onAddToBag: (discId: string) => void;
}) {
  const severity = gap.severity >= 1.2 ? 'high' : gap.severity >= 0.8 ? 'medium' : 'low';
  return (
    <article className={`gap-card gap-card--${severity}`}>
      <header className="gap-card__head">
        <h4>{gap.label}</h4>
        <span className="gap-card__severity">severity {gap.severity.toFixed(2)}</span>
      </header>

      <p className="gap-card__reason">{gap.behaviour}</p>

      <div className="gap-card__target">
        <span className="gap-target__label">Target flight</span>
        <FlightNumbersRow flight={gap.target} />
        {gap.targetWeightRange && <span className="pill">{gap.targetWeightRange}</span>}
      </div>

      {gap.suggestions.length > 0 && (
        <ul className="brand-list">
          {gap.suggestions.map((s) => (
            <Suggestion
              key={s.discId}
              disc={s}
              ctx={ctx}
              inBag={bagIds.includes(s.discId)}
              showSimilarity={showSimilarity}
              onAddToBag={onAddToBag}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function Suggestion({
  disc,
  ctx,
  inBag,
  showSimilarity,
  onAddToBag,
}: {
  disc: SuggestedDisc;
  ctx: FlightContext;
  inBag: boolean;
  showSimilarity: boolean;
  onAddToBag: (discId: string) => void;
}) {
  return (
    <li className="brand-item">
      <FlightPath disc={disc} ctx={ctx} width={54} height={76} accent="var(--muted-accent)" />
      <div className="brand-item__body">
        <p className="brand-item__name">
          {disc.brand} {disc.name}
          {showSimilarity && (
            <span className="brand-item__gap" title="Retrieval similarity to the gap's target">
              {(disc.similarity * 100).toFixed(0)}%
            </span>
          )}
        </p>
        <p className="brand-item__numbers">
          {num(disc.speed)} / {num(disc.glide)} / {num(disc.turn)} / {num(disc.fade)} ·{' '}
          {humanizeStability(disc.stability)}
          {disc.deltaVsTarget && (
            <span className="brand-item__delta">
              {' '}
              Δ {delta(disc.deltaVsTarget.speed)} / {delta(disc.deltaVsTarget.glide)} /{' '}
              {delta(disc.deltaVsTarget.turn)} / {delta(disc.deltaVsTarget.fade)}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        className="button button--ghost"
        disabled={inBag}
        onClick={() => onAddToBag(disc.discId)}
      >
        {inBag ? 'In bag' : 'Add'}
      </button>
    </li>
  );
}

function InBag({ slot }: { slot: SlotLineup }) {
  return (
    <>
      <h3 className="lineup__subheading">In your bag · {slot.label}</h3>
      <ul className="brand-list">
        {slot.inBag.map((d) => (
          <li key={d.discId} className="brand-item">
            <div className="brand-item__body">
              <p className="brand-item__name">
                {d.brand} {d.name}
                <span className="brand-item__gap">{humanizeStability(d.stability)}</span>
              </p>
              <p className="brand-item__numbers">
                {num(d.speed)} / {num(d.glide)} / {num(d.turn)} / {num(d.fade)}
                {d.plastic && ` · ${d.plastic}`}
                {d.weightGrams && ` · ${d.weightGrams} g`}
                {d.stabilityExplanation && (
                  <span className="brand-item__delta"> {d.stabilityExplanation}</span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The pipeline's own account of the lineup call. */
function LineupFooter({ data }: { data: BagLineupResponse }) {
  const x = data.explainability;
  return (
    <div className="lineup__footer">
      {x.degradations.length > 0 && (
        <ul className="retrieval__degradations">
          {x.degradations.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      <p className="retrieval__timings">
        {x.retrievalMode.replace(/_/g, ' ').toLowerCase()} · {x.gapsRetrieved}/{x.gapsConsidered} gaps
        retrieved · filters: {x.appliedFilters} · {x.totalMs} ms
      </p>
    </div>
  );
}
