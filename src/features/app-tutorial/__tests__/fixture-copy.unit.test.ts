import { describe, expect, it } from 'vitest';

import {
  APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE,
  localizeAppTutorialExpectedInput,
  localizeAppTutorialText,
} from '../catalog';
import {
  APP_TUTORIAL_FIXTURE_COPY,
  addAppTutorialFixtureTextAliasesToSearchText,
  collectAppTutorialFixtureTextAliases,
  getAppTutorialFixtureTextVariants,
  resolveAppTutorialFixtureText,
  resolveAppTutorialFixtureValue,
} from '../fixture-copy';
import {
  APP_TUTORIAL_AMENDMENT_AGENDA_TITLE,
  APP_TUTORIAL_AMENDMENT_TITLE,
  APP_TUTORIAL_ELECTION_COPY,
  APP_TUTORIAL_FIRST_EVENT_TITLE,
  APP_TUTORIAL_PREPARED_TEXT_CHANGES,
} from '../amendment-fixture';

describe('app tutorial localized fixture projection', () => {
  it('projects fixture values only when a tutorial run id is present', () => {
    expect(
      resolveAppTutorialFixtureText('Münchner Klimarat', {
        tutorialRunId: 'tutorial-run',
        language: 'en',
      })
    ).toBe('Munich Climate Council');
    expect(
      resolveAppTutorialFixtureText('Münchner Klimarat', {
        tutorialRunId: null,
        language: 'en',
      })
    ).toBe('Münchner Klimarat');
  });

  it('keeps unknown user data unchanged even inside a tutorial view', () => {
    expect(
      resolveAppTutorialFixtureText('Münchner Klimarat (custom)', {
        tutorialRunId: 'tutorial-run',
        language: 'en',
      })
    ).toBe('Münchner Klimarat (custom)');
  });

  it('localizes expected inputs and interpolated coach copy without changing fixtures', () => {
    expect(
      localizeAppTutorialExpectedInput(
        APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de.amendmentAddition,
        'en'
      )
    ).toBe(APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.en.amendmentAddition);
    expect(
      localizeAppTutorialText(
        `Füge hinzu: ${APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.de.changeRequestText}`,
        'en'
      )
    ).toContain(APP_TUTORIAL_EXPECTED_INPUTS_BY_LANGUAGE.en.changeRequestText);
  });

  it('registers every declared fixture value with complete German and English copy', () => {
    expect(Object.keys(APP_TUTORIAL_FIXTURE_COPY).length).toBeGreaterThan(40);

    for (const [persistedValue, fixtureCopy] of Object.entries(APP_TUTORIAL_FIXTURE_COPY)) {
      expect(persistedValue.trim()).not.toBe('');
      expect(fixtureCopy.de.trim()).not.toBe('');
      expect(fixtureCopy.en.trim()).not.toBe('');
    }

    const requiredFixtureValues = [
      APP_TUTORIAL_AMENDMENT_TITLE,
      APP_TUTORIAL_FIRST_EVENT_TITLE,
      APP_TUTORIAL_AMENDMENT_AGENDA_TITLE,
      ...Object.values(APP_TUTORIAL_ELECTION_COPY.de),
      ...APP_TUTORIAL_PREPARED_TEXT_CHANGES.flatMap(change => [
        change.title,
        change.description,
        change.newText,
      ]),
      'Initiative Klimafitte Euckenstraße',
      'Münchner Klimarat',
      'Die Welt zu einem besseren Ort machen',
      'Die Aufgabe wurde erstellt.',
    ];

    for (const value of requiredFixtureValues) {
      expect(
        getAppTutorialFixtureTextVariants(value, {
          tutorialRunId: 'tutorial-run',
        })
      ).toHaveLength(2);
    }
  });

  it('projects nested display data without changing unguarded values', () => {
    const fixture = {
      name: 'Münchner Klimarat',
      description: [{ type: 'p', children: [{ text: 'Rathaus München' }] }],
    };

    expect(
      resolveAppTutorialFixtureValue(fixture, {
        tutorialRunId: 'tutorial-run',
        language: 'en',
      })
    ).toEqual({
      name: 'Munich Climate Council',
      description: [{ type: 'p', children: [{ text: 'Munich City Hall' }] }],
    });
    expect(
      resolveAppTutorialFixtureValue(fixture, {
        tutorialRunId: null,
        language: 'en',
      })
    ).toBe(fixture);
  });

  it('derives both locale aliases for tutorial search documents idempotently', () => {
    const searchText = 'group Münchner Klimarat Transparente, vernetzte Klimapolitik für München.';
    const aliases = collectAppTutorialFixtureTextAliases(searchText);
    const indexedSearchText = addAppTutorialFixtureTextAliasesToSearchText(searchText);

    expect(aliases).toContain('Münchner Klimarat');
    expect(aliases).toContain('Munich Climate Council');
    expect(aliases).toContain('Transparent, connected climate policy for Munich.');
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(indexedSearchText).toContain('Munich Climate Council');
    expect(addAppTutorialFixtureTextAliasesToSearchText(indexedSearchText)).toBe(indexedSearchText);
  });

  it('accepts already projected English values when the language changes', () => {
    expect(
      resolveAppTutorialFixtureText('Munich Climate Council', {
        tutorialRunId: 'tutorial-run',
        language: 'de',
      })
    ).toBe('Münchner Klimarat');
  });

  it('handles unknown variants, nullish values, null prototypes, and class instances', () => {
    expect(getAppTutorialFixtureTextVariants('München', { tutorialRunId: null })).toEqual([]);
    expect(getAppTutorialFixtureTextVariants('', { tutorialRunId: 'tutorial-run' })).toEqual([]);
    expect(getAppTutorialFixtureTextVariants('unknown', { tutorialRunId: 'tutorial-run' })).toEqual(
      []
    );
    expect(
      resolveAppTutorialFixtureValue(null, { tutorialRunId: 'tutorial-run', language: 'en' })
    ).toBeNull();
    expect(
      resolveAppTutorialFixtureValue(undefined, {
        tutorialRunId: 'tutorial-run',
        language: 'en',
      })
    ).toBeUndefined();
    const nullPrototype = Object.assign(Object.create(null), { city: 'München' });
    expect(
      resolveAppTutorialFixtureValue(nullPrototype, {
        tutorialRunId: 'tutorial-run',
        language: 'en',
      })
    ).toEqual({ city: 'Munich' });
    const date = new Date('2026-08-09T00:00:00Z');
    expect(
      resolveAppTutorialFixtureValue(date, { tutorialRunId: 'tutorial-run', language: 'en' })
    ).toBe(date);
    expect(
      resolveAppTutorialFixtureValue(42, { tutorialRunId: 'tutorial-run', language: 'en' })
    ).toBe(42);
  });
});
