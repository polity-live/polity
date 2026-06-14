/**
 * Card displaying pending collaboration requests
 */

import { Button } from '@/features/shared/ui/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { Users, Check, Trash2 } from 'lucide-react';
import type { Collaborator } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PendingRequestsCardProps {
  requests: Collaborator[];
  onApproveRequest: (collaboratorId: string) => Promise<void>;
  onRejectRequest: (collaboratorId: string) => Promise<void>;
}

export function PendingRequestsCard({
  requests,
  onApproveRequest,
  onRejectRequest,
}: PendingRequestsCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {translateText('generated.inline.0119_pending_collaboration_requests_0e65bf5a')}
          {requests.length})
        </CardTitle>
        <CardDescription>
          {translateText(
            'generated.inline.0103_review_and_approve_collaboration_requests_0cd489d8'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{translateText('generated.inline.0090_user_9f8a2389')}</TableHead>
              <TableHead>{translateText('generated.inline.0120_requested_c26bf60f')}</TableHead>
              <TableHead className="text-right">
                {translateText('generated.inline.0093_actions_c3cd636a')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map(collaboration => {
              const user = collaboration.user;
              const userName = user
                ? [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User'
                : 'Unknown User';
              const userAvatar = user?.avatar || '';
              const userHandle = user?.handle || '';
              const createdAt = collaboration.created_at
                ? new Date(collaboration.created_at).toLocaleDateString()
                : 'N/A';
              const userHref = user?.id ? `/user/${user.id}` : null;
              const userCellContent = (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback>
                      {userName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{userName}</div>
                    {userHandle && (
                      <div className="text-muted-foreground text-sm">@{userHandle}</div>
                    )}
                  </div>
                </>
              );

              return (
                <TableRow key={collaboration.id}>
                  <TableCell>
                    {userHref ? (
                      <SmartLink
                        href={userHref}
                        className="flex items-center gap-3 hover:underline"
                      >
                        {userCellContent}
                      </SmartLink>
                    ) : (
                      <div className="flex items-center gap-3">{userCellContent}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onApproveRequest(collaboration.id)}
                      >
                        <Check className="mr-1 h-4 w-4" />
                        {translateText('generated.inline.0121_accept_bb54db51')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRejectRequest(collaboration.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2">
                          {translateText('generated.inline.0122_decline_b59cf9ed')}
                        </span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
