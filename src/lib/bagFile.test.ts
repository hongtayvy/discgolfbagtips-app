import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BAG_FILE_FORMAT, bagFileName, parseBagFile, serializeBag, type BagSnapshot } from './bagFile.ts';

const snapshot: BagSnapshot = {
  bag: [
    { id: 'b61c0b30-f06b-5f66-a567-78287b003869', name: 'Buzzz', brand: 'Discraft', category: 'Midrange', speed: 5, glide: 4, turn: -1, fade: 1, stability: 'stable', slot: 'MIDRANGE', imageUrl: 'https://example.test/buzzz.webp' },
    { id: '66ea2174-bf5e-5e7a-a067-821c0b6e90b8', name: 'Buzzz OS', brand: 'Discraft', category: 'Midrange', speed: 5, glide: 4, turn: 0, fade: 3, stability: 'overstable', slot: 'MIDRANGE', imageUrl: 'https://example.test/buzzzos.webp' },
  ],
  profile: { skillLevel: 'ADVANCED', throwingStyle: 'FOREHAND', courseType: 'WOODED' },
};

const withOverrides = (overrides: Record<string, unknown>) =>
  JSON.stringify({ format: BAG_FILE_FORMAT, version: 4, ...snapshot, ...overrides });

describe('bag file', () => {
  it('round trips a bag and profile', () => {
    const parsed = parseBagFile(serializeBag(snapshot));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.data, snapshot);
  });

  it('does not carry weather, which is analysed per environment on load', () => {
    assert.ok(!('conditions' in JSON.parse(serializeBag(snapshot))));
  });

  it('names the file by date', () => {
    assert.equal(bagFileName(new Date('2026-08-30T10:00:00Z')), 'bag-tips-2026-08-30.json');
  });

  it('round trips plastic, weight and wear', () => {
    const owned = {
      ...snapshot,
      bag: [{ ...snapshot.bag[0], plastic: 'ESP', weightGrams: 177, wear: 'BEAT_IN' as const }],
    };
    const parsed = parseBagFile(serializeBag(owned));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.data.bag[0], owned.bag[0]);
  });

  it('still reads v2 and v3 exports, with the newer fields unset', () => {
    for (const version of [2, 3]) {
      const parsed = parseBagFile(JSON.stringify({ format: BAG_FILE_FORMAT, version, ...snapshot }));
      assert.ok(parsed.ok, `version ${version} should load`);
      assert.equal(parsed.data.bag.length, 2);
      assert.equal(parsed.data.bagModelId, undefined);
    }
  });

  it('writes the current version', () => {
    assert.equal(JSON.parse(serializeBag(snapshot)).version, 4);
  });

  it('round trips the carried bag model', () => {
    const withBag = { ...snapshot, bagModelId: 4 };
    const parsed = parseBagFile(serializeBag(withBag));
    assert.ok(parsed.ok);
    assert.equal(parsed.data.bagModelId, 4);
  });

  it('omits the bag model when none is selected', () => {
    assert.ok(!('bagModelId' in JSON.parse(serializeBag(snapshot))));
  });

  it('accepts BOTH as a throwing style', () => {
    const parsed = parseBagFile(
      withOverrides({ profile: { ...snapshot.profile, throwingStyle: 'BOTH' } }),
    );
    assert.ok(parsed.ok);
    assert.equal(parsed.data.profile.throwingStyle, 'BOTH');
  });

  it('drops duplicate discs', () => {
    const parsed = parseBagFile(withOverrides({ bag: [...snapshot.bag, snapshot.bag[0]] }));
    assert.ok(parsed.ok);
    assert.equal(parsed.data.bag.length, 2);
  });

  it('truncates oversized strings and drops unknown fields', () => {
    const parsed = parseBagFile(
      withOverrides({ bag: [{ ...snapshot.bag[0], name: 'A'.repeat(500), evil: '<script>' }] }),
    );
    assert.ok(parsed.ok);
    assert.equal(parsed.data.bag[0].name.length, 120);
    assert.ok(!('evil' in parsed.data.bag[0]));
  });

  const rejections: [string, string, string][] = [
    ['non-JSON', 'not json at all', 'valid JSON'],
    ['a foreign format', JSON.stringify({ format: 'something-else', version: 4 }), 'Bag Tips export'],
    ['a v1 export, whose disc ids predate the live catalog', JSON.stringify({ format: BAG_FILE_FORMAT, version: 1 }), 'older version'],
    ['a future version', JSON.stringify({ format: BAG_FILE_FORMAT, version: 99 }), 'Unsupported bag file version'],
    ['a missing bag', JSON.stringify({ format: BAG_FILE_FORMAT, version: 4 }), 'no bag'],
    ['an unknown skill level', withOverrides({ profile: { ...snapshot.profile, skillLevel: 'WIZARD' } }), 'player profile'],
    ['a lowercase enum', withOverrides({ profile: { ...snapshot.profile, courseType: 'wooded' } }), 'player profile'],
    ['a disc with an unknown slot', withOverrides({ bag: [{ ...snapshot.bag[0], slot: 'ROLLER' }] }), 'flight numbers'],
    ['a disc missing fade', withOverrides({ bag: [{ id: 'x', name: 'X', brand: 'Y', slot: 'MIDRANGE', speed: 5, glide: 4, turn: -1 }] }), 'flight numbers'],
    ['an out-of-range speed', withOverrides({ bag: [{ ...snapshot.bag[0], speed: 999 }] }), 'flight numbers'],
    ['an oversized bag', withOverrides({ bag: Array.from({ length: 31 }, (_, i) => ({ ...snapshot.bag[0], id: `d${i}` })) }), 'more than 30'],
  ];

  for (const [label, input, needle] of rejections) {
    it(`rejects ${label}`, () => {
      const parsed = parseBagFile(input);
      assert.ok(!parsed.ok);
      assert.match(parsed.error, new RegExp(needle));
    });
  }
});
