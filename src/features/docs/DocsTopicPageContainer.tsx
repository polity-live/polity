import { useTranslation } from '@/features/shared/hooks/use-translation';

import { useDocsTopicPage } from './hooks/useDocsPage';
import { DocsTopicView } from './ui/DocsTopicView';
import type { DocsTopicSlug } from './types/docs.types';

export function DocsTopicPageContainer({ topic }: { topic: DocsTopicSlug }) {
  const { t } = useTranslation();
  const {
    topic: topicDefinition,
    baseKey,
    title,
    summary,
    audience,
    entry,
    actions,
    concepts,
    watchFor,
    states,
    relatedTopics,
  } = useDocsTopicPage(topic);

  return (
    <DocsTopicView
      topic={topicDefinition}
      baseKey={baseKey}
      title={title}
      summary={summary}
      audience={audience}
      entry={entry}
      actions={actions}
      concepts={concepts}
      watchFor={watchFor}
      states={states}
      relatedTopics={relatedTopics}
      copy={{
        navLabel: t('pages.docs.overview.navLabel'),
        quickView: t('pages.docs.labels.quickView'),
        audienceLabel: t('pages.docs.labels.audience'),
        entryLabel: t('pages.docs.labels.entry'),
        actionsLabel: t('pages.docs.labels.actions'),
        conceptsLabel: t('pages.docs.labels.concepts'),
        watchFor: t('pages.docs.labels.watchFor'),
        statesLabel: t('pages.docs.labels.states'),
        relatedTopics: t('pages.docs.labels.relatedTopics'),
        userPerspective: t('pages.docs.labels.userPerspective'),
        exploreMore: t('pages.docs.labels.exploreMore'),
        libraryDescription: t('pages.docs.overview.libraryDescription'),
        perspective: t(`${baseKey}.perspective`),
        outcome: t(`${baseKey}.outcome`),
        relatedTopicLabels: Object.fromEntries(
          relatedTopics.map(relatedTopic => [
            relatedTopic.slug,
            t(`pages.docs.topics.${relatedTopic.slug}.navLabel`),
          ])
        ),
      }}
    />
  );
}
