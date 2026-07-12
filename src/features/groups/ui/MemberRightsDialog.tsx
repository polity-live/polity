import { featureThemeClassName } from '@/features/shared/theme';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { DataTable, type ColumnDef } from '@/features/shared/ui/data-table';
import { CountBadge, RoleBadge, StatusBadge } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import {
  buildMembershipRightsSummary,
  getMembershipDisplayRoles,
  getMembershipRoleSummary,
  type MembershipRightSummary,
} from '@/features/groups/logic/buildMembershipRightsSummary';
import type { ActionRightOption } from '@/features/groups/types/group.types';
import type { SearchCardGradientEntity } from '@/features/shared/utils/search-card-gradients';
import type { ParticipationLike } from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { RoleTag } from './RoleTag';

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
    contextLabel ??
    t(
      'components.memberRightsDialog.context.group',
      translateText('generated.inline.0096_group_64292b1c')
    );
  const resolvedFallbackRoleLabel =
    fallbackRoleLabel ?? t('components.memberRightsDialog.memberFallback');
  const resolvedProfileButtonLabel =
    profileButtonLabel ?? t('components.memberRightsDialog.openProfile');
  const resolvedCloseButtonLabel = closeButtonLabel ?? t('components.memberRightsDialog.close');
  const resolvedEmptyRightsLabel =
    emptyRightsLabel ?? t('components.memberRightsDialog.emptyRights');
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
      t('components.memberRightsDialog.unknownUser')
    : t('components.memberRightsDialog.unknownUser');
  const roleSummary = membership ? getMembershipRoleSummary(membership) : resolvedFallbackRoleLabel;
  const profileUserId = membership?.user?.id ?? null;
  const countTone = entityType === 'event' ? 'info' : 'neutral';
  const rightsColumns: ColumnDef<MembershipRightSummary>[] = [
    {
      id: 'right',
      header: t('components.memberRightsDialog.effectiveRight'),
      meta: {
        className: 'min-w-[220px]',
      },
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.label}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.resource} / {row.original.action}
          </div>
        </div>
      ),
    },
    {
      id: 'grantedBy',
      header: t('components.memberRightsDialog.grantedBy'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          {row.original.sources.map(source => (
            <div
              key={`${row.original.key}-${source.roleId}`}
              className="border-border/70 bg-muted/30 rounded-md border px-3 py-2 text-xs"
            >
              <RoleBadge>{source.roleName}</RoleBadge>
              {!source.isDirect ? (
                <span className="text-muted-foreground ml-2">
                  {t('components.memberRightsDialog.via', {
                    label: source.viaLabel,
                    defaultValue: 'via {{label}}',
                  })}
                </span>
              ) : null}
              <StatusBadge
                status={source.isDirect ? 'direct' : 'implied'}
                tone={source.isDirect ? 'success' : 'info'}
                className="ml-2"
              >
                {source.isDirect
                  ? t('components.memberRightsDialog.direct', 'direct')
                  : t('components.memberRightsDialog.implied', 'implied')}
              </StatusBadge>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ScrollableDialogContent management className="sm:max-w-[920px]">
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
          <div className={featureThemeClassName('groupMemberRightsDialogThemedGradientSurface')}>
            <div className="text-sm font-medium">
              {t('components.memberRightsDialog.assignedRoles')}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayRoles.length > 0 ? (
                displayRoles.map(role => (
                  <RoleTag
                    key={role.id}
                    roleId={role.id}
                    roleName={role.name || t('components.memberRightsDialog.roleFallback')}
                  />
                ))
              ) : (
                <RoleTag fallbackKey={`member-rights-${membership?.id ?? 'unknown'}`}>
                  {resolvedFallbackRoleLabel}
                </RoleTag>
              )}
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-sm">
              <CountBadge count={rightsSummary.length} tone={countTone} className="mr-2" />
              <span>
                {t('components.memberRightsDialog.effectiveRightsSummary', {
                  count: rightsSummary.length,
                  role: membership ? roleSummary : resolvedFallbackRoleLabel,
                  defaultValue: '{{count}} effective rights from {{role}}.',
                })}
              </span>
            </div>
          </div>

          <DataTable
            columns={rightsColumns}
            data={rightsSummary}
            getRowId={right => right.key}
            enablePagination={false}
            emptyTitle={resolvedEmptyRightsLabel}
          />
        </div>

        <DialogFooter>
          {profileUserId ? (
            <Button variant="outline" onClick={() => onNavigateToUser(profileUserId)}>
              {resolvedProfileButtonLabel}
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{resolvedCloseButtonLabel}</Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
