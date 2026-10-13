import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BagSummary } from '../api/types';
import { filterBags } from './bagSearch.ts';

const bag = (id: number, brand: string, model: string, bagType = 'BACKPACK', buildTier: string | null = null): BagSummary => ({
  id,
  brand,
  model,
  bagType,
  buildTier,
  capacityMin: null,
  capacityMax: 20,
  emptyWeightGrams: null,
  emptyWeightPounds: null,
  heightIn: null,
  widthIn: null,
  depthIn: null,
  carryOnCompliant: null,
  source: null,
  notes: null,
});

const catalog = [
  bag(1, 'Dynamic Discs', 'Ballista Pro'),
  bag(2, 'Grip', 'EQ BX3', 'BACKPACK', 'PREMIUM'),
  bag(3, 'Innova', 'Pro Tour', 'TOUR'),
  bag(4, 'Discmania', 'Fanatic Sling', 'SLING'),
  bag(5, 'Prodigy', 'BP-1 V3'),
];

const ids = (list: BagSummary[]) => list.map((b) => b.id);

describe('filterBags', () => {
  it('lists everything alphabetically when nothing is typed', () => {
    assert.deepEqual(ids(filterBags(catalog, '')), [4, 1, 2, 3, 5]);
    assert.deepEqual(ids(filterBags(catalog, '   ')), [4, 1, 2, 3, 5]);
  });

  it('finds by model or brand, ignoring case', () => {
    assert.deepEqual(ids(filterBags(catalog, 'BALLISTA')), [1]);
    assert.deepEqual(ids(filterBags(catalog, 'innova')), [3]);
  });

  it('needs every word but not in order', () => {
    assert.deepEqual(ids(filterBags(catalog, 'ballista dynamic')), [1]);
    assert.deepEqual(ids(filterBags(catalog, 'dynamic xyz')), []);
  });

  it('matches the type and build tier too', () => {
    assert.deepEqual(ids(filterBags(catalog, 'sling')), [4]);
    assert.deepEqual(ids(filterBags(catalog, 'premium')), [2]);
  });

  it('ranks matches that start a word above ones that only contain it', () => {
    // "pro" starts "Pro Tour" and "Prodigy"/"Ballista Pro"; "Dynamic Discs" has none.
    const found = ids(filterBags(catalog, 'pro'));
    assert.deepEqual(found.sort(), [1, 3, 5]);
  });

  it('copes with punctuation in what is typed', () => {
    assert.deepEqual(ids(filterBags(catalog, 'bp-1')), [5]);
    assert.deepEqual(ids(filterBags(catalog, 'eq bx3')), [2]);
  });
});
