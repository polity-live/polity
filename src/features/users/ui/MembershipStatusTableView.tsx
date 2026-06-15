import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable } from '@/features/shared/ui/data-table';
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

  return (
    <section className="space-y-3">
      <div className="space-y-1.5 px-3 sm:px-4">
        <h2 className="flex items-center gap-2 text-base leading-none font-semibold">
          <Icon className="h-5 w-5" />
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(item: any) => item.id}
        enablePagination={false}
        emptyTitle={`${translateText('generated.inline.0609_no_816c52fd')}${statusType}${translateText(
          'generated.inline.1196_items_found_b7242dc8'
        )}`}
      />
    </section>
  );
}
