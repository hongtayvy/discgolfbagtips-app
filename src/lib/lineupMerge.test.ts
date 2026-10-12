import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fillEmptyGaps, hasEmptyGaps } from './lineupMerge.ts';
import type { BagLineupResponse, SlotGap, SlotLineup, SuggestedDisc } from '../api/types.ts';

const disc = (id: string): SuggestedDisc => ({
  discId: id, name: id, brand: 'B', speed: 5, glide: 4, turn: 0, fade: 2, stability: 'stable', similarity: 0.9,
});
const gap = (stabilityClass: string, ids: string[]): SlotGap => ({
  stabilityClass, label: stabilityClass.toLowerCase(), behaviour: '', severity: 1, reason: '',
  target: { speed: 5, glide: 4, turn: 0, fade: 2 }, suggestions: ids.map(disc),
});
const slot = (name: SlotLineup['slot'], gaps: SlotGap[]): SlotLineup => ({
  slot: name, label: name, purpose: '', minSpeed: 0, maxSpeed: 20, status: 'THIN', discCount: 1,
  inBag: [], stabilityCoverage: [], gaps, redundancies: [], summary: '',
});
const lineup = (...slots: SlotLineup[]): BagLineupResponse => ({
  sessionId: 's', generatedAt: '', coverageScore: 0, discCount: 0, slots, carriedBag: null,
  carryWeight: null, betterFittingBags: [], notes: [], unresolvedEntries: [],
  explainability: { retrievalMode: 'VECTOR_SIMILARITY', appliedFilters: '', embedding: { provider: '', model: '', dimensions: 0, stubbed: false }, gapsConsidered: 0, gapsRetrieved: 0, degradations: [], totalMs: 0 },
});

describe('fillEmptyGaps', () => {
  it('fills an empty gap from the unfiltered search and marks it', () => {
    const filtered = lineup(slot('MIDRANGE', [gap('OVERSTABLE', [])]));
    const wider = lineup(slot('MIDRANGE', [gap('OVERSTABLE', ['x', 'y'])]));
    const out = fillEmptyGaps(filtered, wider);
    const g = out.slots[0].gaps[0];
    assert.deepEqual(g.suggestions.map((s) => s.discId), ['x', 'y']);
    assert.equal(g.outsideFilter, true);
  });

  it('leaves gaps that already have suggestions untouched', () => {
    const filtered = lineup(slot('MIDRANGE', [gap('STABLE', ['mine'])]));
    const wider = lineup(slot('MIDRANGE', [gap('STABLE', ['other'])]));
    const g = fillEmptyGaps(filtered, wider).slots[0].gaps[0];
    assert.deepEqual(g.suggestions.map((s) => s.discId), ['mine']);
    assert.equal(g.outsideFilter, undefined);
  });

  it('matches on slot and stability class, not position', () => {
    const filtered = lineup(
      slot('MIDRANGE', [gap('STABLE', ['a']), gap('OVERSTABLE', [])]),
    );
    const wider = lineup(slot('MIDRANGE', [gap('OVERSTABLE', ['w']), gap('STABLE', ['z'])]));
    const gaps = fillEmptyGaps(filtered, wider).slots[0].gaps;
    assert.deepEqual(gaps[0].suggestions.map((s) => s.discId), ['a']);
    assert.deepEqual(gaps[1].suggestions.map((s) => s.discId), ['w']);
  });

  it('keeps a gap empty (unmarked) when even the wider search has nothing', () => {
    const filtered = lineup(slot('MIDRANGE', [gap('OVERSTABLE', [])]));
    const wider = lineup(slot('MIDRANGE', [gap('OVERSTABLE', [])]));
    const g = fillEmptyGaps(filtered, wider).slots[0].gaps[0];
    assert.equal(g.suggestions.length, 0);
    assert.equal(g.outsideFilter, undefined);
  });

  it('does not borrow from a different slot', () => {
    const filtered = lineup(slot('MIDRANGE', [gap('OVERSTABLE', [])]));
    const wider = lineup(slot('FAIRWAY_DRIVER', [gap('OVERSTABLE', ['wrong-slot'])]));
    assert.equal(fillEmptyGaps(filtered, wider).slots[0].gaps[0].suggestions.length, 0);
  });
});

describe('hasEmptyGaps', () => {
  it('is true only when some gap has no suggestions', () => {
    assert.equal(hasEmptyGaps(lineup(slot('MIDRANGE', [gap('STABLE', ['a'])]))), false);
    assert.equal(hasEmptyGaps(lineup(slot('MIDRANGE', [gap('STABLE', ['a']), gap('OVERSTABLE', [])]))), true);
    assert.equal(hasEmptyGaps(lineup(slot('MIDRANGE', []))), false);
  });
});
