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
  'common.network.currentGroupHasRightIn':
    '{{currentGroupName}} hat {{rightLabel}} in {{selectedGroupName}}',
  'common.network.selectedGroupHasRightInCurrentGroup':
    '{{selectedGroupName}} hat {{rightLabel}} in {{currentGroupName}}',
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
        direction: 'current_has_right_in_partner',
        rightLabel: 'Informationsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe (Basistest99) hat Informationsrecht in Hierarchie99');
  });

  it('renders partner-held rights as right in the current group', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'partner_has_right_in_current',
        rightLabel: 'Antragsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Hierarchie99 hat Antragsrecht in diese Gruppe (Basistest99)');
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
    ).toBe('Diese Gruppe (Basistest99) und Hierarchie99 haben gegenseitig Informationsrecht');
  });
});
