import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { delta, isVectorRetrieval, num } from './format.ts';

describe('formatting', () => {
  it('keeps whole flight numbers whole and decimals to one place', () => {
    assert.equal(num(5), '5');
    assert.equal(num(-0.5), '-0.5');
    assert.equal(num(4.5), '4.5');
  });

  it('signs deltas', () => {
    assert.equal(delta(1), '+1');
    assert.equal(delta(-1.5), '-1.5');
    assert.equal(delta(0), '0');
  });

  it('only trusts similarity from real vector retrieval', () => {
    // The flight-number fallback reports scores that can go negative, so they
    // must not be rendered as a "% match".
    assert.equal(isVectorRetrieval('VECTOR_SIMILARITY'), true);
    assert.equal(isVectorRetrieval('FLIGHT_NUMBER_FALLBACK'), false);
    assert.equal(isVectorRetrieval(''), false);
  });
});
