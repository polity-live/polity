import { afterEach, describe, expect, it } from 'vitest';

import { useLanguageStore } from '@/features/shared/global-state/language.store';
import { translate, translateWithLanguage } from '@/features/shared/hooks/use-translation';

describe('translate count plurals', () => {
  afterEach(() => {
    useLanguageStore.getState().setLanguage('en');
  });

  it.each([
    ['en', 0, 'Members'],
    ['en', 1, 'Member'],
    ['en', 2, 'Members'],
    ['de', 0, 'Mitglieder'],
    ['de', 1, 'Mitglied'],
    ['de', 2, 'Mitglieder'],
  ] as const)('resolves %s count %s to %s', (language, count, expected) => {
    useLanguageStore.getState().setLanguage(language);

    expect(translate('components.labels.members', { count })).toBe(expected);
  });

  it('interpolates the selected plural form', () => {
    useLanguageStore.getState().setLanguage('en');

    expect(translate('features.groups.list.groupsFound', { count: 1 })).toBe('1 group found');
    expect(translate('features.groups.list.groupsFound', { count: 2 })).toBe('2 groups found');
  });

  it.each([
    ['components.labels.subscribers', 'Subscriber', 'Subscribers', 'Abonnent', 'Abonnenten'],
    ['components.labels.events', 'Event', 'Events', 'Veranstaltung', 'Veranstaltungen'],
    ['components.labels.amendments', 'Amendment', 'Amendments', 'Antrag', 'Anträge'],
    ['components.labels.groups', 'Group', 'Groups', 'Gruppe', 'Gruppen'],
    ['components.labels.clones', 'Clone', 'Clones', 'Klon', 'Klone'],
    ['components.labels.branches', 'Branch', 'Branches', 'Textvariante', 'Textvarianten'],
    [
      'components.labels.supportingGroups',
      'Supporting Group',
      'Supporting Groups',
      'Unterstützende Gruppe',
      'Unterstützende Gruppen',
    ],
    [
      'components.labels.changeRequests',
      'Change Request',
      'Change Requests',
      'Änderungsantrag',
      'Änderungsanträge',
    ],
    ['components.labels.elections', 'Election', 'Elections', 'Wahl', 'Wahlen'],
    ['components.labels.comments', 'Comment', 'Comments', 'Kommentar', 'Kommentare'],
  ] as const)('provides detail counter forms for %s', (key, enOne, enOther, deOne, deOther) => {
    useLanguageStore.getState().setLanguage('en');
    expect(translate(key, { count: 1 })).toBe(enOne);
    expect(translate(key, { count: 2 })).toBe(enOther);

    useLanguageStore.getState().setLanguage('de');
    expect(translate(key, { count: 1 })).toBe(deOne);
    expect(translate(key, { count: 2 })).toBe(deOther);
  });

  it('uses the other form for negative and decimal counts', () => {
    useLanguageStore.getState().setLanguage('en');

    expect(translate('components.labels.members', { count: -1 })).toBe('Members');
    expect(translate('components.labels.members', { count: 1.5 })).toBe('Members');
  });

  it('falls back to the base key when no plural-specific translation exists', () => {
    useLanguageStore.getState().setLanguage('en');

    expect(translate('features.groups.memberships.composition.total', { count: 1 })).toBe(
      'Total: 1'
    );
  });

  it('keeps the existing key and fallback behavior without a numeric count', () => {
    useLanguageStore.getState().setLanguage('en');

    expect(translate('components.labels.members')).toBe('Members');
    expect(translate('missing.translation', 'Fallback')).toBe('Fallback');
  });

  it('keeps invalid, empty, and over-deep paths defensive', () => {
    expect(translateWithLanguage('en', '')).toBe('');
    expect(translateWithLanguage('en', 'components.labels.members.extra')).toBe(
      'components.labels.members.extra'
    );
    expect(translateWithLanguage('en', 'missing.deep.path')).toBe('missing.deep.path');
  });

  it('interpolates present values while retaining nullish placeholders', () => {
    expect(
      translateWithLanguage(
        'en',
        'missing.greeting',
        { name: 'Ada', missing: null, absent: undefined },
        'Hello {{name}} {{missing}} {{absent}}'
      )
    ).toBe('Hello Ada {{missing}} {{absent}}');
  });

  it('stringifies non-string translation leaves', () => {
    expect(translateWithLanguage('en', 'pages.home.publicLanding.hero.decisionFlow')).toBe(
      'Proposal,Amendment,Vote'
    );
  });
});
