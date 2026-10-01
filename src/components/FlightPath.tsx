import { useId, useMemo } from 'react';
import { flightShape, type FlightContext } from '../lib/flight';
import type { Disc } from '../api/types';

interface Props {
  disc: Pick<Disc, 'speed' | 'glide' | 'turn' | 'fade'>;
  ctx?: FlightContext;
  width?: number;
  height?: number;
  /** Draws the fairway, distance ticks and the landing marker. */
  detailed?: boolean;
  accent?: string;
}

/**
 * Renders one disc's modelled line as a top-down S-curve: the thrower stands at
 * the bottom of the frame, the flight runs away from them up the page.
 */
export function FlightPath({
  disc,
  ctx = {},
  width = 108,
  height = 148,
  detailed = false,
  accent = 'var(--accent)',
}: Props) {
  const gradientId = useId();
  const shape = useMemo(() => flightShape(disc, ctx), [disc, ctx]);

  const padX = 8;
  const teeY = height - 10;
  const usable = height - 22;
  const halfW = width / 2 - padX;

  const project = (p: { x: number; y: number }) => ({
    // Lateral gain: the model's units are deliberately conservative, so the
    // drawing amplifies them to keep small differences readable at card size.
    px: width / 2 + Math.max(-1.05, Math.min(1.05, p.x * 1.7)) * halfW,
    py: teeY - p.y * shape.reach * usable,
  });

  const d = shape.points
    .map((p, i) => {
      const { px, py } = project(p);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(' ');

  const landing = project(shape.points[shape.points.length - 1]);

  return (
    <svg
      className="flight-path"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Modelled flight path: speed ${disc.speed}, glide ${disc.glide}, turn ${disc.turn}, fade ${disc.fade}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="45%" stopColor={accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={accent} stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect
        x={padX / 2}
        y={4}
        width={width - padX}
        height={height - 12}
        rx="6"
        className="flight-path__field"
      />

      {detailed &&
        [0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX / 2}
            x2={width - padX / 2}
            y1={teeY - f * usable}
            y2={teeY - f * usable}
            className="flight-path__tick"
          />
        ))}

      <line
        x1={width / 2}
        x2={width / 2}
        y1={teeY}
        y2={teeY - usable}
        className="flight-path__center"
      />

      <path d={d} className="flight-path__line" stroke={`url(#${gradientId})`} />

      <circle cx={landing.px} cy={landing.py} r={detailed ? 4 : 3} className="flight-path__landing" fill={accent} />
      <circle cx={width / 2} cy={teeY} r="2.5" className="flight-path__tee" />
    </svg>
  );
}
