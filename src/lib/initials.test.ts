import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initialsFor } from './initials.ts';

describe('avatar initials', () => {
  it('takes one letter from each of the first two name parts', () => {
    assert.equal(initialsFor('jane.doe@example.com'), 'JD');
    assert.equal(initialsFor('victor_yang@example.com'), 'VY');
    assert.equal(initialsFor('a-b-c@example.com'), 'AB');
  });

  it('falls back to the first two letters of a single-part name', () => {
    assert.equal(initialsFor('sam@example.com'), 'SA');
    assert.equal(initialsFor('x@example.com'), 'X');
  });

  it('never returns an empty avatar', () => {
    assert.equal(initialsFor(''), '?');
    assert.equal(initialsFor('@example.com'), '?');
  });
});
