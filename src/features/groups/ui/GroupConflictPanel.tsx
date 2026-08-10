'use client';

import { featureThemeClassName } from '@/features/shared/theme';
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import {
  ManagementDialogBody,
  ManagementDialogContent,
  ManagementDialogHeader,
} from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  GroupConflict,
  GroupConflictKind,
  GroupConflictResolutionCode,
  GroupConflictResponse,
} from '@/features/groups/logic/groupConflict';
import { AlertTriangle, Info, Route } from 'lucide-react';
import { UserSearchCard } from '@/features/search/ui/UserSearchCard';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';

interface GroupConflictPanelProps {
  response: GroupConflictResponse;
}

const conflictKindTranslationKeyMap: Record<GroupConflictKind, string> = {
  hierarchy_member_overlap: 'hierarchyMemberOverlap',
  hierarchy_duplicate_path: 'hierarchyDuplicatePath',
  sibling_source_overlap: 'siblingSourceOverlap',
  sibling_connected_membership_missing: 'siblingConnectedMembershipMissing',
  permission_blocked_resolution: 'permissionBlockedResolution',
};

const resolutionTranslationKeyMap: Record<GroupConflictResolutionCode, string> = {
  align_membership_before_activation: 'alignMembershipBeforeActivation',
  leave_other_subgroup: 'leaveOtherSubgroup',
  choose_other_group: 'chooseOtherGroup',
  contact_admin: 'contactAdmin',
  leave_other_source_group: 'leaveOtherSourceGroup',
  contact_source_admins: 'contactSourceAdmins',
  clarify_source_memberships: 'clarifySourceMemberships',
  align_memberships: 'alignMemberships',
  contact_other_group: 'contactOtherGroup',
  remove_duplicate_path: 'removeDuplicatePath',
  contact_responsible_group: 'contactResponsibleGroup',
  clean_source_groups: 'cleanSourceGroups',
};

function getLocalizedConflictSummary(
  conflict: GroupConflict,
  t: (key: string, fallback?: string) => string
) {
  const keySuffix = conflictKindTranslationKeyMap[conflict.kind];
  return t(`features.groups.conflicts.kinds.${keySuffix}.summary`);
}

function getLocalizedConflictExplanation(
  conflict: GroupConflict,
  t: (key: string, fallback?: string) => string
) {
  const keySuffix = conflictKindTranslationKeyMap[conflict.kind];
  return t(`features.groups.conflicts.kinds.${keySuffix}.explanation`);
}

function getLocalizedResolution(
  conflict: GroupConflict,
  resolutionIndex: number,
  t: (key: string, fallback?: string) => string
) {
  const resolution = conflict.resolutions[resolutionIndex];
  if (!resolution) {
    return { label: '', description: '' };
  }

  const legacyCode =
    conflict.kind === 'hierarchy_member_overlap'
      ? resolutionIndex === 0
        ? 'align_memberships'
        : resolutionIndex === 1
          ? 'contact_other_group'
          : null
      : conflict.kind === 'hierarchy_duplicate_path'
        ? resolutionIndex === 0
          ? 'remove_duplicate_path'
          : resolutionIndex === 1
            ? 'contact_responsible_group'
            : null
        : null;
  const code = resolution.code ?? legacyCode;
  const keySuffix = code ? resolutionTranslationKeyMap[code] : null;
  const keyBase = keySuffix
    ? `features.groups.conflicts.resolutions.${keySuffix}`
    : 'features.groups.conflicts.resolutions.generic';
  return {
    label: t(`${keyBase}.label`),
    description: t(`${keyBase}.description`),
  };
}

export const groupConflictPanelInternals = {
  getLocalizedResolution,
};

export function GroupConflictPanel({ response }: GroupConflictPanelProps) {
  const { t } = useTranslation();

  if (response.conflicts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {response.conflicts.map((conflict, index) => {
        return (
          <div
            key={`${conflict.kind}-${index}`}
            className={featureThemeClassName('groupGroupConflictPanelWarningSurface')}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className={featureThemeClassName('groupGroupConflictPanelWarningIcon')}
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{getLocalizedConflictSummary(conflict, t)}</p>
                <p className="text-muted-foreground text-sm">
                  {getLocalizedConflictExplanation(conflict, t)}
                </p>
              </div>
            </div>

            {conflict.details.groups.length > 0 ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {t('features.groups.conflicts.panel.affectedGroupsTitle')}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {conflict.details.groups.map((group, groupIndex) => (
                    <GroupSearchCard
                      key={`${group.id}-${groupIndex}`}
                      group={{
                        id: group.id,
                        name: group.name,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {conflict.details.users.length > 0 ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {t('features.groups.conflicts.panel.affectedUsersTitle')}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {conflict.details.users.map((user, userIndex) => (
                    <UserSearchCard
                      key={`${user.id}-${userIndex}`}
                      index={userIndex}
                      user={{
                        id: user.id,
                        first_name: user.name,
                        handle: user.handle ?? undefined,
                        avatar: user.avatar_url,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {conflict.details.source_groups.length > 0 ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {t('features.groups.conflicts.panel.collidingSourceGroupsTitle')}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {conflict.details.source_groups.map((group, groupIndex) => (
                    <GroupSearchCard
                      key={`${group.id}-${groupIndex}`}
                      group={{
                        id: group.id,
                        name: group.name,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {conflict.details.paths.length > 0 ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {t('features.groups.conflicts.panel.collidingPathsTitle')}
                </p>
                <div className="space-y-2">
                  {conflict.details.paths.map((path, pathIndex) => (
                    <div
                      key={`${path.base_group_id}-${path.target_group_id}-${pathIndex}`}
                      className="bg-background/80 text-muted-foreground rounded-md border px-3 py-2"
                    >
                      <div className="text-foreground mb-1 flex items-center gap-2 font-medium">
                        <Route className="h-3.5 w-3.5" />
                        {path.group_names[0] ??
                          t('features.groups.conflicts.panel.baseGroupFallback')}{' '}
                        {'->'}{' '}
                        {path.group_names[path.group_names.length - 1] ??
                          t('features.groups.conflicts.panel.targetGroupFallback')}
                      </div>
                      <div>{path.group_names.join(' -> ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {conflict.resolutions.length > 0 ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {t('features.groups.conflicts.panel.resolutionTitle')}
                </p>
                <div className="space-y-2">
                  {conflict.resolutions.map((resolution, resolutionIndex) => (
                    <div
                      key={`${resolution.label}-${resolutionIndex}`}
                      className="bg-background/80 rounded-md border px-3 py-2"
                    >
                      <div className="font-medium">
                        {getLocalizedResolution(conflict, resolutionIndex, t).label}
                      </div>
                      <div className="text-muted-foreground">
                        {getLocalizedResolution(conflict, resolutionIndex, t).description}
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs">
                        {resolution.self_service
                          ? t('features.groups.conflicts.panel.selfService')
                          : t('features.groups.conflicts.panel.notSelfService')}
                        {resolution.required_role
                          ? ` ${t('features.groups.conflicts.panel.requiredRole', { role: resolution.required_role })}`
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface GroupConflictDialogProps {
  response: GroupConflictResponse | null | undefined;
  title?: string;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: 'ghost' | 'outline' | 'link';
  triggerSize?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
}

export function GroupConflictDialog({
  response,
  title,
  description,
  triggerLabel,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  className,
}: GroupConflictDialogProps) {
  const { t } = useTranslation();

  const resolvedTitle = title ?? t('features.groups.conflicts.dialog.title');
  const resolvedDescription = description ?? t('features.groups.conflicts.dialog.description');
  const resolvedTriggerLabel = triggerLabel ?? t('features.groups.conflicts.dialog.triggerLabel');

  if (!response || response.conflicts.length === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-action-id="groups.conflicts.open.details"
          variant={triggerVariant}
          size={triggerSize}
          className={className}
        >
          <Info className="mr-2 h-4 w-4" />
          {resolvedTriggerLabel}
        </Button>
      </DialogTrigger>
      <ManagementDialogContent className="h-[min(90dvh,42rem)] sm:max-w-2xl">
        <ManagementDialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </ManagementDialogHeader>
        <ManagementDialogBody>
          <GroupConflictPanel response={response} />
        </ManagementDialogBody>
      </ManagementDialogContent>
    </Dialog>
  );
}
