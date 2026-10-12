import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BagEntry } from '../api/types';
import { countByDisc, entryKey, newEntry, resolvedByEntry, withUniqueKeys } from './bagEntries.ts';

const disc = (id: string, extra: Partial<BagEntry> = {}): BagEntry => ({
  id,
  name: id,
  brand: 'Innova',
  slot: 'MIDRANGE',
  speed: 5,
  glide: 4,
  turn: 0,
  fade: 3,
  category: 'Midrange',
  stability: 'Stable',
  ...extra,
});

describe('newEntry', () => {
  it('keeps the catalog id as the key for the first copy', () => {
    assert.equal(entryKey(newEntry(disc('buzzz'), [])), 'buzzz');
  });

  it('keys later copies of the same mold distinctly', () => {
    const first = newEntry(disc('buzzz'), []);
    const second = newEntry(disc('buzzz'), [first]);
    const third = newEntry(disc('buzzz'), [first, second]);
    assert.deepEqual([first, second, third].map(entryKey), ['buzzz', 'buzzz#2', 'buzzz#3']);
  });

  it('reuses a freed key', () => {
    const first = newEntry(disc('buzzz'), []);
    const third = disc('buzzz', { entryId: 'buzzz#3' });
    assert.equal(entryKey(newEntry(disc('buzzz'), [first, third])), 'buzzz#2');
  });
});

describe('withUniqueKeys', () => {
  it('leaves an already-distinct bag alone', () => {
    const bag = [disc('a'), disc('b')];
    assert.deepEqual(withUniqueKeys(bag), bag);
  });

  it('keys repeats that arrive with no entry id, e.g. from a file', () => {
    const keyed = withUniqueKeys([disc('buzzz'), disc('buzzz'), disc('buzzz')]);
    assert.deepEqual(keyed.map(entryKey), ['buzzz', 'buzzz#2', 'buzzz#3']);
  });

  it('repairs colliding entry ids', () => {
    const keyed = withUniqueKeys([disc('buzzz', { entryId: 'buzzz#2' }), disc('buzzz', { entryId: 'buzzz#2' })]);
    assert.equal(new Set(keyed.map(entryKey)).size, 2);
  });
});

describe('countByDisc', () => {
  it('counts copies per catalog disc', () => {
    assert.deepEqual(countByDisc([disc('a'), disc('b'), disc('a', { entryId: 'a#2' })]), { a: 2, b: 1 });
  });
});

describe('resolvedByEntry', () => {
  const r = (discId: string, tag: string) => ({ discId, tag });

  it('pairs the nth copy with the nth resolved disc of that id', () => {
    const bag = [disc('buzzz'), disc('roc'), disc('buzzz', { entryId: 'buzzz#2' })];
    const matched = resolvedByEntry(bag, [r('buzzz', 'worn'), r('roc', 'roc'), r('buzzz', 'new')]);
    assert.equal(matched.get('buzzz')?.tag, 'worn');
    assert.equal(matched.get('buzzz#2')?.tag, 'new');
    assert.equal(matched.get('roc')?.tag, 'roc');
  });

  it('leaves entries the API could not resolve unmatched', () => {
    const bag = [disc('ghost'), disc('roc')];
    const matched = resolvedByEntry(bag, [r('roc', 'roc')]);
    assert.equal(matched.has('ghost'), false);
    assert.equal(matched.get('roc')?.tag, 'roc');
  });
});
