import { useQuery } from '@rocicorp/zero/react';
import { queries } from '@/zero/queries';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  SearchDocument,
  SearchDocumentCardPayload,
} from '@/features/search/types/search-document.types';
import { EditingModeBadge, VisibilityBadge } from '../status';
import type { PreviewTarget } from './preview-target';
import {
  AMENDMENT_EDITING_MODE_ORDER,
  TERMINAL_EDITING_MODES,
  type EditingMode,
} from '@/zero/amendments/editing-mode-policy';

const statLabels: Record<string, string> = {
  participants: 'participants',
  attendees: 'participants',
  collaborators: 'collaborators',
  subscribers: 'subscribers',
  supporting_groups: 'supportingGroups',
  comments: 'comments',
  elections: 'elections',
  amendments: 'amendments',
};

/** Reuse the access-filtered search projection, including its public counts. */
export function PreviewSearchDetails({ target }: { target: PreviewTarget }) {
  const { t } = useTranslation();
  const [result] = useQuery(
    queries.search.searchDocumentById({ id: `${target.kind}:${target.id}` })
  );
  const document = result as unknown as SearchDocument | undefined;
  if (!document) return null;
  const payload = document.card_payload as SearchDocumentCardPayload;
  const mode = [...AMENDMENT_EDITING_MODE_ORDER, ...TERMINAL_EDITING_MODES].find(
    mode => mode === payload.status
  ) as EditingMode | undefined;
  const tags = [
    ...new Set([...(payload.tags ?? []), ...(document.topics ?? []).map(topic => topic.topic)]),
  ];
  const stats = Object.entries(payload.stats ?? {}).filter(
    ([key, value]) => statLabels[key] && typeof value === 'number' && Number.isFinite(value)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <VisibilityBadge value={document.visibility}>
          {t(`common.visibility.${document.visibility}`)}
        </VisibilityBadge>
        {target.kind === 'amendment' && mode ? <EditingModeBadge mode={mode} showIcon /> : null}
      </div>
      {document.group?.name ? (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('components.labels.partOf')} </span>
          <span className="font-medium">{document.group.name}</span>
        </p>
      ) : null}
      {tags.length ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {tags.map(tag => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      ) : null}
      {stats.length ? (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {stats.map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground text-xs">
                {t(`components.labels.${statLabels[key]}`)}
              </dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {document.image_url ? (
        <img src={document.image_url} alt="" className="max-h-56 w-full rounded-lg object-cover" />
      ) : null}
    </div>
  );
}
