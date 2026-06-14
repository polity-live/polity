import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { DataTable } from '@/features/shared/ui/data-table';
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from '@/features/shared/ui/layout';
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
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </PanelTitle>
        <PanelDescription>{description}</PanelDescription>
      </PanelHeader>
      <PanelContent>
        <DataTable
          columns={columns}
          data={items}
          getRowId={(item: any) => item.id}
          enablePagination={false}
          emptyTitle={`${translateText('generated.inline.0609_no_816c52fd')}${statusType}${translateText(
            'generated.inline.1196_items_found_b7242dc8'
          )}`}
        />
      </PanelContent>
    </Panel>
  );
}
