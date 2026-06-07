import { PermissionError } from '@/zero/rbac/errors';
import { can } from '@/zero/rbac/can';
import { zql } from '@/zero/schema';
import type { ZeroContext } from '@/zero/context';
import type { ZeroTransaction } from '@/server/zero-mutate';
import { isActiveGroupStatus, userName } from '@/zero/server-helpers';
import { filterHierarchyRelationships } from '@/zero/groups/membership-helpers';
import {
  buildGroupConflictResponse,
  type GroupConflict,
  type GroupConflictGroup,
  type GroupConflictResponse,
  throwGroupConflictResponse,
} from '@/features/groups/logic/groupConflict';
import type {
  GroupConflictMembershipPreflight,
  GroupConflictPreflightInput,
  GroupConflictNetworkLinkUpsertPreflight,
} from '@/features/groups/logic/groupConflictPreflight';
import {
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  resolveChildBaseGroups,
  resolveHierarchicalAncestors,
} from '@/features/groups/logic/hierarchy';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';
import {
  buildDerivedGroupNetworkMetaMap,
  explodeNetworkLinksToRelationships,
  type DerivedNetworkRelationshipRow,
} from '@/zero/network/derived';
import { normalizeMembershipRules } from '@/zero/network/membershipRules';

type ZeroTransactionLike = Pick<ZeroTransaction, 'run' | 'mutate'>;
type PermissionTx = Parameters<typeof can>[0];
type UserNameTx = Parameters<typeof userName>[0];

interface GroupRow {
  id: string;
  name?: string | null;
  group_type?: string | null;
  connected_group_id?: string | null;
  sibling_membership_mode?: string | null;
  sibling_role_id?: string | null;
  parliament_source_group_ids?: string[];
}

type RelationshipRow = DerivedNetworkRelationshipRow;

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string;
  status: string | null;
  visibility: string;
  source: string;
  source_group_id: string | null;
  created_at: number;
}

function toConflictGroup(
  groupId: string,
  groupsById: ReadonlyMap<string, GroupRow>
): GroupConflictGroup {
  const group = groupsById.get(groupId);
  return {
    id: groupId,
    name: group?.name ?? 'Group',
    group_type: group?.group_type ?? null,
  };
}

function isActiveDirectMembership(membership: MembershipRow) {
  return membership.source === 'direct' && isActiveGroupStatus(membership.status);
}

function isHierarchyRelationship(relationship: Pick<RelationshipRow, 'relationship_type'>) {
  return relationship.relationship_type !== 'sibling';
}

function isActiveGroupRelationship(relationship: Pick<RelationshipRow, 'status'>) {
  return (
    relationship.status == null ||
    relationship.status === 'active' ||
    relationship.status === 'accepted'
  );
}

async function hasGroupPermission(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  resource: 'groupRelationships' | 'groupMemberships',
  groupId: string
) {
  try {
    await can(tx as PermissionTx, ctx, {
      action: 'manage',
      resource,
      groupId,
    });
    return true;
  } catch (error) {
    if (error instanceof PermissionError) {
      return false;
    }
    throw error;
  }
}

async function buildConflictUser(tx: ZeroTransactionLike, userId: string) {
  const user = await tx.run(zql.user.where('id', userId).one());
  return {
    id: userId,
    name:
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      user?.handle ||
      (await userName(tx as UserNameTx, userId)),
    handle: user?.handle ?? null,
    avatar_url: user?.avatar ?? null,
  };
}

async function loadGroupGraphSnapshot(tx: ZeroTransactionLike) {
  const [groups, memberships, links, rights, rules] = await Promise.all([
    tx.run(zql.group),
    tx.run(zql.group_membership),
    tx.run(zql.network_link),
    tx.run(zql.network_link_right),
    tx.run(zql.network_link_membership_rule),
  ]);

  const derivedGroupMetaById = buildDerivedGroupNetworkMetaMap({
    groupIds: groups.map(group => group.id),
    links,
    rights,
    rules,
  });
  const groupsWithDerivedNetworkMeta = groups.map(group => ({
    ...group,
    ...(derivedGroupMetaById.get(group.id) ?? {}),
  })) as GroupRow[];
  const groupsById = new Map(groupsWithDerivedNetworkMeta.map(group => [group.id, group]));
  return {
    groups: groupsWithDerivedNetworkMeta,
    groupsById,
    relationships: explodeNetworkLinksToRelationships({
      links,
      rights,
      rules,
      includeInactive: true,
    }),
    memberships: memberships as MembershipRow[],
  };
}

function buildHierarchySourceSets(args: {
  parentGroupId: string;
  childGroupId: string;
  pvrRelationships: readonly RelationshipRow[];
  activeGroupLinks: readonly RelationshipRow[];
  groupsById: ReadonlyMap<string, GroupRow>;
}) {
  const newBaseGroupIds = new Set<string>([
    args.childGroupId,
    ...resolveChildBaseGroups(args.childGroupId, [...args.pvrRelationships], args.groupsById),
  ]);

  const existingBaseGroupIds = new Set<string>();

  for (const baseGroupId of resolveChildBaseGroups(
    args.parentGroupId,
    [...args.pvrRelationships],
    args.groupsById
  )) {
    if (!newBaseGroupIds.has(baseGroupId)) {
      existingBaseGroupIds.add(baseGroupId);
    }
  }

  for (const relationship of args.activeGroupLinks) {
    const pair = getHierarchyRelationshipPair(relationship);
    if (!pair) {
      continue;
    }

    if (
      pair.parentGroupId !== args.parentGroupId ||
      pair.childGroupId === args.childGroupId ||
      !isActiveGroupRelationship(relationship)
    ) {
      continue;
    }

    const baseGroupIds = resolveChildBaseGroups(
      pair.childGroupId,
      [...args.pvrRelationships],
      args.groupsById
    );

    for (const baseGroupId of baseGroupIds.length > 0 ? baseGroupIds : [pair.childGroupId]) {
      if (!newBaseGroupIds.has(baseGroupId)) {
        existingBaseGroupIds.add(baseGroupId);
      }
    }
  }

  return { newBaseGroupIds, existingBaseGroupIds };
}

function getSimulatedActiveDirectGroupIds(args: {
  memberships: readonly MembershipRow[];
  targetUserId: string;
  targetGroupId: string;
  membershipId?: string;
}) {
  const groupIds = new Set<string>();

  for (const membership of args.memberships) {
    if (membership.user_id !== args.targetUserId || !isActiveDirectMembership(membership)) {
      continue;
    }

    if (args.membershipId && membership.id === args.membershipId) {
      continue;
    }

    groupIds.add(membership.group_id);
  }

  groupIds.add(args.targetGroupId);
  return groupIds;
}

function getEffectiveActiveGroupIdsForUser(args: {
  memberships: readonly MembershipRow[];
  targetUserId: string;
  targetGroupId: string;
  targetGroupType: string | null | undefined;
  membershipId?: string;
  activePvrRelationships: readonly RelationshipRow[];
  groupsById: ReadonlyMap<string, GroupRow>;
}) {
  const groupIds = new Set<string>();

  for (const membership of args.memberships) {
    if (membership.user_id !== args.targetUserId || !isActiveGroupStatus(membership.status)) {
      continue;
    }

    if (args.membershipId && membership.id === args.membershipId) {
      continue;
    }

    groupIds.add(membership.group_id);
  }

  groupIds.add(args.targetGroupId);

  if (args.targetGroupType === 'base') {
    for (const ancestorGroupId of resolveHierarchicalAncestors(
      args.targetGroupId,
      [...args.activePvrRelationships],
      args.groupsById
    )) {
      groupIds.add(ancestorGroupId);
    }
  }

  return groupIds;
}

async function buildMembershipActivationConflicts(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictMembershipPreflight
): Promise<GroupConflictResponse> {
  const snapshot = await loadGroupGraphSnapshot(tx);
  const membership =
    args.membership_id != null
      ? ((await tx.run(zql.group_membership.where('id', args.membership_id).one())) as
          | MembershipRow
          | undefined)
      : null;
  const targetGroupId = args.group_id ?? membership?.group_id ?? null;
  const targetUserId = args.user_id ?? membership?.user_id ?? ctx.userID;

  if (!targetGroupId || !targetUserId) {
    return buildGroupConflictResponse([]);
  }

  const targetGroup = snapshot.groupsById.get(targetGroupId) ?? null;
  if (!targetGroup) {
    return buildGroupConflictResponse([]);
  }

  const activePvrRelationships = filterHierarchyRelationships(
    snapshot.relationships.filter(
      relationship => isHierarchyRelationship(relationship) && relationship.status === 'active'
    ),
    snapshot.groupsById
  );

  const conflicts: GroupConflict[] = [];

  if (targetGroup.group_type === 'base') {
    const targetAncestors = resolveHierarchicalAncestors(
      targetGroupId,
      [...activePvrRelationships],
      snapshot.groupsById
    );
    const simulatedActiveDirectGroupIds = getSimulatedActiveDirectGroupIds({
      memberships: snapshot.memberships,
      targetUserId,
      targetGroupId,
      membershipId: membership?.id,
    });

    for (const conflictingGroupId of simulatedActiveDirectGroupIds) {
      if (conflictingGroupId === targetGroupId) {
        continue;
      }

      const sharedTargetGroupId = targetAncestors.find(ancestorGroupId =>
        resolveChildBaseGroups(
          ancestorGroupId,
          [...activePvrRelationships],
          snapshot.groupsById
        ).includes(conflictingGroupId)
      );

      if (!sharedTargetGroupId) {
        continue;
      }

      const selfService = ctx.userID === targetUserId;

      conflicts.push({
        kind: 'hierarchy_member_overlap',
        blocking: true,
        summary: 'Nur eine speisende Untergruppe pro Hierarchie ist erlaubt.',
        explanation:
          'Die Aktivierung wuerde diese Person in zwei Untergruppen derselben Hierarchie gleichzeitig aktiv machen.',
        details: {
          users: [await buildConflictUser(tx, targetUserId)],
          groups: [
            toConflictGroup(sharedTargetGroupId, snapshot.groupsById),
            toConflictGroup(targetGroupId, snapshot.groupsById),
            toConflictGroup(conflictingGroupId, snapshot.groupsById),
          ],
          source_groups: [
            toConflictGroup(targetGroupId, snapshot.groupsById),
            toConflictGroup(conflictingGroupId, snapshot.groupsById),
          ],
          paths: [],
          target_group: toConflictGroup(sharedTargetGroupId, snapshot.groupsById),
        },
        resolutions: selfService
          ? [
              {
                label: 'Andere Untergruppe verlassen',
                description:
                  'Beende zuerst die aktive Mitgliedschaft in der anderen Untergruppe derselben Hierarchie.',
                self_service: true,
                group_id: conflictingGroupId,
              },
              {
                label: 'Andere Gruppe waehlen',
                description:
                  'Ziehe die aktuelle Anfrage oder Einladung zurueck und nutze eine andere Untergruppe.',
                self_service: true,
                group_id: targetGroupId,
              },
              {
                label: 'Admin kontaktieren',
                description:
                  'Wenn du die andere Mitgliedschaft nicht selbst beenden kannst, kontaktiere die zustaendige Gruppe.',
                self_service: false,
                group_id: conflictingGroupId,
                required_role: 'Admin',
              },
            ]
          : [
              {
                label: 'Mitgliedschaft zuerst klaeren',
                description:
                  'Die Person braucht vor der Aktivierung genau eine speisende Untergruppe in dieser Hierarchie.',
                self_service: false,
                group_id: conflictingGroupId,
                required_role: 'Admin',
              },
            ],
      });
    }
  }

  const effectiveActiveGroupIds = getEffectiveActiveGroupIdsForUser({
    memberships: snapshot.memberships,
    targetUserId,
    targetGroupId,
    targetGroupType: targetGroup.group_type,
    membershipId: membership?.id,
    activePvrRelationships,
    groupsById: snapshot.groupsById,
  });

  const siblingGroups = snapshot.groups.filter(
    group => group.group_type === 'sibling' && group.sibling_membership_mode === 'parliament'
  );

  for (const siblingGroup of siblingGroups) {
    const sourceGroupIds = siblingGroup.parliament_source_group_ids ?? [];
    const matchingSourceGroupIds = sourceGroupIds.filter(sourceGroupId =>
      effectiveActiveGroupIds.has(sourceGroupId)
    );

    if (matchingSourceGroupIds.length < 2) {
      continue;
    }

    const selfService = ctx.userID === targetUserId;

    conflicts.push({
      kind: 'sibling_source_overlap',
      blocking: true,
      summary: 'Eine Parlamentsgruppe darf pro Person nur eine speisende Source-Gruppe haben.',
      explanation:
        'Die Aktivierung wuerde diese Person gleichzeitig in mehreren Source-Gruppen derselben Parlamentsgruppe aktiv machen.',
      details: {
        users: [await buildConflictUser(tx, targetUserId)],
        groups: [toConflictGroup(siblingGroup.id, snapshot.groupsById)],
        source_groups: matchingSourceGroupIds.map(sourceGroupId =>
          toConflictGroup(sourceGroupId, snapshot.groupsById)
        ),
        paths: [],
        target_group: toConflictGroup(siblingGroup.id, snapshot.groupsById),
      },
      resolutions: selfService
        ? [
            {
              label: 'Andere Source-Gruppe verlassen',
              description:
                'Beende zuerst die aktive Mitgliedschaft in einer der anderen speisenden Gruppen.',
              self_service: true,
              group_id: matchingSourceGroupIds[1] ?? matchingSourceGroupIds[0],
            },
            {
              label: 'Andere Gruppe waehlen',
              description:
                'Nutze fuer diese Parlamentsstruktur nur eine der speisenden Gruppen gleichzeitig.',
              self_service: true,
              group_id: targetGroupId,
            },
            {
              label: 'Zustaendige Admins kontaktieren',
              description:
                'Falls du die andere Source-Mitgliedschaft nicht selbst beenden kannst, braucht es die andere Gruppe.',
              self_service: false,
              group_id: matchingSourceGroupIds[1] ?? matchingSourceGroupIds[0],
              required_role: 'Admin',
            },
          ]
        : [
            {
              label: 'Source-Mitgliedschaften klaeren',
              description:
                'Vor der Aktivierung muss die Person in genau einer speisenden Source-Gruppe dieser Parlamentsgruppe verbleiben.',
              self_service: false,
              group_id: siblingGroup.id,
              required_role: 'Admin',
            },
          ],
    });
  }

  const dedupedConflicts = conflicts.filter(
    (conflict, index) =>
      conflicts.findIndex(
        candidate =>
          candidate.kind === conflict.kind &&
          candidate.summary === conflict.summary &&
          candidate.details.target_group?.id === conflict.details.target_group?.id
      ) === index
  );

  return buildGroupConflictResponse(dedupedConflicts);
}

export function buildDraftNetworkLinkRelationships(args: GroupConflictNetworkLinkUpsertPreflight) {
  const createdAt = Date.now();
  const status: RelationshipRow['status'] = 'active';
  const membershipRules = normalizeMembershipRules(args.membership_rule);
  const structuralRelation = args.structural_relation as RelationshipRow['structural_relation'];
  const rows = args.rights.flatMap<RelationshipRow>(right => {
    if (right.status === 'rejected') {
      return [];
    }

    const rightRows: RelationshipRow[] = [];
    const rightDirection = right.direction as RelationshipRow['right_direction'];

    if (right.direction === 'forward' || right.direction === 'bidirectional') {
      rightRows.push({
        id: `${args.link_id ?? 'draft'}:${right.id ?? right.right_key}:forward`,
        network_link_id: args.link_id ?? 'draft',
        network_link_right_id: right.id ?? `${args.link_id ?? 'draft'}:${right.right_key}`,
        group_id: args.source_group_id,
        related_group_id: args.target_group_id,
        relationship_type: args.structural_relation === 'sibling' ? 'sibling' : 'child',
        with_right: right.right_key,
        status,
        initiator_group_id: right.initiator_group_id ?? null,
        created_at: createdAt,
        structural_relation: structuralRelation,
        membership_mode: membershipRules.membership_mode,
        membership_direction: membershipRules.membership_direction,
        membership_role_id: membershipRules.role_id ?? null,
        membership_source_group_ids: membershipRules.source_group_ids ?? null,
        relationship_direction: 'forward',
        right_direction: rightDirection,
      });
    }

    if (right.direction === 'backward' || right.direction === 'bidirectional') {
      rightRows.push({
        id: `${args.link_id ?? 'draft'}:${right.id ?? right.right_key}:backward`,
        network_link_id: args.link_id ?? 'draft',
        network_link_right_id: right.id ?? `${args.link_id ?? 'draft'}:${right.right_key}`,
        group_id: args.target_group_id,
        related_group_id: args.source_group_id,
        relationship_type: args.structural_relation === 'sibling' ? 'sibling' : 'parent',
        with_right: right.right_key,
        status,
        initiator_group_id: right.initiator_group_id ?? null,
        created_at: createdAt,
        structural_relation: structuralRelation,
        membership_mode: membershipRules.membership_mode,
        membership_direction: membershipRules.membership_direction,
        membership_role_id: membershipRules.role_id ?? null,
        membership_source_group_ids: membershipRules.source_group_ids ?? null,
        relationship_direction: 'backward',
        right_direction: rightDirection,
      });
    }

    return rightRows;
  });

  if (rows.length > 0 || membershipRules.membership_mode === 'none') {
    return rows;
  }

  return [
    {
      id: `${args.link_id ?? 'draft'}:structural:forward`,
      network_link_id: args.link_id ?? 'draft',
      network_link_right_id: `${args.link_id ?? 'draft'}:structural`,
      group_id: args.source_group_id,
      related_group_id: args.target_group_id,
      relationship_type: args.structural_relation === 'sibling' ? 'sibling' : 'child',
      with_right: null,
      status,
      initiator_group_id: null,
      created_at: createdAt,
      structural_relation: structuralRelation,
      membership_mode: membershipRules.membership_mode,
      membership_direction: membershipRules.membership_direction,
      membership_role_id: membershipRules.role_id ?? null,
      membership_source_group_ids: membershipRules.source_group_ids ?? null,
      relationship_direction: 'forward',
      right_direction: 'forward',
    } satisfies RelationshipRow,
    {
      id: `${args.link_id ?? 'draft'}:structural:backward`,
      network_link_id: args.link_id ?? 'draft',
      network_link_right_id: `${args.link_id ?? 'draft'}:structural`,
      group_id: args.target_group_id,
      related_group_id: args.source_group_id,
      relationship_type: args.structural_relation === 'sibling' ? 'sibling' : 'parent',
      with_right: null,
      status,
      initiator_group_id: null,
      created_at: createdAt,
      structural_relation: structuralRelation,
      membership_mode: membershipRules.membership_mode,
      membership_direction: membershipRules.membership_direction,
      membership_role_id: membershipRules.role_id ?? null,
      membership_source_group_ids: membershipRules.source_group_ids ?? null,
      relationship_direction: 'backward',
      right_direction: 'backward',
    } satisfies RelationshipRow,
  ];
}

async function buildNetworkLinkUpsertConflicts(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictNetworkLinkUpsertPreflight
): Promise<GroupConflictResponse> {
  const snapshot = await loadGroupGraphSnapshot(tx);
  const inputRelationships = buildDraftNetworkLinkRelationships(args);

  const hierarchyRelationships = inputRelationships.filter(isHierarchyRelationship);
  const activeGroupLinks = [
    ...snapshot.relationships.filter(
      relationship =>
        isHierarchyRelationship(relationship) &&
        isActiveGroupRelationship(relationship) &&
        relationship.network_link_id !== (args.link_id ?? 'draft')
    ),
    ...hierarchyRelationships,
  ];
  const conflicts: GroupConflict[] = [];

  if (hierarchyRelationships.length > 0) {
    const activePvrRelationships = filterHierarchyRelationships(
      activeGroupLinks.filter(
        relationship => isHierarchyRelationship(relationship) && relationship.status === 'active'
      ),
      snapshot.groupsById
    );

    const activeDirectMemberships = snapshot.memberships.filter(isActiveDirectMembership);
    const pairKeys = new Set<string>();

    for (const relationship of hierarchyRelationships) {
      const pair = getHierarchyRelationshipPair(relationship);
      if (!pair) {
        continue;
      }

      const pairKey = `${pair.parentGroupId}:${pair.childGroupId}`;
      if (pairKeys.has(pairKey)) {
        continue;
      }
      pairKeys.add(pairKey);

      const overlapUserIds = detectLinkConflicts(
        pair.parentGroupId,
        pair.childGroupId,
        [...activePvrRelationships],
        activeDirectMemberships,
        activeGroupLinks,
        snapshot.groupsById
      );

      if (overlapUserIds.length > 0) {
        const { newBaseGroupIds, existingBaseGroupIds } = buildHierarchySourceSets({
          parentGroupId: pair.parentGroupId,
          childGroupId: pair.childGroupId,
          pvrRelationships: activePvrRelationships,
          activeGroupLinks,
          groupsById: snapshot.groupsById,
        });
        const users = await Promise.all(
          overlapUserIds.map(userId => buildConflictUser(tx, userId))
        );
        const sourceGroupIds = new Set<string>();

        for (const membership of activeDirectMemberships) {
          if (!overlapUserIds.includes(membership.user_id)) {
            continue;
          }
          if (
            newBaseGroupIds.has(membership.group_id) ||
            existingBaseGroupIds.has(membership.group_id)
          ) {
            sourceGroupIds.add(membership.group_id);
          }
        }

        conflicts.push({
          kind: 'hierarchy_member_overlap',
          blocking: true,
          summary:
            'Die Verknuepfung wuerde Mitglieder aus mehreren Untergruppen derselben Hierarchie zusammenfuehren.',
          explanation:
            'Mindestens eine Person waere danach gleichzeitig in mehreren speisenden Untergruppen derselben Ziel-Hierarchie aktiv.',
          details: {
            users,
            groups: [
              toConflictGroup(pair.parentGroupId, snapshot.groupsById),
              toConflictGroup(pair.childGroupId, snapshot.groupsById),
            ],
            source_groups: [...sourceGroupIds].map(sourceGroupId =>
              toConflictGroup(sourceGroupId, snapshot.groupsById)
            ),
            paths: [],
            target_group: toConflictGroup(pair.parentGroupId, snapshot.groupsById),
          },
          resolutions: [
            {
              label: 'Mitgliedschaften angleichen',
              description:
                'Entferne oder deaktiviere ueberlappende Mitgliedschaften in einer der konkurrierenden Untergruppen.',
              self_service: await hasGroupPermission(
                tx,
                ctx,
                'groupMemberships',
                pair.parentGroupId
              ),
              group_id: pair.parentGroupId,
            },
            {
              label: 'Andere Gruppe kontaktieren',
              description:
                'Falls du die konkurrierende Untergruppe nicht selbst verwalten kannst, braucht es die zustaendige Admin-Seite.',
              self_service: false,
              group_id: pair.childGroupId,
              required_role: 'Admin',
            },
          ],
        });
      }

      const duplicatePathConflicts = detectDuplicateHierarchyPaths(
        [...activePvrRelationships],
        snapshot.groupsById
      ).filter(duplicateConflict => {
        const affectedBaseGroupIds = resolveChildBaseGroups(
          pair.childGroupId,
          [...activePvrRelationships],
          snapshot.groupsById
        );
        const relevantBaseGroupIds = new Set<string>(
          affectedBaseGroupIds.length > 0 ? affectedBaseGroupIds : [pair.childGroupId]
        );
        const relevantTargetGroupIds = new Set<string>([
          pair.parentGroupId,
          ...resolveHierarchicalAncestors(
            pair.parentGroupId,
            [...activePvrRelationships],
            snapshot.groupsById
          ),
        ]);

        return (
          relevantBaseGroupIds.has(duplicateConflict.baseGroupId) &&
          relevantTargetGroupIds.has(duplicateConflict.targetGroupId)
        );
      });

      for (const duplicatePathConflict of duplicatePathConflicts) {
        conflicts.push({
          kind: 'hierarchy_duplicate_path',
          blocking: true,
          summary: 'Verknuepfung wuerde denselben Unterbau doppelt anbinden.',
          explanation:
            'Dieselbe Leaf-Basisgruppe wuerde die Ziel-Hierarchie nach der Aktivierung ueber zwei aktive Pfade erreichen.',
          details: {
            users: [],
            groups: [
              toConflictGroup(duplicatePathConflict.baseGroupId, snapshot.groupsById),
              toConflictGroup(duplicatePathConflict.targetGroupId, snapshot.groupsById),
            ],
            source_groups: [
              toConflictGroup(duplicatePathConflict.baseGroupId, snapshot.groupsById),
            ],
            paths: duplicatePathConflict.paths.map(pathGroupIds => ({
              base_group_id: duplicatePathConflict.baseGroupId,
              target_group_id: duplicatePathConflict.targetGroupId,
              group_ids: pathGroupIds,
              group_names: pathGroupIds.map(
                groupId => snapshot.groupsById.get(groupId)?.name ?? 'Group'
              ),
            })),
            target_group: toConflictGroup(duplicatePathConflict.targetGroupId, snapshot.groupsById),
          },
          resolutions: [
            {
              label: 'Einen Pfad entfernen oder deaktivieren',
              description:
                'Die Verknuepfung ist erst moeglich, wenn nur noch ein aktiver Pfad zwischen Basisgruppe und Ziel-Hierarchie uebrig bleibt.',
              self_service: await hasGroupPermission(
                tx,
                ctx,
                'groupRelationships',
                duplicatePathConflict.targetGroupId
              ),
              group_id: duplicatePathConflict.targetGroupId,
            },
            {
              label: 'Zustaendige Gruppe kontaktieren',
              description:
                'Wenn du den konkurrierenden Pfad nicht selbst verwalten kannst, braucht es die Admin-Seite der betroffenen Hierarchie.',
              self_service: false,
              group_id: duplicatePathConflict.targetGroupId,
              required_role: 'Admin',
            },
          ],
        });
      }
    }
  }

  if (args.structural_relation === 'sibling') {
    const membershipRules = normalizeMembershipRules(args.membership_rule);
    const directionalRecipients: {
      recipientGroupId: string;
      sourceGroupIds: string[];
    }[] = [];

    if (
      membershipRules.membership_mode === 'selected_source_groups' &&
      membershipRules.membership_direction
    ) {
      directionalRecipients.push({
        recipientGroupId:
          membershipRules.membership_direction === 'forward'
            ? args.target_group_id
            : args.source_group_id,
        sourceGroupIds: [...new Set((membershipRules.source_group_ids ?? []).filter(Boolean))],
      });
    }

    for (const { recipientGroupId, sourceGroupIds } of directionalRecipients) {
      if (sourceGroupIds.length <= 1) {
        continue;
      }

      const membershipsByUserId = new Map<string, string[]>();

      for (const sourceGroupId of sourceGroupIds) {
        const activeMemberships = snapshot.memberships.filter(
          membership =>
            membership.group_id === sourceGroupId && isActiveGroupStatus(membership.status)
        );

        for (const membership of activeMemberships) {
          const currentSourceGroupIds = membershipsByUserId.get(membership.user_id) ?? [];
          currentSourceGroupIds.push(sourceGroupId);
          membershipsByUserId.set(membership.user_id, currentSourceGroupIds);
        }
      }

      const overlappingUserIds = [...membershipsByUserId.entries()]
        .filter(([, memberSourceGroupIds]) => new Set(memberSourceGroupIds).size > 1)
        .map(([userId]) => userId);

      if (overlappingUserIds.length === 0) {
        continue;
      }

      const involvedSourceGroupIds = new Set<string>();
      for (const userId of overlappingUserIds) {
        for (const sourceGroupId of membershipsByUserId.get(userId) ?? []) {
          involvedSourceGroupIds.add(sourceGroupId);
        }
      }

      conflicts.push({
        kind: 'sibling_source_overlap',
        blocking: true,
        summary: 'Die Parlaments-Konfiguration enthaelt ueberschneidende Source-Gruppen.',
        explanation:
          'Mindestens eine Person ist in mehr als einer speisenden Source-Gruppe dieser Parlamentsgruppe aktiv.',
        details: {
          users: await Promise.all(overlappingUserIds.map(userId => buildConflictUser(tx, userId))),
          groups: [toConflictGroup(recipientGroupId, snapshot.groupsById)],
          source_groups: [...involvedSourceGroupIds].map(sourceGroupId =>
            toConflictGroup(sourceGroupId, snapshot.groupsById)
          ),
          paths: [],
          target_group: toConflictGroup(recipientGroupId, snapshot.groupsById),
        },
        resolutions: [
          {
            label: 'Source-Gruppen bereinigen',
            description:
              'Entferne ueberschneidende Source-Gruppen oder klaere die Mitgliedschaften, bis jede Person nur noch in einer speisenden Gruppe landet.',
            self_service: false,
            group_id: recipientGroupId,
            required_role: 'Admin',
          },
        ],
      });
    }
  }

  const dedupedConflicts = conflicts.filter(
    (conflict, index) =>
      conflicts.findIndex(candidate => {
        const candidatePathKey = candidate.details.paths
          .map(path => path.group_ids.join('>'))
          .join('|');
        const conflictPathKey = conflict.details.paths
          .map(path => path.group_ids.join('>'))
          .join('|');
        return (
          candidate.kind === conflict.kind &&
          candidate.details.target_group?.id === conflict.details.target_group?.id &&
          candidatePathKey === conflictPathKey &&
          candidate.summary === conflict.summary
        );
      }) === index
  );

  return buildGroupConflictResponse(dedupedConflicts);
}

export async function resolveGroupConflictPreflight(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  input: GroupConflictPreflightInput
): Promise<GroupConflictResponse> {
  switch (input.kind) {
    case 'membership_activation':
      return buildMembershipActivationConflicts(tx, ctx, input);
    case 'network_link_upsert':
      return buildNetworkLinkUpsertConflicts(tx, ctx, input);
  }
}

export async function assertNoBlockingGroupConflicts(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  input: GroupConflictPreflightInput
) {
  const response = await resolveGroupConflictPreflight(tx, ctx, input);
  if (response.blocking) {
    throwGroupConflictResponse(response);
  }
  return response;
}

export async function assertNoBlockingConflictResponse(response: Promise<GroupConflictResponse>) {
  const resolvedResponse = await response;
  if (resolvedResponse.blocking) {
    throwGroupConflictResponse(resolvedResponse);
  }
  return resolvedResponse;
}

export async function getMembershipActivationConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictMembershipPreflight
) {
  return buildMembershipActivationConflicts(tx, ctx, args);
}

export async function getNetworkLinkUpsertConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictNetworkLinkUpsertPreflight
) {
  return buildNetworkLinkUpsertConflicts(tx, ctx, args);
}
