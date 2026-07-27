import type { ComponentProps } from 'react';

import { PolityZeroListView } from '@/features/shared/virtualization';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { queries } from '@/zero/queries';

import { ChangeRequestCardsList } from './ChangeRequestCardsList';

type ChangeRequestCardsListProps = ComponentProps<typeof ChangeRequestCardsList>;

export function VirtualAgendaChangeRequestCardsList({
  agendaItemId,
  items,
  virtualize = false,
  ...props
}: ChangeRequestCardsListProps & { agendaItemId: string; virtualize?: boolean }) {
  if (!virtualize) {
    return <ChangeRequestCardsList {...props} agendaItemId={agendaItemId} items={items} />;
  }
  const context = { agendaItemId };
  return (
    <PolityZeroListView<any, { order_index: number; id: string }, typeof context>
      context={context}
      historyKey={`agenda-${agendaItemId}-change-requests`}
      estimateSize={360}
      getRowKey={row => row.id}
      toStartRow={row => ({ order_index: row.order_index, id: row.id })}
      getPageQuery={({ limit, start, dir, settled }) => ({
        query: queries.agendas.changeRequestPage({ agendaItemId, limit, start, dir }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      })}
      getSingleQuery={({ id, settled }) => ({
        query: queries.agendas.changeRequestById({ id }) as never,
        options: { ttl: settled ? ('5m' as const) : ('none' as const) },
      })}
      renderRow={row => {
        const item =
          items.find(candidate => candidate.id === row.id) ??
          items.find(candidate => candidate.change_request_id === row.change_request_id) ??
          row;
        return <ChangeRequestCardsList {...props} agendaItemId={agendaItemId} items={[item]} />;
      }}
      renderSkeleton={() => <Skeleton className="h-80 w-full rounded-xl" />}
      renderEmpty={() =>
        items.length > 0 ? (
          <ChangeRequestCardsList {...props} agendaItemId={agendaItemId} items={items} />
        ) : null
      }
      className="max-h-[52rem] overflow-auto"
    />
  );
}
