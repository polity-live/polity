import { describe, expect, it } from 'vitest';

import { agendaItemTextMatchesSearch } from '../agendaItemTextSearch';

describe('agendaItemTextMatchesSearch', () => {
  it('searches localized English copy for tutorial elections', () => {
    expect(
      agendaItemTextMatchesSearch({
        title: 'Wahl zum Kreisvorsitzenden',
        description: 'Die Initiative wählt eine Person für den Kreisvorsitz.',
        isTutorialElection: true,
        language: 'en',
        loweredSearchQuery: 'district chair',
      })
    ).toBe(true);
  });

  it('keeps normal agenda item search text unchanged', () => {
    expect(
      agendaItemTextMatchesSearch({
        title: 'Wahl zum Kreisvorsitzenden',
        description: 'Eine reguläre Wahl.',
        isTutorialElection: false,
        language: 'en',
        loweredSearchQuery: 'district chair',
      })
    ).toBe(false);
    expect(
      agendaItemTextMatchesSearch({
        title: 'Wahl zum Kreisvorsitzenden',
        description: 'Eine reguläre Wahl.',
        isTutorialElection: false,
        language: 'en',
        loweredSearchQuery: 'kreisvorsitzenden',
      })
    ).toBe(true);
  });

  it('matches a normal item by description and accepts an empty query', () => {
    const item = {
      title: 'Ordinary title',
      description: 'Distinctive description',
      isTutorialElection: false,
      language: 'en',
    } as const;

    expect(agendaItemTextMatchesSearch({ ...item, loweredSearchQuery: 'distinctive' })).toBe(true);
    expect(agendaItemTextMatchesSearch({ ...item, loweredSearchQuery: '' })).toBe(true);
  });

  it('uses German fixture resolution for non-English languages', () => {
    expect(
      agendaItemTextMatchesSearch({
        title: 'Deutscher Titel',
        isTutorialElection: false,
        language: 'de',
        loweredSearchQuery: 'deutscher',
      })
    ).toBe(true);
  });
});
