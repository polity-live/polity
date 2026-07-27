import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable, VirtualDataTable } from '@/features/shared/ui/data-table';
import { ManagementSection } from '@/features/shared/ui/form';
export interface MembershipStatusTableViewProps {
  title: any;
  description: any;
  Icon: any;
  items: any;
  statusType: any;
  entityKey: any;
  FallbackIcon: any;
  onAccept: any;
  onDecline: any;
  onLeave: any;
  onWithdraw: any;
  getEntityHref: any;
  getAcceptPreflightInput: any;
  getEntityData: any;
  getEntityName: any;
  getEntityImage: any;
  buildDefaultEntityHref: any;
  columns: any;
  virtualSource: any;
}

export function MembershipStatusTableView({
  title,
  description,
  Icon,
  items,
  statusType,
  columns,
  virtualSource,
}: MembershipStatusTableViewProps) {
  if (items.length === 0 && statusType !== 'active') {
    return null;
  }

  const statusLabel = translateText(
    `pages.user.memberships.sections.status.${statusType}`,
    String(statusType)
  );
  // Tutorial anchors remain harmless without an active run. Anchoring the
  // requested section itself is more robust than relying on a related group
  // field that may not have reached the Zero client yet.
  const containsTutorialRequest = statusType === 'requested' && items.length > 0;

  return (
    <div data-tutorial-anchor={containsTutorialRequest ? 'tutorial-membership-request' : undefined}>
      <ManagementSection
        title={
          <span className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </span>
        }
        description={description}
      >
        {virtualSource ? (
          <VirtualDataTable
            columns={columns}
            source={virtualSource}
            emptyTitle={translateText('pages.user.memberships.sections.emptyTitle', {
              statusType: statusLabel,
            })}
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            getRowId={(item: any) => item.id}
            enablePagination={false}
            emptyTitle={translateText('pages.user.memberships.sections.emptyTitle', {
              statusType: statusLabel,
            })}
          />
        )}
      </ManagementSection>
    </div>
  );
}
