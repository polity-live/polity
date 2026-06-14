import { NotFound } from '@/features/shared/ui/feedback';

import { isDocsTopicSlug } from './logic/docsTopics';
import { DocsTopicPageContainer } from './DocsTopicPageContainer';

export function DocsTopicPage({ topic }: { topic: string }) {
  if (!isDocsTopicSlug(topic)) {
    return <NotFound />;
  }

  return <DocsTopicPageContainer topic={topic} />;
}
