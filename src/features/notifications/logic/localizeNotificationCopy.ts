import type { Language } from '@/features/shared/global-state/language.store';
import { translateWithLanguage } from '@/features/shared/hooks/use-translation';
import deTranslation from '@/i18n/locales/de/deTranslation';
import enTranslation from '@/i18n/locales/en/enTranslation';

interface TemplateMatch {
  key: string;
  placeholders: string[];
  pattern: RegExp;
}

type TranslationTree = Record<string, unknown>;

function isNotificationKey(key: string): boolean {
  if (key.startsWith('features.notifications.')) return true;
  if (key === 'common.creationFinalization.entities.payment') return true;
  const generatedId = /^generated\.inline\.(\d{4})_/.exec(key)?.[1];
  if (!generatedId) return false;
  const id = Number(generatedId);
  return (id >= 127 && id <= 469) || (id >= 9001 && id <= 9002);
}

function flattenStrings(
  value: unknown,
  prefix = '',
  result = new Map<string, string>()
): Map<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [name, child] of Object.entries(value as TranslationTree)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof child === 'string' && isNotificationKey(key)) result.set(key, child);
    else flattenStrings(child, key, result);
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileTemplate(key: string, template: string): TemplateMatch {
  const placeholders: string[] = [];
  let pattern = '^';
  let offset = 0;
  for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
    pattern += escapeRegExp(template.slice(offset, match.index));
    pattern += '(.+?)';
    placeholders.push(match[1]);
    offset = match.index + match[0].length;
  }
  pattern += `${escapeRegExp(template.slice(offset))}$`;
  return { key, placeholders, pattern: new RegExp(pattern, 's') };
}

const templatesByLanguage: Record<Language, Map<string, string>> = {
  de: flattenStrings(deTranslation),
  en: flattenStrings(enTranslation),
};
const exactMatches = new Map<string, string>();
const templateMatches: TemplateMatch[] = [];

for (const templates of Object.values(templatesByLanguage)) {
  for (const [key, template] of templates) {
    if (template.includes('{{')) {
      templateMatches.push(compileTemplate(key, template));
    } else {
      exactMatches.set(template, key);
    }
  }
}

function matchTemplate(value: string): { key: string; params?: Record<string, string> } | null {
  if (isNotificationKey(value)) return { key: value };
  const exactKey = exactMatches.get(value);
  if (exactKey) return { key: exactKey };

  for (const candidate of templateMatches) {
    const match = candidate.pattern.exec(value);
    if (!match) continue;
    return {
      key: candidate.key,
      params: Object.fromEntries(
        candidate.placeholders.map((placeholder, index) => [placeholder, match[index + 1]])
      ),
    };
  }
  return null;
}

/**
 * Re-localizes known system notification copy without touching user-authored text.
 * This keeps old notification rows compatible while push delivery follows the
 * recipient's persisted language preference.
 */
export function localizeNotificationCopy(
  value: string | undefined,
  language: Language
): string | undefined {
  if (!value) return value;
  const matched = matchTemplate(value);
  if (!matched) return value;
  return translateWithLanguage(language, matched.key, matched.params);
}
