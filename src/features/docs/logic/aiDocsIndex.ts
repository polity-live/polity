import { markdownToPlainText, searchDocs } from './docsSearch';
import {
  DOCS_LANGUAGES,
  DOCS_PAGE_SLUGS,
  getDocsPage,
  getDocsPages,
  getRelatedDocsPages,
} from './docsRegistry';
import type { DocsLanguage, DocsPage, DocsPageSlug } from '../types/docs.types';

export const AI_DOCS_LANGUAGES = DOCS_LANGUAGES;
export const AI_DOCS_PAGE_SLUGS = DOCS_PAGE_SLUGS;
export type AiDocsLanguage = DocsLanguage;

interface AiDocsReadInput {
  language?: AiDocsLanguage | null;
  limit?: number | null;
  page?: DocsPageSlug | string | null;
  query?: string | null;
  section?: string | null;
}

interface AiDocsSectionItem {
  id: string;
  markdown: string;
  plainText: string;
  route: string;
  title: string;
}

export interface AiDocsPageItem {
  audience: string;
  category: DocsPage['category'];
  description: string;
  keywords: string[];
  kind: DocsPage['kind'];
  relatedPages: { route: string; slug: DocsPageSlug; title: string }[];
  route: string;
  sections: AiDocsSectionItem[];
  slug: DocsPageSlug;
  title: string;
  toc: { id: string; route: string; title: string }[];
}

export interface AiDocsSectionMatch {
  excerpt: string;
  markdown: string;
  pageSlug: DocsPageSlug;
  pageTitle: string;
  route: string;
  score: number;
  sectionId: string | null;
  sectionTitle: string | null;
}

export interface AiDocsReadResult {
  language: AiDocsLanguage;
  matches: AiDocsSectionMatch[];
  page: DocsPageSlug | null;
  pages: AiDocsPageItem[];
  query: string | null;
  section: string | null;
  total: number;
}

function clampLimit(value: number | null | undefined, fallback = 8): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(value ?? fallback)));
}

function toAiPage(
  page: DocsPage,
  language: DocsLanguage,
  sectionId?: string | null
): AiDocsPageItem {
  const sections = sectionId
    ? page.sections.filter(section => section.id === sectionId)
    : page.sections;
  return {
    slug: page.slug,
    kind: page.kind,
    category: page.category,
    route: page.route,
    title: page.title,
    description: page.description,
    audience: page.audience,
    keywords: page.keywords,
    toc: page.sections.map(section => ({
      id: section.id,
      title: section.title,
      route: `${page.route}#${section.id}`,
    })),
    sections: sections.map(section => ({
      id: section.id,
      title: section.title,
      route: `${page.route}#${section.id}`,
      markdown: section.markdown,
      plainText: markdownToPlainText(section.markdown),
    })),
    relatedPages: getRelatedDocsPages(page, language).map(related => ({
      slug: related.slug,
      title: related.title,
      route: related.route,
    })),
  };
}

export function readPolityDocs(input: AiDocsReadInput = {}): AiDocsReadResult {
  const language: DocsLanguage = input.language === 'en' ? 'en' : 'de';
  const query = input.query?.trim() || null;
  const requestedPage = input.page?.trim() || null;
  const requestedSection = input.section?.trim() || null;
  const limit = clampLimit(input.limit);

  if (requestedPage) {
    const page = getDocsPage(requestedPage, language);
    const sectionExists =
      !requestedSection || page?.sections.some(section => section.id === requestedSection);
    return {
      language,
      query,
      page: page?.slug ?? null,
      section: requestedSection,
      total: page && sectionExists ? 1 : 0,
      pages: page && sectionExists ? [toAiPage(page, language, requestedSection)] : [],
      matches: [],
    };
  }

  if (query) {
    const matches = searchDocs({ language, query, limit });
    return {
      language,
      query,
      page: null,
      section: requestedSection,
      total: matches.length,
      pages: [],
      matches: matches.map(match => ({
        pageSlug: match.page.slug,
        pageTitle: match.page.title,
        sectionId: match.section?.id ?? null,
        sectionTitle: match.section?.title ?? null,
        route: match.route,
        score: match.score,
        excerpt: match.excerpt,
        markdown: match.section?.markdown ?? match.page.description,
      })),
    };
  }

  const pages = getDocsPages(language).slice(0, limit);
  return {
    language,
    query: null,
    page: null,
    section: requestedSection,
    total: getDocsPages(language).length,
    pages: pages.map(page => ({
      ...toAiPage(page, language),
      sections: [],
    })),
    matches: [],
  };
}

// Compatibility alias for internal callers while the tool migrates to page-level reads.
export const searchPolityDocs = readPolityDocs;
