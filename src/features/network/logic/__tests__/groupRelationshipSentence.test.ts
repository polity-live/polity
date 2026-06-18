import { describe, expect, it } from 'vitest';

import {
  getGroupRelationshipNameText,
  getGroupRelationshipRightSentenceText,
  type TranslateFn,
} from '../groupRelationshipSentence';

const messages: Record<string, string> = {
  'common.network.thisGroup': 'Diese Gruppe',
  'common.network.thisGroupEmbedded': 'diese Gruppe',
  'common.network.thisGroupWithName': 'Diese Gruppe ({{groupName}})',
  'common.network.thisGroupWithNameEmbedded': 'diese Gruppe ({{groupName}})',
  'common.unspecified': 'Unbekannt',
  'common.network.currentGroupGivesRightTo':
    '{{currentGroupName}} gibt {{rightLabel}} an {{selectedGroupName}}',
  'common.network.currentGroupHasRightIn':
    '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
  'common.network.selectedGroupHasRightInCurrentGroup':
    '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
  'common.network.groupsMutuallyShareRight':
    '{{currentGroupName}} und {{selectedGroupName}} haben gegenseitig {{rightLabel}}',
};

const t: TranslateFn = (key, paramsOrFallback, fallback) => {
  const template =
    messages[key] ?? (typeof paramsOrFallback === 'string' ? paramsOrFallback : fallback) ?? key;
  const params = typeof paramsOrFallback === 'string' ? {} : (paramsOrFallback ?? {});

  return Object.entries(params).reduce((result, [paramKey, value]) => {
    return result.replaceAll(`{{${paramKey}}}`, String(value ?? ''));
  }, template);
};

describe('groupRelationshipSentence', () => {
  it('renders the current group label with its canonical sentence-start wording', () => {
    expect(
      getGroupRelationshipNameText({
        name: 'Basistest99',
        kind: 'current',
        t,
      })
    ).toBe('Diese Gruppe (Basistest99)');
  });

  it('renders incoming rights from the current group perspective', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'current_grants_right_to_partner',
        rightLabel: 'Informationsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe gibt Informationsrecht an Hierarchie99');
  });

  it('renders partner-held rights from the current group perspective', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'partner_grants_right_to_current',
        rightLabel: 'Antragsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe hat Antragsrecht in Hierarchie99');
  });

  it('renders mutual rights as mutual sharing', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'mutual',
        rightLabel: 'Informationsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe und Hierarchie99 haben gegenseitig Informationsrecht');
  });
});
