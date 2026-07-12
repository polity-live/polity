/**
 * Pending Requests Table Component
 *
 * Displays pending membership requests for group admins to approve or reject.
 */

import { DataTable } from '@/features/shared/ui/data-table';
import { Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ManagementSection } from '@/features/shared/ui/form';
import { CountBadge } from '@/features/shared/ui/status';
export interface PendingRequestsTableViewProps {
  requests: any;
  onApprove: any;
  onReject: any;
  getApprovePreflightInput: any;
  title: any;
  description: any;
  roleColumnLabel: any;
  dateColumnLabel: any;
  fallbackRoleLabel: any;
  primaryActionLabel: any;
  secondaryActionLabel: any;
  columns: any;
}

export function PendingRequestsTableView({
  requests,
  title,
  description,
  columns,
}: PendingRequestsTableViewProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <ManagementSection
      className="civic-load-card-reveal mb-6 space-y-3"
      style={{ '--civic-load-index': 0 } as CSSProperties}
      title={
        <span className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
          <CountBadge count={requests.length} />
        </span>
      }
      description={description}
    >
      <DataTable
        columns={columns}
        data={requests}
        getRowId={(membership: any) => membership.id}
        enablePagination={false}
        tableClassName="[&_td:last-child]:text-right"
      />
    </ManagementSection>
  );
}
