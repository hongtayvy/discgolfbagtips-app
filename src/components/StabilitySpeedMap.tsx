import { useMemo, useState } from 'react';
import { stabilityIndex } from '../lib/flight';
import type { Disc, FlightGapExplanation, RecommendedDisc, Slot } from '../api/types';
import { num, SLOT_LABEL } from '../lib/format';

const W = 680;
const H = 380;
const PAD = { top: 24, right: 22, bottom: 46, left: 58 };

const SPEED = [1, 15] as const;
const STAB = [-5, 5] as const;

/** Speed band each slot occupies, used to place a gap rectangle on the map. */
const SLOT_SPEED: Record<Slot, [number, number]> = {
  PUTT_AND_APPROACH: [1, 4],
  MIDRANGE: [4, 6],
  FAIRWAY_DRIVER: [6, 9],
  DISTANCE_DRIVER: [9, 15],
};

/** Stability-index band for each class the API reports on a gap. */
const CLASS_STABILITY: Record<string, [number, number]> = {
  VERY_UNDERSTABLE: [-5, -2.5],
  UNDERSTABLE: [-2.5, -0.5],
  STABLE: [-0.5, 2],
  OVERSTABLE: [2, 3.5],
  VERY_OVERSTABLE: [3.5, 5],
};

interface Props {
  bag: Disc[];
  gaps: FlightGapExplanation[];
  recommended?: RecommendedDisc;
}

/**
 * Bag-wide coverage map: speed across, stability up. Every disc you carry is a
 * dot; shaded rectangles are the slots the API flagged as gaps, each with a
 * cross-hair at the exact flight numbers it wants filled.
 */
export function StabilitySpeedMap({ bag, gaps, recommended }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const x = (speed: number) =>
    PAD.left + ((speed - SPEED[0]) / (SPEED[1] - SPEED[0])) * (W - PAD.left - PAD.right);
  const y = (stab: number) =>
    PAD.top + ((STAB[1] - stab) / (STAB[1] - STAB[0])) * (H - PAD.top - PAD.bottom);

  const points = useMemo(
    () => bag.map((disc) => ({ disc, cx: x(disc.speed), cy: y(stabilityIndex(disc)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bag],
  );

  const speedTicks = [2, 4, 6, 8, 10, 12, 14];
  const stabTicks = [-4, -2, 0, 2, 4];

  return (
    <figure className="coverage-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bag coverage: disc speed versus stability">
        <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={y(2) - PAD.top} className="coverage-map__band" />
        <rect x={PAD.left} y={y(-0.5)} width={W - PAD.left - PAD.right} height={H - PAD.bottom - y(-0.5)} className="coverage-map__band" />

        {gaps.map((gap) => {
          const speedBand = SLOT_SPEED[gap.slot];
          const stabBand = CLASS_STABILITY[gap.stabilityClass];
          if (!speedBand || !stabBand) return null;
          const gx = x(speedBand[0]);
          const gw = x(speedBand[1]) - gx;
          const gy = y(stabBand[1]);
          const gh = y(stabBand[0]) - gy;
          const tone = gap.selected ? 'selected' : gap.severity >= 1.2 ? 'high' : 'low';
          const label = `${SLOT_LABEL[gap.slot]} — ${gap.stabilityClass.replace(/_/g, ' ').toLowerCase()}`;
          return (
            <g key={`${gap.slot}/${gap.stabilityClass}`} className={`coverage-map__gap coverage-map__gap--${tone}`}>
              <rect x={gx} y={gy} width={gw} height={gh} rx="5" />
              <text x={gx + 8} y={gy + 15} textAnchor="start">
                gap
              </text>
              {/* The gap's target flight numbers, as a cross-hair. */}
              <g className="coverage-map__target" transform={`translate(${x(gap.target.speed)} ${y(stabilityIndex(gap.target))})`}>
                <line x1="-7" x2="7" y1="0" y2="0" />
                <line x1="0" x2="0" y1="-7" y2="7" />
                <circle cx="0" cy="0" r="5" />
              </g>
              <title>
                {`${label} (severity ${gap.severity.toFixed(1)}) — target ${num(gap.target.speed)} / ${num(gap.target.glide)} / ${num(gap.target.turn)} / ${num(gap.target.fade)}. ${gap.reason}`}
              </title>
            </g>
          );
        })}

        {speedTicks.map((t) => (
          <g key={t} className="coverage-map__grid">
            <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={H - PAD.bottom} />
            <text x={x(t)} y={H - PAD.bottom + 18} textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        {stabTicks.map((t) => (
          <g key={t} className={`coverage-map__grid${t === 0 ? ' coverage-map__grid--zero' : ''}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end">
              {t > 0 ? `+${t}` : t}
            </text>
          </g>
        ))}

        <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="coverage-map__axis-label">
          Speed →
        </text>
        <text
          x={-(H - PAD.bottom + PAD.top) / 2}
          y={16}
          transform="rotate(-90)"
          textAnchor="middle"
          className="coverage-map__axis-label"
        >
          ← understable · stability · overstable →
        </text>

        {points.map(({ disc, cx, cy }) => (
          <g
            key={disc.id}
            className={`coverage-map__point${hovered === disc.id ? ' is-hovered' : ''}`}
            onMouseEnter={() => setHovered(disc.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <circle cx={cx} cy={cy} r="7" />
            <text x={cx} y={cy - 12} textAnchor="middle">
              {disc.name}
            </text>
            <title>{`${disc.brand} ${disc.name} — ${num(disc.speed)} / ${num(disc.glide)} / ${num(disc.turn)} / ${num(disc.fade)}`}</title>
          </g>
        ))}

        {recommended && (
          <g className="coverage-map__recommended">
            <circle cx={x(recommended.speed)} cy={y(stabilityIndex(recommended))} r="13" className="coverage-map__halo" />
            <circle cx={x(recommended.speed)} cy={y(stabilityIndex(recommended))} r="7" />
            <text x={x(recommended.speed)} y={y(stabilityIndex(recommended)) - 22} textAnchor="middle">
              {recommended.name}
            </text>
            <title>{`Recommended: ${recommended.brand} ${recommended.name}`}</title>
          </g>
        )}
      </svg>
      <figcaption className="coverage-map__legend">
        <span className="legend-key legend-key--disc">In your bag</span>
        <span className="legend-key legend-key--rec">Recommended</span>
        <span className="legend-key legend-key--gap">Coverage gap</span>
        <span className="legend-key legend-key--target">Gap target</span>
      </figcaption>
    </figure>
  );
}
