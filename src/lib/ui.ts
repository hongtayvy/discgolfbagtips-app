/**
 * How far to shift a floating panel horizontally so it sits inside `[min, max]`.
 * Positive moves it right, negative left; 0 when it already fits.
 *
 * The bounds are passed in rather than read from the window on purpose: a panel
 * that overflows is itself what makes `window.innerWidth` grow, so measuring
 * against the window can conclude that an overflowing panel "fits".
 */
export function clampShift(left: number, right: number, min: number, max: number): number {
  if (right - left > max - min) return min - left; // wider than the space: pin to the start
  if (left < min) return min - left;
  if (right > max) return max - right;
  return 0;
}
