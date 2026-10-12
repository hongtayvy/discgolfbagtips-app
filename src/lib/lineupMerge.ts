import type { BagLineupResponse } from '../api/types';

/** True when any gap has nothing to suggest, so a wider search is worth making. */
export function hasEmptyGaps(lineup: BagLineupResponse): boolean {
  return lineup.slots.some((slot) => slot.gaps.some((gap) => gap.suggestions.length === 0));
}

/**
 * Fills gaps the brand filter left empty with the closest discs from the
 * unfiltered search, and marks those gaps so the UI can say so.
 *
 * Gaps themselves do not depend on the brand filter — only their suggestions do
 * — so a gap in the filtered result is matched to the same slot + stability
 * class in the unfiltered one. Gaps that already have suggestions are left
 * exactly as the filtered search returned them.
 */
export function fillEmptyGaps(filtered: BagLineupResponse, unfiltered: BagLineupResponse): BagLineupResponse {
  return {
    ...filtered,
    slots: filtered.slots.map((slot) => {
      const wider = unfiltered.slots.find((s) => s.slot === slot.slot);
      return {
        ...slot,
        gaps: slot.gaps.map((gap) => {
          if (gap.suggestions.length > 0) return gap;
          const fallback = wider?.gaps.find((g) => g.stabilityClass === gap.stabilityClass);
          if (!fallback?.suggestions.length) return gap;
          return { ...gap, suggestions: fallback.suggestions, outsideFilter: true };
        }),
      };
    }),
  };
}
