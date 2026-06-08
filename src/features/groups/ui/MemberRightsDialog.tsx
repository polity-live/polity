import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Badge } from '@/features/shared/ui/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/shared/ui/ui/table';
import { TableTag } from '@/features/shared/ui/ui/table-tag';
import {
  buildMembershipRightsSummary,
  getMembershipDisplayRoles,
  getMembershipRoleSummary,
} from '@/features/groups/logic/buildMembershipRightsSummary';
import type { ActionRightOption } from '@/features/groups/types/group.types';
import type { SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import type { ParticipationLike } from '@/features/shared/types/participation';

interface MemberRightsDialogProps<TParticipation extends ParticipationLike> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  membership: TParticipation | null;
  onNavigateToUser: (userId: string) => void;
  entityType?: SearchCardGradientEntity;
  contextLabel?: string;
  fallbackRoleLabel?: string;
  profileButtonLabel?: string;
  closeButtonLabel?: string;
  emptyRightsLabel?: string;
  actionRightsCatalog?: readonly ActionRightOption[];
}

export function MemberRightsDialog<TParticipation extends ParticipationLike>({
  isOpen,
  onOpenChange,
  membership,
  onNavigateToUser,
  entityType = 'group',
  contextLabel,
  fallbackRoleLabel,
  profileButtonLabel,
  closeButtonLabel,
  emptyRightsLabel,
  actionRightsCatalog,
}: MemberRightsDialogProps<TParticipation>) {
  const { t } = useTranslation();
  const resolvedContextLabel =
    contextLabel ?? t('components.memberRightsDialog.context.group', 'group');
  const resolvedFallbackRoleLabel =
    fallbackRoleLabel ?? t('components.memberRightsDialog.memberFallback', 'Member');
  const resolvedProfileButtonLabel =
    profileButtonLabel ?? t('components.memberRightsDialog.openProfile', 'Open Profile');
  const resolvedCloseButtonLabel =
    closeButtonLabel ?? t('components.memberRightsDialog.close', 'Close');
  const resolvedEmptyRightsLabel =
    emptyRightsLabel ??
    t(
      'components.memberRightsDialog.emptyRights',
      "No explicit action rights are currently assigned through this member's roles."
    );
  const rightsSummary = useMemo(
    () => (membership ? buildMembershipRightsSummary(membership, actionRightsCatalog) : []),
    [actionRightsCatalog, membership]
  );
  const displayRoles = useMemo(
    () => (membership ? getMembershipDisplayRoles(membership) : []),
    [membership]
  );

  const memberName = membership
    ? [membership.user?.first_name, membership.user?.last_name].filter(Boolean).join(' ') ||
      t('components.memberRightsDialog.unknownUser', 'Unknown User')
    : t('components.memberRightsDialog.unknownUser', 'Unknown User');
  const roleSummary = membership ? getMembershipRoleSummary(membership) : resolvedFallbackRoleLabel;
  const profileUserId = membership?.user?.id ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{memberName}</DialogTitle>
          <DialogDescription>
            {t('components.memberRightsDialog.description', {
              contextLabel: resolvedContextLabel,
              defaultValue:
                'Effective {{contextLabel}} rights are unioned across all assigned roles. This view shows both the final right set and which role grants each right.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-border/70 from-background via-background to-muted/30 rounded-2xl border bg-gradient-to-br p-4">
            <div className="text-sm font-medium">
              {t('components.memberRightsDialog.assignedRoles', 'Assigned roles')}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayRoles.length > 0 ? (
                displayRoles.map(role => (
                  <TableTag key={role.id} entityType={entityType}>
                    {role.name || t('components.memberRightsDialog.roleFallback', 'Role')}
                  </TableTag>
                ))
              ) : (
                <TableTag entityType={entityType}>{resolvedFallbackRoleLabel}</TableTag>
              )}
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              {t('components.memberRightsDialog.effectiveRightsSummary', {
                count: rightsSummary.length,
                role: membership ? roleSummary : resolvedFallbackRoleLabel,
                defaultValue: '{{count}} effective rights from {{role}}.',
              })}
            </p>
          </div>

          <div className="border-border/70 overflow-x-auto rounded-2xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">
                    {t('components.memberRightsDialog.effectiveRight', 'Effective Right')}
                  </TableHead>
                  <TableHead>
                    {t('components.memberRightsDialog.grantedBy', 'Granted By')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rightsSummary.length > 0 ? (
                  rightsSummary.map(right => (
                    <TableRow key={right.key}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{right.label}</div>
                          <div className="text-muted-foreground text-xs">
                            {right.resource} / {right.action}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {right.sources.map(source => (
                            <div
                              key={`${right.key}-${source.roleId}`}
                              className="border-border/70 bg-muted/30 rounded-full border px-3 py-1 text-xs"
                            >
                              <span className="font-medium">{source.roleName}</span>
                              {!source.isDirect ? (
                                <span className="text-muted-foreground">
                                  {' '}
                                  {t('components.memberRightsDialog.via', {
                                    label: source.viaLabel,
                                    defaultValue: 'via {{label}}',
                                  })}
                                </span>
                              ) : null}
                              {source.isDirect ? (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                                >
                                  {t('components.memberRightsDialog.direct', 'direct')}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-sky-500/50 text-sky-700 dark:text-sky-300"
                                >
                                  {t('components.memberRightsDialog.implied', 'implied')}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground py-8 text-center">
                      {resolvedEmptyRightsLabel}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          {profileUserId ? (
            <Button variant="outline" onClick={() => onNavigateToUser(profileUserId)}>
              {resolvedProfileButtonLabel}
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{resolvedCloseButtonLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
