import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chosenSettings, diffSettings, fromWire, NO_SETTINGS, toWire } from './accountSettings.ts';

describe('fromWire', () => {
  it('reads every field and lowercases the spellings the front end uses', () => {
    assert.deepEqual(
      fromWire({
        skillLevel: 'ADVANCED',
        skillInputMode: 'PDGA',
        pdgaRating: 925,
        throwingStyle: 'FOREHAND',
        courseType: 'WOODED',
        theme: 'DARK',
      }),
      {
        skillLevel: 'ADVANCED',
        skillInputMode: 'pdga',
        pdgaRating: 925,
        throwingStyle: 'FOREHAND',
        courseType: 'WOODED',
        theme: 'dark',
      },
    );
  });

  it('treats an unset player as having chosen nothing', () => {
    assert.deepEqual(
      fromWire({ skillLevel: null, skillInputMode: null, pdgaRating: null, throwingStyle: null, courseType: null, theme: null }),
      NO_SETTINGS,
    );
  });

  it('drops values this build does not know instead of applying them', () => {
    const got = fromWire({ skillLevel: 'WIZARD', theme: 'SEPIA', pdgaRating: '925', courseType: 4, skillInputMode: 'auto' });
    assert.deepEqual(got, NO_SETTINGS);
  });

  it('survives a body that is not an object', () => {
    for (const junk of [null, undefined, 'x', 3, []]) assert.deepEqual(fromWire(junk), NO_SETTINGS);
  });

  it('rejects a fractional rating', () => {
    assert.equal(fromWire({ pdgaRating: 925.5 }).pdgaRating, null);
  });
});

describe('toWire', () => {
  it('sends only the fields in the patch', () => {
    assert.deepEqual(toWire({ theme: 'dark' }), { theme: 'DARK' });
    assert.deepEqual(toWire({ skillInputMode: 'level', skillLevel: 'BEGINNER' }), {
      skillInputMode: 'LEVEL',
      skillLevel: 'BEGINNER',
    });
  });

  it('sends an explicit null to clear a field', () => {
    assert.deepEqual(toWire({ pdgaRating: null }), { pdgaRating: null });
    assert.deepEqual(toWire({ theme: null }), { theme: null });
  });

  it('round-trips through the API spelling', () => {
    const snapshot = fromWire({ skillInputMode: 'PDGA', theme: 'LIGHT', pdgaRating: 1000 });
    const wire = toWire(snapshot);
    assert.equal(wire.skillInputMode, 'PDGA');
    assert.equal(wire.theme, 'LIGHT');
    assert.equal(wire.pdgaRating, 1000);
  });
});

describe('diffSettings', () => {
  const server = { ...NO_SETTINGS, skillLevel: 'ADVANCED' as const, theme: 'dark' as const };

  it('is empty when nothing changed', () => {
    assert.deepEqual(diffSettings(server, { ...server }), {});
  });

  it('names only what changed', () => {
    assert.deepEqual(diffSettings(server, { ...server, courseType: 'OPEN' }), { courseType: 'OPEN' });
  });

  it('seeds fields the server has not got yet from the local value', () => {
    const local = { ...server, skillInputMode: 'level' as const };
    assert.deepEqual(diffSettings(server, local), { skillInputMode: 'level' });
  });

  it('asks to clear a field the player emptied locally', () => {
    const withRating = { ...server, pdgaRating: 925 };
    assert.deepEqual(diffSettings(withRating, { ...withRating, pdgaRating: null }), { pdgaRating: null });
  });
});

describe('chosenSettings', () => {
  it('keeps only fields the player has set', () => {
    assert.deepEqual(chosenSettings({ ...NO_SETTINGS, theme: 'dark', skillLevel: 'BEGINNER' }), {
      theme: 'dark',
      skillLevel: 'BEGINNER',
    });
    assert.deepEqual(chosenSettings(NO_SETTINGS), {});
  });
});
