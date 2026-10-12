import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readStoredTheme } from './theme.ts';

const original = globalThis.localStorage;
const stub = (impl: Partial<Storage> | undefined) =>
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true });

describe('stored theme', () => {
  afterEach(() => stub(original));

  it('is light when nothing has been chosen', () => {
    stub({ getItem: () => null });
    assert.equal(readStoredTheme(), 'light');
  });

  it('is dark only when the user picked dark', () => {
    stub({ getItem: () => 'dark' });
    assert.equal(readStoredTheme(), 'dark');
  });

  it('treats anything unrecognised as light', () => {
    for (const junk of ['', 'DARK', 'auto', 'system', '1']) {
      stub({ getItem: () => junk });
      assert.equal(readStoredTheme(), 'light', JSON.stringify(junk));
    }
  });

  it('falls back to light when storage is blocked', () => {
    stub({ getItem: () => { throw new Error('SecurityError'); } });
    assert.equal(readStoredTheme(), 'light');
  });
});
