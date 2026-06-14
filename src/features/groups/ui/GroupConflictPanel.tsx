'use client';

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type {
  GroupConflict,
  GroupConflictKind,
  GroupConflictResponse,
} from '@/features/groups/logic/groupConflict';
import { AlertTriangle, Info, Route } from 'lucide-react';
import { UserSearchCard } from '@/features/search/ui/UserSearchCard';
import { GroupSearchCard } from '@/features/search/ui/GroupSearchCard';

interface GroupConflictPanelProps {
  response: GroupConflictResponse;
}

const conflictKindTranslationKeyMap: Record<GroupConflictKind, string | null> = {
  hierarchy_member_overlap: 'hierarchyMemberOverlap',
  hierarchy_duplicate_path: 'hierarchyDuplicatePath',
  sibling_source_overlap: null,
  sibling_connected_membership_missing: null,
  permission_blocked_resolution: null,
};

function getLocalizedConflictSummary(
  conflict: GroupConflict,
  t: (key: string, fallback?: string) => string
) {
  const keySuffix = conflictKindTranslationKeyMap[conflict.kind];
  if (!keySuffix) {
    return conflict.summary;
  }

  return t(`features.groups.conflicts.kinds.${keySuffix}.summary`, conflict.summary);
}

function getLocalizedConflictExplanation(
  conflict: GroupConflict,
  t: (key: string, fallback?: string) => string
) {
  const keySuffix = conflictKindTranslationKeyMap[conflict.kind];
  if (!keySuffix) {
    return conflict.explanation;
  }

  return t(`features.groups.conflicts.kinds.${keySuffix}.explanation`, conflict.explanation);
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

  if (conflict.kind === 'hierarchy_member_overlap') {
    const keyBase =
      resolutionIndex === 0
        ? 'features.groups.conflicts.kinds.hierarchyMemberOverlap.resolutions.alignMemberships'
        : resolutionIndex === 1
          ? 'features.groups.conflicts.kinds.hierarchyMemberOverlap.resolutions.contactOtherGroup'
          : null;
    if (keyBase) {
      return {
        label: t(`${keyBase}.label`, resolution.label),
        description: t(`${keyBase}.description`, resolution.description),
      };
    }
  }

  if (conflict.kind === 'hierarchy_duplicate_path') {
    const keyBase =
      resolutionIndex === 0
        ? 'features.groups.conflicts.kinds.hierarchyDuplicatePath.resolutions.removePath'
        : resolutionIndex === 1
          ? 'features.groups.conflicts.kinds.hierarchyDuplicatePath.resolutions.contactResponsibleGroup'
          : null;
    if (keyBase) {
      return {
        label: t(`${keyBase}.label`, resolution.label),
        description: t(`${keyBase}.description`, resolution.description),
      };
    }
  }

  return {
    label: resolution.label,
    description: resolution.description,
  };
}

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
            className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
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
        <Button variant={triggerVariant} size={triggerSize} className={className}>
          <Info className="mr-2 h-4 w-4" />
          {resolvedTriggerLabel}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent className="max-h-[min(90dvh,42rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>
        <GroupConflictPanel response={response} />
      </ScrollableDialogContent>
    </Dialog>
  );
}
