import { describeFlight, flightShape, humanizeStability } from '../lib/flight';
import type { FlightContext } from '../lib/flight';
import type { RecommendationResponse } from '../api/types';
import { FlightPath } from './FlightPath';
import { delta, isVectorRetrieval, num, SLOT_LABEL } from '../lib/format';
import { FlightNumbersRow } from './DiscCard';

export function RecommendationCard({
  data,
  ctx,
  onAddToBag,
}: {
  data: RecommendationResponse;
  ctx: FlightContext;
  onAddToBag: (discId: string) => void;
}) {
  const { recommendation: disc, alternatives, explainability } = data;
  const showSimilarity = isVectorRetrieval(explainability.retrievalMode);
  const shape = flightShape(disc, ctx);
  const confidencePct = Math.round(disc.confidence * 100);
  const selectedGap = explainability.flightGaps.find((g) => g.selected);

  return (
    <section className="rec" aria-labelledby="rec-heading">
      <div className="rec__main">
        <div className="rec__viz">
          <FlightPath disc={disc} ctx={ctx} width={168} height={248} detailed accent="var(--rec-accent)" />
          <p className="rec__viz-caption">{describeFlight(shape, ctx.profile?.throwingStyle)}</p>
        </div>

        <div className="rec__content">
          <p className="rec__eyebrow">{disc.headline}</p>
          <h2 id="rec-heading" className="rec__name">
            {disc.brand} <strong>{disc.name}</strong>
          </h2>

          <div className="rec__meta">
            <FlightNumbersRow flight={disc} />
            <span className="rec__stability">
              {humanizeStability(disc.stability)} · {SLOT_LABEL[disc.slot] ?? disc.category}
            </span>
          </div>

          <div className="rec__confidence">
            <div className="rec__confidence-bar">
              <span style={{ width: `${confidencePct}%` }} />
            </div>
            <span className="rec__confidence-label">{confidencePct}% confidence</span>
          </div>

          <p className="rec__summary">{disc.summary}</p>

          {disc.whenToThrowIt && (
            <p className="rec__when">
              <span>When to throw it</span> {disc.whenToThrowIt}
            </p>
          )}

          <button type="button" className="button button--primary" onClick={() => onAddToBag(disc.discId)}>
            Add to my bag
          </button>
        </div>
      </div>

      <div className="rec__why">
        <h3 className="rec__why-heading">Why this disc</h3>
        <ol className="reasons">
          {disc.reasoning.map((reason, i) => (
            <li key={reason} className="reason">
              <span className="reason__index">{i + 1}</span>
              <p className="reason__detail">{reason}</p>
            </li>
          ))}
        </ol>

        {(disc.plasticAdvice || disc.weightAdvice) && (
          <div className="rec__buying">
            {disc.suggestedWeightRange && (
              <p className="rec__buying-row">
                <span className="chip chip--gap">{disc.suggestedWeightRange}</span>
                {disc.weightAdvice}
              </p>
            )}
            {disc.plasticAdvice && <p className="rec__buying-row">{disc.plasticAdvice}</p>}
          </div>
        )}
      </div>

      {selectedGap && (
        <div className="rec__gap">
          <h3 className="rec__why-heading">The gap it fills</h3>
          <p className="rec__gap-reason">{selectedGap.reason}</p>
          <div className="gap-target">
            <div>
              <span className="gap-target__label">Target flight</span>
              <FlightNumbersRow flight={selectedGap.target} />
            </div>
            {selectedGap.nearestInBag && selectedGap.delta && (
              <div>
                <span className="gap-target__label">
                  Delta vs {selectedGap.nearestInBag.brand} {selectedGap.nearestInBag.name}
                </span>
                <p className="gap-target__delta">
                  {delta(selectedGap.delta.speed)} / {delta(selectedGap.delta.glide)} /{' '}
                  {delta(selectedGap.delta.turn)} / {delta(selectedGap.delta.fade)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="rec__alts">
          <h3 className="rec__why-heading">Also retrieved</h3>
          <ul className="alt-list">
            {alternatives.map((alt) => (
              <li key={alt.discId} className="alt">
                <FlightPath disc={alt} ctx={ctx} width={62} height={86} accent="var(--muted-accent)" />
                <div>
                  <p className="alt__name">
                    {alt.brand} {alt.name}
                    <span className="alt__similarity">
                      #{alt.rank}
                      {showSimilarity && ` · ${(alt.similarity * 100).toFixed(1)}% match`}
                    </span>
                  </p>
                  <p className="alt__numbers">
                    {num(alt.speed)} / {num(alt.glide)} / {num(alt.turn)} / {num(alt.fade)}
                  </p>
                  <p className="alt__reason">{alt.whyItWasConsidered}</p>
                </div>
                <button type="button" className="button button--ghost" onClick={() => onAddToBag(alt.discId)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <RetrievalDetails data={data} />
    </section>
  );
}

/** The pipeline's own account of itself — collapsed until asked for. */
function RetrievalDetails({ data }: { data: RecommendationResponse }) {
  const { explainability: x } = data;
  const showSimilarity = isVectorRetrieval(x.retrievalMode);
  return (
    <details className="retrieval">
      <summary>
        How this was retrieved
        <span className="retrieval__badges">
          <span className="badge">{x.retrievalMode.replace(/_/g, ' ').toLowerCase()}</span>
          <span className="badge">{x.embedding.model}</span>
          <span className="badge">{x.timings.totalMs} ms</span>
          {x.generation.stubbed && <span className="badge badge--warn">rule-based text</span>}
        </span>
      </summary>

      <div className="retrieval__body">
        {x.degradations.length > 0 && (
          <ul className="retrieval__degradations">
            {x.degradations.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}

        <p className="retrieval__query">
          <span>Retrieval query</span>
          {x.retrievalQuery}
        </p>

        <table className="matches">
          <caption className="sr-only">Vector matches considered</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Disc</th>
              <th scope="col">Similarity</th>
              <th scope="col">Δ vs target</th>
              <th scope="col">Matched on</th>
            </tr>
          </thead>
          <tbody>
            {x.vectorMatches.map((m) => (
              <tr key={m.discId} className={m.chosen ? 'is-chosen' : undefined}>
                <td>{m.rank}</td>
                <td>
                  {m.brand} {m.name}
                  {m.chosen && <span className="matches__chosen">chosen</span>}
                </td>
                <td className="matches__num">
                  {showSimilarity ? `${(m.similarity * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="matches__num">
                  {m.deltaVsGapTarget
                    ? `${delta(m.deltaVsGapTarget.speed)} / ${delta(m.deltaVsGapTarget.glide)} / ${delta(m.deltaVsGapTarget.turn)} / ${delta(m.deltaVsGapTarget.fade)}`
                    : '—'}
                </td>
                <td className="matches__terms">{m.matchedDescriptors.slice(0, 3).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="retrieval__timings">
          analyse {x.timings.analyzeMs} ms · retrieve {x.timings.retrieveMs} ms · generate{' '}
          {x.timings.generateMs} ms · session {data.sessionId.slice(0, 8)}
        </p>
      </div>
    </details>
  );
}
