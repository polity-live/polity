import { describe, expect, it } from 'vitest';

import { getCreateVisibilityLabelKey, type CreateVisibility } from '../createVisibility';

describe('create visibility labels', () => {
  const localizedLabels = {
    'pages.create.common.public': 'Öffentlich',
    'pages.create.common.authenticated': 'Authentifiziert',
    'pages.create.common.private': 'Privat',
  } as const;

  it.each<readonly [CreateVisibility, keyof typeof localizedLabels, string]>([
    ['public', 'pages.create.common.public', 'Öffentlich'],
    ['authenticated', 'pages.create.common.authenticated', 'Authentifiziert'],
    ['private', 'pages.create.common.private', 'Privat'],
  ])('maps %s by semantic value', (visibility, expectedKey, expectedLabel) => {
    const key = getCreateVisibilityLabelKey(visibility);

    expect(key).toBe(expectedKey);
    expect(localizedLabels[key]).toBe(expectedLabel);
  });
});
