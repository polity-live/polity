import { describe, expect, it } from 'vitest';

import {
  getGroupRelationshipNameText,
  getGroupRelationshipRightSentenceText,
  getSiblingMembershipModeLabel,
  getSiblingRelationshipPhraseText,
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
  'common.network.siblingMembershipModeOpen': 'offen',
  'common.network.siblingMembershipModeElected': 'gewählt',
  'common.network.siblingMembershipModeParliament': 'Parlament',
  'common.network.currentGroupAsSiblingOfWithType':
    '{{currentGroupName}} ist {{selectedGroupName}} als {{siblingType}} verbunden',
  'common.network.currentGroupAsSiblingOf':
    '{{currentGroupName}} ist {{selectedGroupName}} geschwisterlich verbunden',
  'common.network.isSiblingGroupOfWithType': 'ist als {{siblingType}} verbunden',
  'common.network.isSiblingGroupOf': 'ist geschwisterlich verbunden',
  'common.network.siblingGroupOfWithType': 'als {{siblingType}} verbunden',
  'common.network.siblingGroupOf': 'geschwisterlich verbunden',
  'common.network.asSiblingGroupOfWithType': 'als {{siblingType}} verknüpfen',
  'common.network.asSiblingGroupOf': 'geschwisterlich verknüpfen',
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
  it('labels every supported sibling membership mode and rejects missing modes', () => {
    expect(getSiblingMembershipModeLabel('open', t)).toBe('offen');
    expect(getSiblingMembershipModeLabel('elected', t)).toBe('gewählt');
    expect(getSiblingMembershipModeLabel('parliament', t)).toBe('Parlament');
    expect(getSiblingMembershipModeLabel(null, t)).toBeNull();
  });

  it('renders sibling phrases for sentence, statement, role, and selection contexts', () => {
    expect(
      getSiblingRelationshipPhraseText({
        mode: 'sentence',
        siblingMembershipMode: 'open',
        currentGroupName: 'A',
        selectedGroupName: 'B',
        t,
      })
    ).toBe('A ist B als offen verbunden');
    expect(
      getSiblingRelationshipPhraseText({
        mode: 'sentence',
        currentGroupName: 'A',
        selectedGroupName: 'B',
        t,
      })
    ).toBe('A ist B geschwisterlich verbunden');
    expect(getSiblingRelationshipPhraseText({ mode: 'sentence', selectedGroupName: 'B', t })).toBe(
      ''
    );
    expect(getSiblingRelationshipPhraseText({ mode: 'sentence', currentGroupName: 'A', t })).toBe(
      ''
    );
    expect(
      getSiblingRelationshipPhraseText({ mode: 'statement', siblingMembershipMode: 'elected', t })
    ).toBe('ist als gewählt verbunden');
    expect(getSiblingRelationshipPhraseText({ mode: 'statement', t })).toBe(
      'ist geschwisterlich verbunden'
    );
    expect(
      getSiblingRelationshipPhraseText({ mode: 'role', siblingMembershipMode: 'parliament', t })
    ).toBe('als Parlament verbunden');
    expect(getSiblingRelationshipPhraseText({ mode: 'role', t })).toBe('geschwisterlich verbunden');
    expect(
      getSiblingRelationshipPhraseText({ mode: 'selection', siblingMembershipMode: 'open', t })
    ).toBe('als offen verknüpfen');
    expect(getSiblingRelationshipPhraseText({ mode: 'selection', t })).toBe(
      'geschwisterlich verknüpfen'
    );
  });

  it('falls back for blank names and respects embedded wording', () => {
    expect(getGroupRelationshipNameText({ name: ' ', kind: 'selected', t })).toBe('Unbekannt');
    expect(getGroupRelationshipNameText({ name: '', kind: 'current', t })).toBe('Diese Gruppe');
    expect(
      getGroupRelationshipNameText({ name: '', kind: 'current', caseStyle: 'embedded', t })
    ).toBe('diese Gruppe');
    expect(
      getGroupRelationshipNameText({
        name: 'Basis',
        kind: 'current',
        caseStyle: 'embedded',
        t,
      })
    ).toBe('diese Gruppe (Basis)');
    expect(getGroupRelationshipNameText({ name: 'Partner', kind: 'selected', t })).toBe('Partner');
  });

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
