// Tests for the form validation helpers (src/utils/validation.js).
import { describe, it, expect } from 'vitest';
import {
  required,
  maxLength,
  minLength,
  isEmail,
  runRules,
  CHAR_LIMITS,
  isBlank,
} from '../utils/validation.js';

describe('validation helpers', () => {
  it('required: blank fails with a message, non-blank passes', () => {
    expect(required('')).toBeTruthy();
    expect(required('   ')).toBeTruthy();
    expect(required(null)).toBeTruthy();
    expect(required('x')).toBeNull();
  });

  it('CHAR_LIMITS has the expected title limit', () => {
    expect(CHAR_LIMITS.title).toBe(120);
  });

  it('maxLength: message mentions the limit', () => {
    const msg = maxLength(3)('abcd');
    expect(msg).toBeTruthy();
    expect(msg).toContain('3');
    expect(maxLength(3)('abc')).toBeNull();
    expect(maxLength(3)('ab')).toBeNull();
  });

  it('minLength: short value fails', () => {
    const msg = minLength(8, 'Password')('short');
    expect(msg).toBeTruthy();
    expect(msg).toContain('8');
    expect(minLength(8, 'Password')('longenough')).toBeNull();
  });

  it('isEmail: valid passes, invalid fails', () => {
    expect(isEmail('a@b.c')).toBeNull();
    expect(isEmail('user@example.com')).toBeNull();
    expect(isEmail('nope')).toBeTruthy();
    expect(isEmail('a@b')).toBeTruthy();
  });

  it('runRules: returns the first failing rule', () => {
    const first = 'FIRST';
    const second = 'SECOND';
    expect(runRules('', [() => first, () => second])).toBe(first);
    expect(runRules('', [() => null, () => second])).toBe(second);
    expect(runRules('', [() => null, () => null])).toBeNull();
  });

  it('isBlank detects blank values', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('x')).toBe(false);
  });
});
