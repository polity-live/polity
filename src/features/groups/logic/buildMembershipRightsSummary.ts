import { ACTION_RIGHTS, PERMISSION_IMPLIES } from '@/zero/rbac/constants';
import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import type { ActionRightOption } from '@/features/groups/types/group.types';
import { getMembershipDisplayRoles, sortGroupRoles } from './membershipDisplayRoles';

export {
  augmentMembershipsWithCurrentRoleHolders,
  getMembershipAssignedRoles,
  getMembershipDisplayRoles,
  getMembershipRoleSummary,
  hasElectedDisplayRole,
  sortGroupRoles,
} from './membershipDisplayRoles';

export interface MembershipRightSource {
  roleId: string;
  roleName: string;
  viaLabel: string;
  isDirect: boolean;
}

export interface MembershipRightSummary {
  key: string;
  resource: string;
  action: string;
  label: string;
  sources: MembershipRightSource[];
}

interface InternalMembershipRightSource extends MembershipRightSource {
  sortOrder: number;
}

function buildRightCatalog(actionRightsCatalog: readonly ActionRightOption[] = ACTION_RIGHTS) {
  const rightCatalog = actionRightsCatalog.map((right, index) => ({
    ...right,
    key: getRightKey(right.resource, right.action),
    index,
  }));

  return {
    rightCatalog,
    rightLabelByKey: new Map(rightCatalog.map(right => [right.key, right.label])),
    rightIndexByKey: new Map(rightCatalog.map(right => [right.key, right.index])),
  };
}

export function buildMembershipRightsSummary(
  membership: ParticipationLike,
  actionRightsCatalog?: readonly ActionRightOption[]
): MembershipRightSummary[] {
  return buildRightsSummaryForRoles(getMembershipDisplayRoles(membership), actionRightsCatalog);
}

export function buildRightsSummaryForRoles<TRole extends ParticipationRoleLike>(
  roles: readonly TRole[],
  actionRightsCatalog?: readonly ActionRightOption[]
): MembershipRightSummary[] {
  const { rightLabelByKey, rightIndexByKey } = buildRightCatalog(actionRightsCatalog);
  const rows = new Map<
    string,
    MembershipRightSummary & { sources: InternalMembershipRightSource[] }
  >();

  for (const role of sortGroupRoles(roles)) {
    for (const actionRight of role.action_rights || []) {
      if (!actionRight.resource || !actionRight.action) {
        continue;
      }

      const directKey = getRightKey(actionRight.resource, actionRight.action);
      const directLabel =
        rightLabelByKey.get(directKey) ??
        formatFallbackRightLabel(actionRight.resource, actionRight.action);

      addRightSource(rows, {
        targetKey: directKey,
        resource: actionRight.resource,
        action: actionRight.action,
        label: directLabel,
        source: {
          roleId: role.id,
          roleName: role.name || 'Role',
          viaLabel: directLabel,
          isDirect: true,
          sortOrder: role.sort_order ?? -1,
        },
      });

      const impliedActions =
        PERMISSION_IMPLIES[actionRight.action as keyof typeof PERMISSION_IMPLIES] || [];

      for (const impliedAction of impliedActions) {
        const impliedKey = getRightKey(actionRight.resource, impliedAction);
        const impliedLabel = rightLabelByKey.get(impliedKey);

        if (!impliedLabel) {
          continue;
        }

        addRightSource(rows, {
          targetKey: impliedKey,
          resource: actionRight.resource,
          action: impliedAction,
          label: impliedLabel,
          source: {
            roleId: role.id,
            roleName: role.name || 'Role',
            viaLabel: directLabel,
            isDirect: false,
            sortOrder: role.sort_order ?? -1,
          },
        });
      }
    }
  }

  return [...rows.values()]
    .sort((left, right) => {
      const leftIndex = rightIndexByKey.get(left.key) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = rightIndexByKey.get(right.key) ?? Number.MAX_SAFE_INTEGER;

      return (
        leftIndex - rightIndex ||
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
      );
    })
    .map(row => ({
      key: row.key,
      resource: row.resource,
      action: row.action,
      label: row.label,
      sources: [...row.sources]
        .sort(
          (left, right) =>
            right.sortOrder - left.sortOrder ||
            left.roleName.localeCompare(right.roleName, undefined, { sensitivity: 'base' })
        )
        .map(source => {
          const { sortOrder, ...rest } = source;
          void sortOrder;
          return rest;
        }),
    }));
}

function addRightSource(
  rows: Map<string, MembershipRightSummary & { sources: InternalMembershipRightSource[] }>,
  input: {
    targetKey: string;
    resource: string;
    action: string;
    label: string;
    source: InternalMembershipRightSource;
  }
) {
  const existingRow = rows.get(input.targetKey);
  const row = existingRow ?? {
    key: input.targetKey,
    resource: input.resource,
    action: input.action,
    label: input.label,
    sources: [],
  };

  const existingSourceIndex = row.sources.findIndex(
    source => source.roleId === input.source.roleId
  );

  if (existingSourceIndex === -1) {
    row.sources.push(input.source);
  } else {
    const existingSource = row.sources[existingSourceIndex];

    if (existingSource.isDirect) {
      rows.set(input.targetKey, row);
      return;
    }

    if (input.source.isDirect) {
      row.sources.splice(existingSourceIndex, 1, input.source);
    }
  }

  rows.set(input.targetKey, row);
}

function getRightKey(resource: string, action: string) {
  return `${resource}:${action}`;
}

function formatFallbackRightLabel(resource: string, action: string) {
  return `${resource} / ${action}`;
}
