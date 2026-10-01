import { applyStabilityShift, describeFlight, flightShape, humanizeStability, stabilityIndex } from '../lib/flight';
import type { FlightContext } from '../lib/flight';
import type { BagEntry, Disc, FlightNumbers, ResolvedBagDisc } from '../api/types';
import { num, SLOT_LABEL } from '../lib/format';
import { FlightPath } from './FlightPath';
import { DiscDetailEditor } from './DiscDetailEditor';

export function FlightNumbersRow({ flight }: { flight: FlightNumbers }) {
  const entries: [string, number][] = [
    ['Speed', flight.speed],
    ['Glide', flight.glide],
    ['Turn', flight.turn],
    ['Fade', flight.fade],
  ];
  return (
    <dl className="flight-numbers">
      {entries.map(([label, value]) => (
        <div key={label} className="flight-numbers__cell">
          <dt>{label.slice(0, 1)}</dt>
          <dd>{num(value)}</dd>
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </dl>
  );
}

/** How far plastic, weight and wear moved this disc off its published numbers. */
const ownershipShift = (resolved?: ResolvedBagDisc) =>
  resolved
    ? resolved.plasticStabilityShift + resolved.weightStabilityShift + resolved.wearStabilityShift
    : 0;

interface Props {
  disc: Disc | BagEntry;
  ctx?: FlightContext;
  resolved?: ResolvedBagDisc;
  onRemove?: () => void;
  onChange?: (patch: Partial<BagEntry>) => void;
  accent?: string;
}

export function DiscCard({ disc, ctx = {}, resolved, onRemove, onChange, accent }: Props) {
  const shift = ownershipShift(resolved);
  // Draw the disc as this player owns it, not as the catalog publishes it.
  const flight = applyStabilityShift(disc, shift);
  const index = stabilityIndex(flight);
  const shape = flightShape(flight, ctx);

  return (
    <article className="disc-card">
      <div className="disc-card__top">
        <div className="disc-card__viz">
          <FlightPath disc={flight} ctx={ctx} width={104} height={134} accent={accent} />
        </div>
        <div className="disc-card__body">
          <header>
            <h3 className="disc-card__name">{disc.name}</h3>
            <p className="disc-card__brand">
              {disc.brand} · {SLOT_LABEL[disc.slot] ?? disc.category}
            </p>
          </header>
          <FlightNumbersRow flight={disc} />
          <p className="disc-card__stability">
            {humanizeStability(resolved?.stability ?? disc.stability)}{' '}
            <span>
              ({index > 0 ? '+' : ''}
              {index.toFixed(1)})
            </span>
            {shift !== 0 && (
              <em className="disc-card__shifted" title="Adjusted for plastic, weight and wear">
                adjusted
              </em>
            )}
          </p>
          <p className="disc-card__flight">{describeFlight(shape, ctx.profile?.throwingStyle)}</p>
        </div>
        {onRemove && (
          <button
            type="button"
            className="disc-card__remove"
            onClick={onRemove}
            aria-label={`Remove ${disc.brand} ${disc.name} from your bag`}
          >
            ×
          </button>
        )}
      </div>

      {onChange && (
        <DiscDetailEditor entry={disc as BagEntry} resolved={resolved} onChange={onChange} />
      )}
    </article>
  );
}
