/**
 * Pending Requests Table Component
 *
 * Displays pending membership requests for group admins to approve or reject.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { DataTable } from '@/features/shared/ui/data-table';
import { Users } from 'lucide-react';
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
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title} ({requests.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={requests}
          getRowId={(membership: any) => membership.id}
          enablePagination={false}
          tableClassName="[&_td:last-child]:text-right"
        />
      </CardContent>
    </Card>
  );
}
