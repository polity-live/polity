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
  GroupConflictDraftRelationship,
  GroupConflictMembershipPreflight,
  GroupConflictPreflightInput,
  GroupConflictRelationshipPreflight,
  GroupConflictSiblingConfigurationPreflight,
} from '@/features/groups/logic/groupConflictPreflight';
import {
  detectDuplicateHierarchyPaths,
  detectLinkConflicts,
  resolveChildBaseGroups,
  resolveHierarchicalAncestors,
} from '@/features/groups/logic/hierarchy';
import { getHierarchyRelationshipPair } from '@/features/network/logic/groupRelationshipOrientation';

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
}

interface RelationshipRow {
  id: string;
  group_id: string;
  related_group_id: string;
  relationship_type: string | null;
  with_right: string | null;
  status: string | null;
  initiator_group_id: string | null;
  created_at: number;
}

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

function createRelationshipRow(
  relationship: GroupConflictDraftRelationship | RelationshipRow,
  overrideStatus?: string
): RelationshipRow {
  return {
    id: relationship.id,
    group_id: relationship.group_id,
    related_group_id: relationship.related_group_id,
    relationship_type: relationship.relationship_type ?? null,
    with_right: relationship.with_right ?? null,
    status: overrideStatus ?? relationship.status ?? null,
    initiator_group_id: relationship.initiator_group_id ?? null,
    created_at: 'created_at' in relationship ? (relationship.created_at ?? Date.now()) : Date.now(),
  };
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
  const [groups, relationships, memberships, siblingSources] = await Promise.all([
    tx.run(zql.group),
    tx.run(zql.group_relationship),
    tx.run(zql.group_membership),
    tx.run(zql.group_sibling_source),
  ]);

  const groupsById = new Map(groups.map(group => [group.id, group]));
  return {
    groups: groups as GroupRow[],
    groupsById,
    relationships: relationships.map(relationship =>
      createRelationshipRow(relationship as RelationshipRow)
    ),
    memberships: memberships as MembershipRow[],
    siblingSources,
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
      relationship =>
        relationship.with_right === 'passiveVotingRight' && relationship.status === 'active'
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
    const sourceGroupIds = snapshot.siblingSources
      .filter(sourceLink => sourceLink.group_id === siblingGroup.id)
      .map(sourceLink => sourceLink.source_group_id);
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

async function buildRelationshipActivationConflicts(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictRelationshipPreflight
): Promise<GroupConflictResponse> {
  const snapshot = await loadGroupGraphSnapshot(tx);
  const inputRelationships =
    args.relationship_ids && args.relationship_ids.length > 0
      ? snapshot.relationships.filter(relationship =>
          args.relationship_ids?.includes(relationship.id)
        )
      : (args.draft_relationships ?? []).map(relationship =>
          createRelationshipRow(relationship, 'active')
        );

  const hierarchyRelationships = inputRelationships.filter(isHierarchyRelationship);
  if (hierarchyRelationships.length === 0) {
    return buildGroupConflictResponse([]);
  }

  const activeGroupLinks = [
    ...snapshot.relationships.filter(
      relationship =>
        isHierarchyRelationship(relationship) &&
        isActiveGroupRelationship(relationship) &&
        !hierarchyRelationships.some(candidate => candidate.id === relationship.id)
    ),
    ...hierarchyRelationships.map(relationship => createRelationshipRow(relationship, 'active')),
  ];

  const activePvrRelationships = filterHierarchyRelationships(
    activeGroupLinks.filter(
      relationship =>
        relationship.with_right === 'passiveVotingRight' && relationship.status === 'active'
    ),
    snapshot.groupsById
  );

  const activeDirectMemberships = snapshot.memberships.filter(isActiveDirectMembership);
  const pairKeys = new Set<string>();
  const conflicts: GroupConflict[] = [];

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
      const users = await Promise.all(overlapUserIds.map(userId => buildConflictUser(tx, userId)));
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
            self_service: await hasGroupPermission(tx, ctx, 'groupMemberships', pair.parentGroupId),
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
          source_groups: [toConflictGroup(duplicatePathConflict.baseGroupId, snapshot.groupsById)],
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

async function buildSiblingConfigurationConflicts(
  tx: ZeroTransactionLike,
  _ctx: ZeroContext,
  args: GroupConflictSiblingConfigurationPreflight
): Promise<GroupConflictResponse> {
  if (args.group_type !== 'sibling' || args.sibling_membership_mode !== 'parliament') {
    return buildGroupConflictResponse([]);
  }

  const sourceGroupIds = [...new Set((args.parliament_source_group_ids ?? []).filter(Boolean))];
  if (sourceGroupIds.length < 2) {
    return buildGroupConflictResponse([]);
  }

  const snapshot = await loadGroupGraphSnapshot(tx);
  const membershipsByUserId = new Map<string, string[]>();

  for (const sourceGroupId of sourceGroupIds) {
    const activeMemberships = snapshot.memberships.filter(
      membership => membership.group_id === sourceGroupId && isActiveGroupStatus(membership.status)
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
    return buildGroupConflictResponse([]);
  }

  const involvedSourceGroupIds = new Set<string>();
  for (const userId of overlappingUserIds) {
    for (const sourceGroupId of membershipsByUserId.get(userId) ?? []) {
      involvedSourceGroupIds.add(sourceGroupId);
    }
  }

  return buildGroupConflictResponse([
    {
      kind: 'sibling_source_overlap',
      blocking: true,
      summary: 'Die Parlaments-Konfiguration enthaelt ueberschneidende Source-Gruppen.',
      explanation:
        'Mindestens eine Person ist in mehr als einer speisenden Source-Gruppe dieser Parlamentsgruppe aktiv.',
      details: {
        users: await Promise.all(overlappingUserIds.map(userId => buildConflictUser(tx, userId))),
        groups: [toConflictGroup(args.group_id, snapshot.groupsById)],
        source_groups: [...involvedSourceGroupIds].map(sourceGroupId =>
          toConflictGroup(sourceGroupId, snapshot.groupsById)
        ),
        paths: [],
        target_group: toConflictGroup(args.group_id, snapshot.groupsById),
      },
      resolutions: [
        {
          label: 'Source-Gruppen bereinigen',
          description:
            'Entferne ueberschneidende Source-Gruppen oder klaere die Mitgliedschaften, bis jede Person nur noch in einer speisenden Gruppe landet.',
          self_service: false,
          group_id: args.group_id,
          required_role: 'Admin',
        },
      ],
    },
  ]);
}

export async function resolveGroupConflictPreflight(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  input: GroupConflictPreflightInput
): Promise<GroupConflictResponse> {
  switch (input.kind) {
    case 'membership_activation':
      return buildMembershipActivationConflicts(tx, ctx, input);
    case 'relationship_activation':
      return buildRelationshipActivationConflicts(tx, ctx, input);
    case 'sibling_configuration':
      return buildSiblingConfigurationConflicts(tx, ctx, input);
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

export async function getSiblingConfigurationConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictSiblingConfigurationPreflight
) {
  return buildSiblingConfigurationConflicts(tx, ctx, args);
}

export async function getMembershipActivationConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictMembershipPreflight
) {
  return buildMembershipActivationConflicts(tx, ctx, args);
}

export async function getRelationshipActivationConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictRelationshipPreflight
) {
  return buildRelationshipActivationConflicts(tx, ctx, args);
}
