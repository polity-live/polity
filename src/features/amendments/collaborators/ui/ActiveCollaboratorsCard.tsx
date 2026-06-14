/**
 * Card displaying active collaborators with management options
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { getTableTagSurfaceClassName } from '@/features/shared/ui/ui/table-tag';
import { cn } from '@/features/shared/utils/utils';
import { SmartLink } from '@/features/shared/ui/navigation/SmartLink.tsx';
import { Users, Shield, Trash2 } from 'lucide-react';
import type { Collaborator, Role } from '../hooks/useCollaborators';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ActiveCollaboratorsCardProps {
  collaborators: Collaborator[];
  roles: Role[];
  onChangeRole: (collaboratorId: string, newRoleId: string) => Promise<void>;
  onPromoteToAdmin: (collaboratorId: string, roles: Role[]) => Promise<void>;
  onDemoteToMember: (collaboratorId: string, roles: Role[]) => Promise<void>;
  onRemoveCollaborator: (collaboratorId: string) => Promise<void>;
}

export function ActiveCollaboratorsCard({
  collaborators,
  roles,
  onChangeRole,
  onPromoteToAdmin,
  onDemoteToMember,
  onRemoveCollaborator,
}: ActiveCollaboratorsCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {translateText('generated.inline.0087_active_collaborators_7b4089f1')}
          {collaborators.length})
        </CardTitle>
        <CardDescription>
          {translateText(
            'generated.inline.0088_current_amendment_collaborators_and_administr_a73f4579'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {collaborators.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            {translateText('generated.inline.0089_no_active_collaborators_found_25e117c5')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translateText('generated.inline.0090_user_9f8a2389')}</TableHead>
                <TableHead>{translateText('generated.inline.0091_role_c3f104d1')}</TableHead>
                <TableHead>{translateText('generated.inline.0092_joined_43a1c626')}</TableHead>
                <TableHead className="text-right">
                  {translateText('generated.inline.0093_actions_c3cd636a')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.map(collaboration => {
                const user = collaboration.user;
                const userName = user
                  ? [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown User'
                  : 'Unknown User';
                const userAvatar = user?.avatar || '';
                const userHandle = user?.handle || '';
                const matchedRole = roles.find(r => r.id === collaboration.role_id);
                const roleName = matchedRole?.name || 'Collaborator';
                const roleId = collaboration.role_id ?? undefined;
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
                    <TableCell>
                      <Select
                        value={roleId}
                        onValueChange={newRoleId => onChangeRole(collaboration.id, newRoleId)}
                      >
                        <SelectTrigger
                          className={cn('w-40', getTableTagSurfaceClassName('amendment'))}
                        >
                          <SelectValue placeholder={roleName} />
                        </SelectTrigger>
                        <SelectContent>
                          {roles?.map(roleOption => (
                            <SelectItem key={roleOption.id} value={roleOption.id}>
                              {roleOption.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{createdAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {roleName !== 'Author' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPromoteToAdmin(collaboration.id, roles)}
                          >
                            <Shield className="mr-1 h-4 w-4" />
                            {translateText('generated.inline.0094_promote_to_author_88d1b3f9')}
                          </Button>
                        )}
                        {roleName === 'Author' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDemoteToMember(collaboration.id, roles)}
                          >
                            {translateText('generated.inline.0095_demote_to_collaborator_f2101f10')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveCollaborator(collaboration.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="ml-2">
                            {translateText('generated.inline.0096_remove_e963907d')}
                          </span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
