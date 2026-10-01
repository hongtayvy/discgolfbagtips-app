import type { Disc, PlayerProfile, SkillLevel, Weather } from '../api/types';

/**
 * Flight-path model.
 *
 * A disc's line is modelled as two overlapping lateral components applied to a
 * downrange axis:
 *
 *   turn  — a mid-flight bulge, peaking around 2/3 of the way down the fairway,
 *           scaled by how much of the disc's rated speed the thrower can supply
 *   fade  — a late, monotonic pull that dominates the last third of the flight
 *
 * Both are modulated by the player's power and by conditions, because the same
 * disc flies more overstable for a slower arm, in cold air, or into wind. The
 * output is normalized (downrange 0..1, lateral roughly -1..1) so the SVG layer
 * only has to scale it.
 */

export interface FlightContext {
  profile?: PlayerProfile;
  weather?: Weather;
}

export interface Point {
  x: number;
  y: number;
}

const POWER: Record<SkillLevel, number> = {
  BEGINNER: 0.68,
  INTERMEDIATE: 0.86,
  ADVANCED: 1.0,
  PROFESSIONAL: 1.12,
};

/**
 * Numeric stability used for plotting. The API ships an authoritative display
 * string (`disc.stability`) — prefer that in text, and use this only where the
 * value has to be a coordinate.
 */
export const stabilityIndex = (d: Pick<Disc, 'turn' | 'fade'>) => d.turn + d.fade;

/**
 * Turns the API's `STABLE` / `VERY_OVERSTABLE` classes into display text.
 * Takes `unknown` on purpose — this renders values that may have come from
 * storage written by an older build.
 */
export function humanizeStability(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/_/g, ' ').toLowerCase().trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

/**
 * Environmental multipliers on power, turn expression and fade, matching how the
 * API describes each weather: thin hot air turns more and carries further, cold
 * dense air flies shorter and more overstable, rain costs grip and therefore
 * snap, wind makes everything play overstable.
 */
const WEATHER_EFFECT: Record<Weather, { power: number; turn: number; fade: number }> = {
  HOT: { power: 1.03, turn: 1.12, fade: 0.94 },
  NORMAL: { power: 1, turn: 1, fade: 1 },
  RAINY: { power: 0.93, turn: 0.9, fade: 1.05 },
  COLD: { power: 0.94, turn: 0.82, fade: 1.12 },
  WINDY: { power: 0.97, turn: 0.85, fade: 1.22 },
};

function modifiers(ctx: FlightContext) {
  const effect = WEATHER_EFFECT[ctx.weather ?? 'NORMAL'];
  return {
    power: POWER[ctx.profile?.skillLevel ?? 'INTERMEDIATE'] * effect.power,
    turnMult: effect.turn,
    fadeMult: effect.fade,
  };
}

/**
 * Applies the server's plastic/weight/wear stability shift to published flight
 * numbers, for drawing only. A disc that has beaten in gains turn; one that runs
 * stiff or overstable gains fade — which is how players describe the change.
 */
export function applyStabilityShift<T extends { turn: number; fade: number }>(
  flight: T,
  shift: number,
): T {
  if (!shift) return flight;
  return shift > 0 ? { ...flight, fade: flight.fade + shift } : { ...flight, turn: flight.turn + shift };
}

export interface FlightShape {
  points: Point[];
  /** 0..1 — how far downrange this disc carries relative to a max-distance driver. */
  reach: number;
  /** Signed lateral finish position; negative = finishes left for the thrower. */
  finish: number;
  /** Peak lateral excursion during the turn phase. */
  peakTurn: number;
}

export function flightShape(
  disc: Pick<Disc, 'speed' | 'glide' | 'turn' | 'fade'>,
  ctx: FlightContext = {},
  samples = 60,
): FlightShape {
  const { power, turnMult, fadeMult } = modifiers(ctx);

  // How much of the disc's rated speed the thrower actually delivers. Above 1
  // the disc turns as rated; below it, turn is suppressed and fade takes over.
  const demand = 0.55 + disc.speed / 22;
  const delivery = clamp(power / demand, 0.28, 1.25);
  const turnExpression = delivery * turnMult;
  const fadeExpression = clamp(1.75 - delivery * 0.85, 0.75, 1.7) * fadeMult;

  const turnAmp = -disc.turn * turnExpression * 0.14;
  const fadeAmp = disc.fade * fadeExpression * 0.11;

  // BOTH has no single handedness, so it draws as a backhand line.
  const mirror = ctx.profile?.throwingStyle === 'FOREHAND' ? -1 : 1;

  const points: Point[] = [];
  let peakTurn = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // Bell peaking at t = 2/3, normalized to 1.
    const bell = 6.75 * t * t * (1 - t);
    const late = Math.pow(t, 3.2);
    const x = (turnAmp * bell - fadeAmp * late) * mirror;
    if (Math.abs(x) > Math.abs(peakTurn) && t < 0.75) peakTurn = x;
    points.push({ x, y: t });
  }

  // Reach: speed and glide both add carry; power scales the whole thing, and a
  // disc thrown well under its speed requirement loses distance.
  const raw = (disc.speed * 0.62 + disc.glide * 1.1) * power * (0.72 + delivery * 0.28);
  return {
    points,
    reach: clamp(raw / 13, 0.42, 1),
    finish: points[points.length - 1].x,
    peakTurn,
  };
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** One-line, plain-language read of the modelled line. */
export function describeFlight(shape: FlightShape, style: PlayerProfile['throwingStyle'] = 'BACKHAND'): string {
  const right = style === 'BACKHAND' ? 'right' : 'left';
  const left = style === 'BACKHAND' ? 'left' : 'right';
  const turned = Math.abs(shape.peakTurn) > 0.06 && Math.sign(shape.peakTurn) === (style === 'BACKHAND' ? 1 : -1);
  const fadeAmount = Math.abs(shape.finish);

  if (turned && fadeAmount < 0.08) return `Turns ${right} and holds the line to the ground.`;
  if (turned) return `Flips ${right}, then comes back ${left} at the end — a true S-curve.`;
  if (fadeAmount > 0.28) return `Fights hard ${left} the whole way with a sharp finish.`;
  if (fadeAmount > 0.12) return `Flies straight, then finishes gently ${left}.`;
  return `Holds a straight line with almost no finish.`;
}
