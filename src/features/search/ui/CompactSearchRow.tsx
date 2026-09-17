import type { ReactNode } from 'react';
import { CollectionCard } from '@/features/shared/ui/collections/CollectionCard';
import type { SearchDocument } from '../types/search-document.types';
import { getSearchDocumentHref } from '../logic/searchResultHref';
import { PreviewButton } from '@/features/shared/ui/preview/WorkspacePreview';
import { useTranslation } from '@/features/shared/hooks/use-translation';

export { entityTypeDotClasses as searchTypeDotClasses } from '@/features/shared/ui/collections/EntityListRow';
import { EntityListRow } from '@/features/shared/ui/collections/EntityListRow';

export function CompactSearchRow({
  document,
  children,
}: {
  document: SearchDocument;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const href = getSearchDocumentHref(document);
  const summary =
    document.summary ||
    (document.entity_type === 'todo' && document.subtitle
      ? t(`features.todos.status.${document.subtitle}`)
      : document.subtitle);
  if (
    children &&
    [
      'amendment',
      'blog',
      'election',
      'event',
      'group',
      'image',
      'statement',
      'todo',
      'user',
      'video',
      'vote',
    ].includes(document.entity_type)
  ) {
    return (
      <CollectionCard
        compact
        model={{
          type: document.entity_type,
          title: document.title,
          summary,
          href,
          actionId: 'search.compact.open',
        }}
      >
        {children}
      </CollectionCard>
    );
  }
  return (
    <EntityListRow
      type={document.entity_type}
      title={document.title}
      summary={summary}
      href={href}
      actionId="search.compact.open"
      actions={<PreviewButton href={href} />}
    />
  );
}
