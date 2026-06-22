import { describe, expect, it } from 'vitest';

import {
  getExpectedNextSpeakerGender,
  validateSpeakerGenderQuota,
} from '../speakerListGenderQuota';

describe('speakerListGenderQuota', () => {
  it('allows any binary gender on an empty quoted list', () => {
    expect(
      validateSpeakerGenderQuota({
        enabled: true,
        speakerGender: 'male',
        speakers: [],
      }).allowed
    ).toBe(true);
    expect(
      validateSpeakerGenderQuota({
        enabled: true,
        speakerGender: 'female',
        speakers: [],
      }).allowed
    ).toBe(true);
  });

  it('expects female after male and male after female', () => {
    expect(
      getExpectedNextSpeakerGender([{ order_index: 1, completed: false, user: { gender: 'male' } }])
    ).toBe('female');
    expect(
      getExpectedNextSpeakerGender([
        { order_index: 1, completed: false, user: { gender: 'female' } },
      ])
    ).toBe('male');
  });

  it('blocks repeated binary gender when quota is enabled', () => {
    const result = validateSpeakerGenderQuota({
      enabled: true,
      speakerGender: 'male',
      speakers: [{ order_index: 1, completed: false, user: { gender: 'male' } }],
    });

    expect(result).toEqual({
      allowed: false,
      expectedGender: 'female',
      reason: 'expected-female',
    });
  });

  it('blocks diverse or missing gender when quota is enabled', () => {
    expect(
      validateSpeakerGenderQuota({
        enabled: true,
        speakerGender: 'diverse',
        speakers: [],
      }).reason
    ).toBe('unsupported-gender');
    expect(
      validateSpeakerGenderQuota({
        enabled: true,
        speakerGender: null,
        speakers: [],
      }).reason
    ).toBe('missing-gender');
  });

  it('ignores completed speakers when calculating the next expected gender', () => {
    const result = validateSpeakerGenderQuota({
      enabled: true,
      speakerGender: 'female',
      speakers: [
        { order_index: 1, completed: false, user: { gender: 'male' } },
        { order_index: 2, completed: true, user: { gender: 'female' } },
      ],
    });

    expect(result.allowed).toBe(true);
    expect(result.expectedGender).toBe('female');
  });

  it('does not enforce anything when quota is disabled', () => {
    expect(
      validateSpeakerGenderQuota({
        enabled: false,
        speakerGender: null,
        speakers: [{ order_index: 1, completed: false, user: { gender: 'male' } }],
      }).allowed
    ).toBe(true);
  });
});
