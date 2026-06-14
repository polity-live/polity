/**
 * Card displaying pending invitations
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
import { UserPlus, Trash2 } from 'lucide-react';
import type { Collaborator } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface PendingInvitationsCardProps {
  invitations: Collaborator[];
  onWithdrawInvitation: (collaboratorId: string) => Promise<void>;
}

export function PendingInvitationsCard({
  invitations,
  onWithdrawInvitation,
}: PendingInvitationsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {translateText('generated.inline.0115_pending_invitations_8f697e53')}
          {invitations.length})
        </CardTitle>
        <CardDescription>
          {translateText(
            'generated.inline.0116_users_who_have_been_invited_but_haven_t_accep_6522078d'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{translateText('generated.inline.0090_user_9f8a2389')}</TableHead>
              <TableHead>{translateText('generated.inline.0117_invited_53469df1')}</TableHead>
              <TableHead className="text-right">
                {translateText('generated.inline.0093_actions_c3cd636a')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map(collaboration => {
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onWithdrawInvitation(collaboration.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ml-2">
                        {translateText('generated.inline.0118_withdraw_invitation_0beb2d10')}
                      </span>
                    </Button>
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
