import { describe, expect, it } from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  isValidEmailAddress,
  isValidPassword,
  passwordsMatch,
} from '../authValidation';

describe('authValidation', () => {
  it('accepts valid email addresses after trimming whitespace', () => {
    expect(isValidEmailAddress('  user@example.com  ')).toBe(true);
  });

  it('rejects malformed email addresses', () => {
    expect(isValidEmailAddress('invalid-email')).toBe(false);
    expect(isValidEmailAddress('user@example')).toBe(false);
  });

  it('requires passwords to meet the minimum length', () => {
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it('only treats non-empty identical passwords as matching', () => {
    expect(passwordsMatch('secret1', 'secret1')).toBe(true);
    expect(passwordsMatch('secret1', 'secret2')).toBe(false);
    expect(passwordsMatch('', '')).toBe(false);
  });
});
