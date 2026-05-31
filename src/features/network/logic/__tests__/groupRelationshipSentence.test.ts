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
  'common.network.currentGroupGrantsRightTo':
    '{{currentGroupName}} vergibt {{rightLabel}} an {{selectedGroupName}}',
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
        direction: 'incoming',
        rightLabel: 'Informationsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe (Basistest99) hat Informationsrecht in Hierarchie99');
  });

  it('renders outgoing rights as granted to the other group', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'outgoing',
        rightLabel: 'Antragsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe (Basistest99) vergibt Antragsrecht an Hierarchie99');
  });

  it('renders bidirectional rights as mutual sharing', () => {
    expect(
      getGroupRelationshipRightSentenceText({
        direction: 'bidirectional',
        rightLabel: 'Informationsrecht',
        currentGroupName: 'Basistest99',
        selectedGroupName: 'Hierarchie99',
        t,
      })
    ).toBe('Diese Gruppe (Basistest99) und Hierarchie99 haben gegenseitig Informationsrecht');
  });
});
