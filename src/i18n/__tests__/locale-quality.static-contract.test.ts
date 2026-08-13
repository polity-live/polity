import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import deTranslation from '@/i18n/locales/de/deTranslation';
import enTranslation from '@/i18n/locales/en/enTranslation';
import { agendasTranslations as deAgendas } from '@/i18n/locales/de/features/agendas';
import { groupsTranslations as deGroups } from '@/i18n/locales/de/features/groups';
import { agendasTranslations as enAgendas } from '@/i18n/locales/en/features/agendas';
import { groupsTranslations as enGroups } from '@/i18n/locales/en/features/groups';

const skippedReferenceDirectories = new Set([
  '__tests__',
  'fixtures',
  'generated',
  'locales',
  'node_modules',
]);

function flatten(value: unknown, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  if (!value || typeof value !== 'object') return result;

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result.set(path, child);
    else for (const entry of flatten(child, path)) result.set(...entry);
  }
  return result;
}

function expectSemanticModuleToWin(localeModule: unknown, semanticModule: unknown, prefix: string) {
  const localeLeaves = flatten(localeModule);
  for (const [path, value] of flatten(semanticModule)) {
    expect(localeLeaves.get(path), `${prefix}.${path}`).toBe(value);
  }
}

describe('runtime locale quality', () => {
  it('keeps complete German and English key parity', () => {
    expect([...flatten(deTranslation).keys()].sort()).toEqual(
      [...flatten(enTranslation).keys()].sort()
    );
  });

  it('defines every generated inline key referenced by application source', () => {
    const references = new Set<string>();
    const collectReferences = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'generated.ts' || entry.name === 'node_modules') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (skippedReferenceDirectories.has(entry.name)) continue;
          collectReferences(path);
        } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
          for (const match of readFileSync(path, 'utf8').matchAll(
            /generated\.inline\.([A-Za-z0-9_]+)/g
          )) {
            references.add(match[1]);
          }
        }
      }
    };
    collectReferences(join(process.cwd(), 'src'));

    const germanKeys = new Set(Object.keys(deTranslation.generated.inline));
    const englishKeys = new Set(Object.keys(enTranslation.generated.inline));
    expect([...references].filter(key => !germanKeys.has(key))).toEqual([]);
    expect([...references].filter(key => !englishKeys.has(key))).toEqual([]);
  }, 15_000);

  it('never lets generated overrides replace maintained semantic modules', () => {
    expectSemanticModuleToWin(deTranslation.features.agendas, deAgendas, 'de.features.agendas');
    expectSemanticModuleToWin(enTranslation.features.agendas, enAgendas, 'en.features.agendas');
    expectSemanticModuleToWin(deTranslation.features.groups, deGroups, 'de.features.groups');
    expectSemanticModuleToWin(enTranslation.features.groups, enGroups, 'en.features.groups');
  });

  it('uses the reviewed language and terminology in representative runtime copy', () => {
    expect(deTranslation.features.votes.title).toBe('Abstimmungen');
    expect(deTranslation.features.agendas.crTimeline.finalVote).not.toMatch(
      /\b(?:Amendment|Event|Voting|Vote)\b/i
    );
    expect(deTranslation.features.editor.toasts.modeChanged).toContain('Modus');

    expect(enTranslation.features.votes.title).toBe('Votes');
    expect(enTranslation.features.agendas.crTimeline.finalVote).toBe(
      'Accept Amendment as Modified'
    );
    expect(enTranslation.features.groups.toasts.selectPayer).toBe('Please select a payer');
  });
});
