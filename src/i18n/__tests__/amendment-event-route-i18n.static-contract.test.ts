import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import deTranslation from '@/i18n/locales/de/deTranslation';
import enTranslation from '@/i18n/locales/en/enTranslation';

const scopeRoots = [
  'src/routes/_authed/amendment',
  'src/routes/_authed/event',
  'src/features/amendments',
  'src/features/agendas',
  'src/features/events',
] as const;

const checkedKeyPrefixes = [
  'common.',
  'features.amendments.',
  'features.agendas.',
  'features.events.',
  'generated.inline.',
] as const;

const dynamicKeys = [
  'features.amendments.cityDesign.categories.building',
  'features.amendments.cityDesign.categories.furniture',
  'features.amendments.cityDesign.categories.greenery',
  'features.amendments.cityDesign.categories.mobility',
  'features.amendments.cityDesign.categories.street',
  'features.amendments.cityDesign.categories.water',
  'features.amendments.cityDesign.comparison.newDesign',
  'features.amendments.cityDesign.comparison.original',
  'features.amendments.cityDesign.comparison.overlay',
  'features.amendments.cityDesign.comparison.split',
  'features.amendments.cityDesign.modes.camera',
  'features.amendments.cityDesign.modes.place',
  'features.amendments.cityDesign.modes.select',
  'features.amendments.cityDesign.osmLayers.building',
  'features.amendments.cityDesign.osmLayers.green',
  'features.amendments.cityDesign.osmLayers.road',
  'features.amendments.cityDesign.osmLayers.streetMarkings',
  'features.amendments.cityDesign.osmLayers.water',
] as const;

const bannedVisibleSnippets = [
  'Rejected in favor of',
  'Readonly: Diese finale Textvariante',
  'Untitled Amendment',
  'Untitled Event',
  'Choice ${',
  'Manage offline tally',
  'Namentliche Ergebnisse',
  'Unscheduled',
  'Not yet elected',
  'Textvariante öffnen',
  'No participants match your filters.',
  'No active collaborators yet.',
  'No collaborators match your filters.',
  'Location not set',
  'Unnamed group',
] as const;

type LocaleTree = Record<string, unknown>;

function listSourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(root, entry.name);

    if (entry.name === '__tests__' || /\.(test|spec)\.[tj]sx?$/.test(entry.name)) {
      return [];
    }

    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.[tj]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function getLocaleValue(locale: LocaleTree, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (
      current &&
      typeof current === 'object' &&
      Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return (current as LocaleTree)[segment];
    }

    return undefined;
  }, locale);
}

function hasKey(locale: LocaleTree, key: string): boolean {
  return getLocaleValue(locale, key) !== undefined;
}

function extractTranslationKeys(source: string): string[] {
  const keyPattern =
    /['"]((?:common|features\.(?:amendments|agendas|events)|generated\.inline)\.[^'"]+)['"]/g;

  return [...source.matchAll(keyPattern)]
    .map(match => match[1])
    .filter((key): key is string => Boolean(key))
    .filter(key => checkedKeyPrefixes.some(prefix => key.startsWith(prefix)));
}

describe('amendment and event route i18n coverage', () => {
  const sourceFiles = scopeRoots.flatMap(root => listSourceFiles(path.resolve(root)));

  it('does not reference missing English or German locale keys', () => {
    const missing = new Set<string>();

    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');

      for (const key of [...extractTranslationKeys(source), ...dynamicKeys]) {
        const missingLocales = [
          hasKey(enTranslation as LocaleTree, key) ? null : 'en',
          hasKey(deTranslation as LocaleTree, key) ? null : 'de',
        ].filter(Boolean);

        if (missingLocales.length > 0) {
          missing.add(
            `${path.relative(process.cwd(), file)} -> ${key} (${missingLocales.join(', ')})`
          );
        }
      }
    }

    expect([...missing].sort()).toEqual([]);
  });

  it('keeps known visible UI strings out of the checked route scope', () => {
    const offenders = sourceFiles.flatMap(file => {
      const source = fs.readFileSync(file, 'utf8');

      return bannedVisibleSnippets
        .filter(snippet => source.includes(snippet))
        .map(snippet => `${path.relative(process.cwd(), file)} -> ${snippet}`);
    });

    expect(offenders.sort()).toEqual([]);
  });
});
