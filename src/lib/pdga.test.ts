import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelForRating, parseRating, rangeLabel } from './pdga.ts';
import { clampShift } from './ui.ts';

describe('PDGA rating → level', () => {
  it('puts each boundary on the right side', () => {
    assert.equal(levelForRating(849), 'BEGINNER');
    assert.equal(levelForRating(850), 'INTERMEDIATE');
    assert.equal(levelForRating(899), 'INTERMEDIATE');
    assert.equal(levelForRating(900), 'ADVANCED');
    assert.equal(levelForRating(969), 'ADVANCED');
    assert.equal(levelForRating(970), 'PROFESSIONAL');
  });

  it('handles the extremes', () => {
    assert.equal(levelForRating(200), 'BEGINNER');
    assert.equal(levelForRating(1065), 'PROFESSIONAL');
  });

  it('labels each band for display', () => {
    assert.equal(rangeLabel('BEGINNER'), 'under 850');
    assert.equal(rangeLabel('INTERMEDIATE'), '850–899');
    assert.equal(rangeLabel('ADVANCED'), '900–969');
    assert.equal(rangeLabel('PROFESSIONAL'), '970+');
  });
});

describe('parseRating', () => {
  it('accepts plausible ratings, ignoring surrounding space', () => {
    assert.equal(parseRating('925'), 925);
    assert.equal(parseRating(' 1002 '), 1002);
  });

  it('rejects things that are not ratings', () => {
    for (const bad of ['', '  ', '92', '9', 'abc', '92x', '9.25', '-900', '12345', '199', '1201']) {
      assert.equal(parseRating(bad), null, JSON.stringify(bad));
    }
  });
});

describe('clampShift', () => {
  it('leaves a panel that fits alone', () => {
    assert.equal(clampShift(40, 340, 12, 788), 0);
  });
  it('pulls a panel back from the right bound', () => {
    assert.equal(clampShift(600, 920, 12, 788), 788 - 920);
  });
  it('pulls a panel back from the left bound', () => {
    assert.equal(clampShift(-80, 220, 12, 788), 12 + 80);
  });
  it('pins a panel wider than the space to the start', () => {
    assert.equal(clampShift(0, 900, 12, 348), 12);
  });
});
