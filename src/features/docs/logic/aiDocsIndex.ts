import { docsPageTranslations as deDocsPageTranslations } from '@/i18n/locales/de/pages/docs';
import { docsPageTranslations as enDocsPageTranslations } from '@/i18n/locales/en/pages/docs';

import { docsTopicDefinitions, docsTopicMap, docsTopicOrder, isDocsTopicSlug } from './docsTopics';
import type {
  DocsCategory,
  DocsProcessStep,
  DocsSignalTone,
  DocsTopicSlug,
} from '../types/docs.types';

export const AI_DOCS_LANGUAGES = ['de', 'en'] as const;
export const DOCS_TOPIC_SLUGS = docsTopicOrder as [DocsTopicSlug, ...DocsTopicSlug[]];

export type AiDocsLanguage = (typeof AI_DOCS_LANGUAGES)[number];

type DocsTranslations = typeof enDocsPageTranslations;
type DocsTopicTranslations = DocsTranslations['topics'][DocsTopicSlug];

interface AiDocsSearchInput {
  language?: AiDocsLanguage | null;
  limit?: number | null;
  query?: string | null;
  topic?: DocsTopicSlug | string | null;
}

interface AiDocsRelatedTopic {
  slug: DocsTopicSlug;
  title: string;
  route: string;
}

interface AiDocsProcessStep {
  description: string;
  id: string;
  lane: string | null;
  laneLabel: string | null;
  title: string;
  tone: DocsSignalTone | null;
}

interface AiDocsProcess {
  description: string;
  kind: 'lanes' | 'timeline';
  lanes: Record<string, string>;
  steps: AiDocsProcessStep[];
  title: string;
}

export interface AiDocsTopicItem {
  actions: string[];
  audience: string;
  category: DocsCategory;
  concepts: string[];
  entry: string;
  navLabel: string;
  outcome: string;
  process: AiDocsProcess;
  relatedTopics: AiDocsRelatedTopic[];
  route: string;
  searchText: string;
  slug: DocsTopicSlug;
  states: string[];
  summary: string;
  title: string;
  watchFor: string[];
}

export interface AiDocsSearchResult {
  items: AiDocsTopicItem[];
  language: AiDocsLanguage;
  query: string | null;
  total: number;
  topic: DocsTopicSlug | null;
}

const docsTranslationsByLanguage: Record<AiDocsLanguage, DocsTranslations> = {
  de: deDocsPageTranslations as unknown as DocsTranslations,
  en: enDocsPageTranslations,
};

function clampDocsLimit(value: number | null | undefined, fallback = 6): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(12, Math.max(1, Math.floor(value ?? fallback)));
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function matchesQuery(item: AiDocsTopicItem, query: string): boolean {
  const terms = normalizeSearchText(query)
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(item.searchText);
  return terms.every(term => haystack.includes(term));
}

function getStepMetadata(stepId: string, processSteps: readonly DocsProcessStep[]) {
  return processSteps.find(step => step.id === stepId) ?? null;
}

function buildProcessSteps(
  topicTranslations: DocsTopicTranslations,
  processSteps: readonly DocsProcessStep[]
): AiDocsProcessStep[] {
  const translatedSteps = topicTranslations.diagram.steps as Record<
    string,
    { description: string; title: string }
  >;
  const laneLabels =
    'lanes' in topicTranslations.diagram
      ? ((topicTranslations.diagram.lanes ?? {}) as Record<string, string>)
      : {};

  return Object.entries(translatedSteps).map(([stepId, stepTranslations]) => {
    const metadata = getStepMetadata(stepId, processSteps);
    const lane = metadata?.lane ?? null;

    return {
      id: stepId,
      title: stepTranslations.title,
      description: stepTranslations.description,
      tone: metadata?.tone ?? null,
      lane,
      laneLabel: lane ? (laneLabels[lane] ?? lane) : null,
    };
  });
}

function buildSearchText(item: Omit<AiDocsTopicItem, 'searchText'>): string {
  return [
    item.slug,
    item.category,
    item.navLabel,
    item.title,
    item.summary,
    item.audience,
    item.entry,
    item.outcome,
    ...item.actions,
    ...item.concepts,
    ...item.watchFor,
    ...item.states,
    ...item.relatedTopics.flatMap(topic => [topic.slug, topic.title]),
    item.process.title,
    item.process.description,
    ...Object.values(item.process.lanes),
    ...item.process.steps.flatMap(step => [
      step.id,
      step.title,
      step.description,
      step.laneLabel ?? '',
      step.tone ?? '',
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildDocsTopicItem(slug: DocsTopicSlug, translations: DocsTranslations): AiDocsTopicItem {
  const topic = docsTopicMap[slug];
  const topicTranslations = translations.topics[slug];
  const relatedTopics = topic.related.map(relatedSlug => ({
    slug: relatedSlug,
    title: translations.topics[relatedSlug].navLabel,
    route: `/docs/${relatedSlug}`,
  }));
  const lanes =
    'lanes' in topicTranslations.diagram
      ? ((topicTranslations.diagram.lanes ?? {}) as Record<string, string>)
      : {};

  const itemWithoutSearchText: Omit<AiDocsTopicItem, 'searchText'> = {
    slug,
    category: topic.category,
    route: `/docs/${slug}`,
    navLabel: topicTranslations.navLabel,
    title: topicTranslations.title,
    summary: topicTranslations.summary,
    audience: topicTranslations.audience,
    entry: topicTranslations.entry,
    outcome: topicTranslations.outcome,
    actions: [...topicTranslations.actions],
    concepts: [...topicTranslations.concepts],
    watchFor: [...topicTranslations.watchFor],
    states: [...topicTranslations.states],
    relatedTopics,
    process: {
      kind: topic.process.kind,
      title: topicTranslations.diagram.title,
      description: topicTranslations.diagram.description,
      lanes,
      steps: buildProcessSteps(topicTranslations, topic.process.steps),
    },
  };

  return {
    ...itemWithoutSearchText,
    searchText: buildSearchText(itemWithoutSearchText),
  };
}

export function getPolityDocsTopics(language: AiDocsLanguage = 'de'): AiDocsTopicItem[] {
  const translations = docsTranslationsByLanguage[language];
  return docsTopicDefinitions.map(topic => buildDocsTopicItem(topic.slug, translations));
}

export function searchPolityDocs(input: AiDocsSearchInput = {}): AiDocsSearchResult {
  const language: AiDocsLanguage = input.language === 'en' ? 'en' : 'de';
  const query = input.query?.trim() || null;
  const topic = input.topic && isDocsTopicSlug(input.topic) ? input.topic : null;
  const limit = clampDocsLimit(input.limit);
  const allTopics = getPolityDocsTopics(language);

  if (topic) {
    const item = allTopics.find(currentTopic => currentTopic.slug === topic);
    return {
      language,
      query,
      topic,
      total: item ? 1 : 0,
      items: item ? [item] : [],
    };
  }

  const matches = query ? allTopics.filter(item => matchesQuery(item, query)) : allTopics;

  return {
    language,
    query,
    topic: null,
    total: matches.length,
    items: matches.slice(0, limit),
  };
}
