import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBag, parseBagModelId, parseDisc, parseProfile } from './validate.ts';

const disc = {
  id: 'b61c0b30-f06b-5f66-a567-78287b003869',
  name: 'Buzzz',
  brand: 'Discraft',
  category: 'Midrange',
  speed: 5,
  glide: 4,
  turn: -1,
  fade: 1,
  stability: 'stable',
  slot: 'MIDRANGE',
};

/** The exact shape a session saved before the API rewrite holds. */
const preRewriteDisc = {
  id: 'discraft-buzzz',
  name: 'Buzzz',
  brand: 'Discraft',
  category: 'midrange',
  speed: 5,
  glide: 4,
  turn: -1,
  fade: 1,
  stability: 0, // was turn + fade, a number
};

describe('validate', () => {
  it('accepts a current disc', () => {
    assert.deepEqual(parseDisc(disc)?.id, disc.id);
  });

  it('rejects a pre-rewrite disc rather than crashing a render', () => {
    // Regression: a numeric `stability` reached humanizeStability and threw
    // `value.replace is not a function`, unmounting the whole app.
    assert.equal(parseDisc(preRewriteDisc), null);
  });

  it('rejects a numeric stability specifically', () => {
    assert.equal(parseDisc({ ...disc, stability: 0 })?.stability, '');
    assert.equal(parseDisc({ ...disc, slot: undefined }), null);
  });

  it('rejects a disc with no slot', () => {
    const { slot: _slot, ...noSlot } = disc;
    assert.equal(parseDisc(noSlot), null);
  });

  it('rejects lowercase profile enums from an older build', () => {
    assert.equal(
      parseProfile({ skillLevel: 'intermediate', throwingStyle: 'backhand', courseType: 'mixed' }),
      null,
    );
  });

  it('accepts current profile enums', () => {
    assert.deepEqual(parseProfile({ skillLevel: 'ADVANCED', throwingStyle: 'FOREHAND', courseType: 'WOODED' }), {
      skillLevel: 'ADVANCED',
      throwingStyle: 'FOREHAND',
      courseType: 'WOODED',
    });
  });

  it('rejects a whole bag if any disc is stale', () => {
    assert.equal(parseBag([disc, preRewriteDisc]), null);
  });

  it('drops duplicates in a valid bag', () => {
    assert.equal(parseBag([disc, disc])?.length, 1);
  });

  it('rejects non-arrays and oversized bags', () => {
    assert.equal(parseBag('nope'), null);
    assert.equal(parseBag(Array.from({ length: 31 }, (_, i) => ({ ...disc, id: `d${i}` }))), null);
  });

  it('accepts an empty bag', () => {
    assert.deepEqual(parseBag([]), []);
  });

  it('keeps valid plastic, weight and wear', () => {
    const parsed = parseDisc({ ...disc, plastic: 'ESP', weightGrams: 177, wear: 'BEAT_IN' });
    assert.equal(parsed?.plastic, 'ESP');
    assert.equal(parsed?.weightGrams, 177);
    assert.equal(parsed?.wear, 'BEAT_IN');
  });

  it('drops bad ownership detail without failing the whole disc', () => {
    // Absent means "unspecified", which the server treats as published numbers,
    // so a junk value should degrade rather than reject a real disc.
    const parsed = parseDisc({ ...disc, plastic: 42, weightGrams: 900, wear: 'SHREDDED' });
    assert.ok(parsed);
    assert.equal(parsed.plastic, undefined);
    assert.equal(parsed.weightGrams, undefined);
    assert.equal(parsed.wear, undefined);
  });

  it('leaves ownership detail unset when absent', () => {
    const parsed = parseDisc(disc);
    assert.equal(parsed?.plastic, undefined);
    assert.equal(parsed?.wear, undefined);
  });

  it('accepts BOTH as a throwing style', () => {
    assert.deepEqual(
      parseProfile({ skillLevel: 'ADVANCED', throwingStyle: 'BOTH', courseType: 'MIXED' })?.throwingStyle,
      'BOTH',
    );
  });

  it('treats an unset bag model as valid, and junk as droppable', () => {
    // undefined means "no bag selected"; null means the stored value is unusable.
    assert.equal(parseBagModelId(undefined), undefined);
    assert.equal(parseBagModelId(null), undefined);
    assert.equal(parseBagModelId(4), 4);
    assert.equal(parseBagModelId(0), null);
    assert.equal(parseBagModelId(-1), null);
    assert.equal(parseBagModelId(2.5), null);
    assert.equal(parseBagModelId('4'), null);
    assert.equal(parseBagModelId({}), null);
  });
});
