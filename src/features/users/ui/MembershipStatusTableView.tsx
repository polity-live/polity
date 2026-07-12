import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable } from '@/features/shared/ui/data-table';
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
}

export function MembershipStatusTableView({
  title,
  description,
  Icon,
  items,
  statusType,
  columns,
}: MembershipStatusTableViewProps) {
  if (items.length === 0 && statusType !== 'active') {
    return null;
  }

  const statusLabel = translateText(
    `pages.user.memberships.sections.status.${statusType}`,
    String(statusType)
  );

  return (
    <ManagementSection
      title={
        <span className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </span>
      }
      description={description}
    >
      <DataTable
        columns={columns}
        data={items}
        getRowId={(item: any) => item.id}
        enablePagination={false}
        emptyTitle={translateText('pages.user.memberships.sections.emptyTitle', {
          statusType: statusLabel,
        })}
      />
    </ManagementSection>
  );
}
