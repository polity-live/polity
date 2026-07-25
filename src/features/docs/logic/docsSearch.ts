import { getDocsPages } from './docsRegistry';
import type { DocsLanguage, DocsPage, DocsSearchMatch, DocsSection } from '../types/docs.types';

interface SearchDocsInput {
  language?: DocsLanguage;
  limit?: number;
  query: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}/:-]+/gu, ' ')
    .trim();
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = haystack.indexOf(needle, cursor)) !== -1) {
    count += 1;
    cursor += needle.length;
  }
  return count;
}

function scoreField(field: string, terms: string[], phrase: string, weight: number): number {
  const normalizedField = normalize(field);
  let score = normalizedField.includes(phrase) ? weight * 2 : 0;
  for (const term of terms) {
    score += Math.min(3, countOccurrences(normalizedField, term)) * weight;
  }
  return score;
}

function getCandidateText(page: DocsPage, section: DocsSection | null): string {
  return normalize(
    [
      page.slug,
      page.title,
      page.description,
      page.audience,
      ...page.keywords,
      section?.title ?? '',
      ...(section?.keywords ?? []),
      section ? markdownToPlainText(section.markdown) : '',
    ].join(' ')
  );
}

function scoreCandidate(
  page: DocsPage,
  section: DocsSection | null,
  terms: string[],
  phrase: string
): number {
  const text = getCandidateText(page, section);
  if (!terms.every(term => text.includes(term))) return 0;
  if (section) {
    const sectionText = normalize(
      [section.title, ...(section.keywords ?? []), markdownToPlainText(section.markdown)].join(' ')
    );
    if (!terms.some(term => sectionText.includes(term))) return 0;
  }

  return (
    scoreField(page.title, terms, phrase, 90) +
    scoreField(page.keywords.join(' '), terms, phrase, 65) +
    scoreField(page.description, terms, phrase, 35) +
    scoreField(section?.title ?? '', terms, phrase, 70) +
    scoreField((section?.keywords ?? []).join(' '), terms, phrase, 50) +
    scoreField(section ? markdownToPlainText(section.markdown) : page.audience, terms, phrase, 8) +
    (page.featured ? 2 : 0)
  );
}

function buildExcerpt(page: DocsPage, section: DocsSection | null, firstTerm: string): string {
  const source = section ? markdownToPlainText(section.markdown) : page.description;
  const normalizedSource = normalize(source);
  const index = normalizedSource.indexOf(firstTerm);
  if (index === -1 || source.length <= 190) return source;

  const start = Math.max(0, index - 65);
  const end = Math.min(source.length, start + 190);
  return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
}

export function searchDocs({
  language = 'de',
  limit = 20,
  query,
}: SearchDocsInput): DocsSearchMatch[] {
  const phrase = normalize(query);
  const terms = phrase.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const matches = getDocsPages(language).flatMap(page => {
    const candidates: (DocsSection | null)[] = [null, ...page.sections];
    return candidates
      .map(section => {
        const score = scoreCandidate(page, section, terms, phrase);
        if (score === 0) return null;
        return {
          page,
          section,
          score,
          excerpt: buildExcerpt(page, section, terms[0]),
          route: `${page.route}${section ? `#${section.id}` : ''}`,
        } satisfies DocsSearchMatch;
      })
      .filter((match): match is DocsSearchMatch => match !== null);
  });

  return matches
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.page.order - right.page.order ||
        (left.section?.title ?? '').localeCompare(right.section?.title ?? '')
    )
    .slice(0, Math.max(1, Math.min(50, Math.floor(limit))));
}
