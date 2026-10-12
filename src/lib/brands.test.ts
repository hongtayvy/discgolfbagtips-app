import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferBrands, joinNames, MIN_DISCS_TO_INFER, resolveBrands } from './brands.ts';

const discs = (...brands: string[]) => brands.map((brand) => ({ brand }));

describe('inferBrands', () => {
  it('an all-Innova bag infers just Innova', () => {
    const r = inferBrands(discs('Innova', 'Innova', 'Innova'));
    assert.deepEqual(r.brands, ['Innova']);
    assert.equal(r.confident, true);
  });

  it('a mixed bag infers every brand in it, most-used first', () => {
    const r = inferBrands(discs('Discmania', 'Innova', 'Innova', 'Innova', 'Discmania', 'MVP'));
    assert.deepEqual(r.brands, ['Innova', 'Discmania', 'MVP']);
    assert.deepEqual(r.counts, { Innova: 3, Discmania: 2, MVP: 1 });
  });

  it('one disc is not enough to infer a preference', () => {
    const r = inferBrands(discs('Innova'));
    assert.equal(r.confident, false);
    assert.equal(MIN_DISCS_TO_INFER, 2);
  });

  it('merges case and whitespace variants but keeps the catalog spelling', () => {
    const r = inferBrands(discs('Innova', ' innova ', 'INNOVA'));
    assert.deepEqual(r.brands, ['Innova']);
    assert.equal(r.counts['Innova'], 3);
  });

  it('ignores discs with no brand', () => {
    const r = inferBrands(discs('Innova', '', '   ', 'Innova'));
    assert.deepEqual(r.brands, ['Innova']);
  });

  it('breaks ties alphabetically so the order is stable', () => {
    assert.deepEqual(inferBrands(discs('Zeta', 'Alpha')).brands, ['Alpha', 'Zeta']);
  });

  it('an empty bag infers nothing', () => {
    const r = inferBrands([]);
    assert.deepEqual(r.brands, []);
    assert.equal(r.confident, false);
  });
});

describe('resolveBrands', () => {
  const inferred = inferBrands(discs('Innova', 'Innova'));

  it('brands picked by hand always beat the bag', () => {
    const r = resolveBrands({ chosen: ['MVP'], inferred, matchBag: true });
    assert.deepEqual(r, { brands: ['MVP'], source: 'chosen' });
  });

  it('falls back to the bag when nothing was picked', () => {
    const r = resolveBrands({ chosen: undefined, inferred, matchBag: true });
    assert.deepEqual(r, { brands: ['Innova'], source: 'bag' });
  });

  it('matching the bag can be switched off', () => {
    const r = resolveBrands({ chosen: [], inferred, matchBag: false });
    assert.deepEqual(r, { brands: [], source: 'none' });
  });

  it('does not act on a bag too small to infer from', () => {
    const r = resolveBrands({ chosen: undefined, inferred: inferBrands(discs('Innova')), matchBag: true });
    assert.equal(r.source, 'none');
  });
});

describe('joinNames', () => {
  it('reads naturally', () => {
    assert.equal(joinNames([]), '');
    assert.equal(joinNames(['Innova']), 'Innova');
    assert.equal(joinNames(['Innova', 'Discmania']), 'Innova and Discmania');
    assert.equal(joinNames(['Innova', 'Discmania', 'MVP']), 'Innova, Discmania and MVP');
  });
});
