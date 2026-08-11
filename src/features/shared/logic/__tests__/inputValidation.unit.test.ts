import { describe, expect, it } from 'vitest';

import {
  hasMinLength,
  isNonNegativeInteger,
  isOptionalMinLength,
  isPositiveInteger,
  isValidHouseNumberFormat,
  isValidOptionalEmailAddress,
  isValidOptionalSocialInput,
  isValidOptionalUrlLike,
  isValidSocialInput,
  isValidUrlLike,
} from '../inputValidation';

describe('inputValidation', () => {
  it('validates required and optional minimum lengths after trimming', () => {
    expect(hasMinLength('  abc  ', 3)).toBe(true);
    expect(hasMinLength(' ab ', 3)).toBe(false);
    expect(isOptionalMinLength('   ', 3)).toBe(true);
    expect(isOptionalMinLength(' abc ', 3)).toBe(true);
    expect(isOptionalMinLength(' ab ', 3)).toBe(false);
  });

  it('validates non-negative and positive integer text', () => {
    expect(isNonNegativeInteger(' 0 ')).toBe(true);
    expect(isNonNegativeInteger('-1')).toBe(false);
    expect(isPositiveInteger(' 12 ')).toBe(true);
    expect(isPositiveInteger('0')).toBe(false);
    expect(isPositiveInteger('1.5')).toBe(false);
  });

  it.each([
    ['https://example.org/path', true],
    ['example.org/path', true],
    ['http://localhost:3000/path', true],
    ['localhost:3000/path', true],
    ['intranet/path', false],
    ['123', false],
    ['file:///tmp/file', false],
    ['http://[invalid', false],
    ['   ', false],
  ])('validates URL-like input %j as %s', (value, expected) => {
    expect(isValidUrlLike(value)).toBe(expected);
  });

  it('allows empty optional URLs and validates populated optional URLs', () => {
    expect(isValidOptionalUrlLike('   ')).toBe(true);
    expect(isValidOptionalUrlLike('example.org')).toBe(true);
    expect(isValidOptionalUrlLike('invalid')).toBe(false);
  });

  it('allows empty optional emails and delegates populated email validation', () => {
    expect(isValidOptionalEmailAddress('   ')).toBe(true);
    expect(isValidOptionalEmailAddress(' user@example.org ')).toBe(true);
    expect(isValidOptionalEmailAddress('invalid-email')).toBe(false);
  });

  it.each([
    ['twitter', 'https://social.example.org/person', true],
    ['twitter', '@valid_handle', true],
    ['twitter', '@handle-that-is-too-long', false],
    ['linkedin', '/in/polity-team', true],
    ['linkedin', '@polity.team', true],
    ['linkedin', '!', false],
    ['whatsapp', '+49 123 456789', true],
    ['whatsapp', '123', false],
    ['instagram', '@polity.team', true],
    ['facebook', '!', false],
    ['youtube', '   ', false],
  ] as const)('validates %s social input %j as %s', (platform, value, expected) => {
    expect(isValidSocialInput(platform, value)).toBe(expected);
  });

  it('allows empty optional social values and validates populated values', () => {
    expect(isValidOptionalSocialInput('tiktok', '   ')).toBe(true);
    expect(isValidOptionalSocialInput('snapchat', '@polity')).toBe(true);
    expect(isValidOptionalSocialInput('snapchat', '!')).toBe(false);
  });

  it.each([
    ['12', true],
    ['12a', true],
    ['12-14', true],
    ['12/3', true],
    ['A12', false],
    ['', false],
  ])('validates house number %j as %s', (value, expected) => {
    expect(isValidHouseNumberFormat(value)).toBe(expected);
  });
});
