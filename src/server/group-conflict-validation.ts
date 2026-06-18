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
  GroupConflictGroupConnectionUpsertPreflight,
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
  deriveGroupRelationships,
  type DerivedNetworkRelationshipRow,
} from '@/zero/network/derived';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
  const [
    groups,
    memberships,
    connections,
    grants,
    rules,
    hierarchyPaths,
    membershipLocks,
    siblingSourceLocks,
  ] = await Promise.all([
    tx.run(zql.group),
    tx.run(zql.group_membership),
    tx.run(zql.group_connection),
    tx.run(zql.group_right_grant),
    tx.run(zql.group_membership_rule),
    tx.run(zql.group_hierarchy_path),
    tx.run(zql.group_membership_exclusivity_lock),
    tx.run(zql.group_sibling_source_lock),
  ]);

  const derivedGroupMetaById = buildDerivedGroupNetworkMetaMap({
    groupIds: groups.map(group => group.id),
    connections,
    grants,
    rules,
  });
  const groupsWithDerivedNetworkMeta = groups.map(group => ({
    ...group,
    ...(derivedGroupMetaById.get(group.id) ?? {}),
    group_type: group.group_type ?? derivedGroupMetaById.get(group.id)?.group_type,
    has_hierarchy_children:
      group.has_hierarchy_children ?? derivedGroupMetaById.get(group.id)?.has_hierarchy_children,
    has_sibling_connections:
      group.has_sibling_connections ?? derivedGroupMetaById.get(group.id)?.has_sibling_connections,
    connected_group_id:
      group.connected_group_id ?? derivedGroupMetaById.get(group.id)?.connected_group_id,
    sibling_membership_mode:
      group.sibling_membership_mode ?? derivedGroupMetaById.get(group.id)?.sibling_membership_mode,
    sibling_role_id: group.sibling_role_id ?? derivedGroupMetaById.get(group.id)?.sibling_role_id,
  })) as GroupRow[];
  const groupsById = new Map(groupsWithDerivedNetworkMeta.map(group => [group.id, group]));
  return {
    groups: groupsWithDerivedNetworkMeta,
    groupsById,
    relationships: deriveGroupRelationships({
      connections,
      grants,
      rules,
      includeInactive: true,
    }),
    memberships: memberships as MembershipRow[],
    hierarchyPaths,
    membershipLocks,
    siblingSourceLocks,
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
    const targetHierarchyGroupIds = new Set(
      snapshot.hierarchyPaths
        .filter(
          (path: any) =>
            path.status === 'active' &&
            (path.base_group_id === targetGroupId || path.descendant_group_id === targetGroupId)
        )
        .map((path: any) => path.ancestor_group_id)
    );

    for (const lock of snapshot.membershipLocks as any[]) {
      if (
        lock.status !== 'active' ||
        lock.user_id !== targetUserId ||
        !targetHierarchyGroupIds.has(lock.hierarchy_group_id) ||
        lock.source_group_id === targetGroupId ||
        (membership?.id && lock.group_membership_id === membership.id)
      ) {
        continue;
      }

      conflicts.push({
        kind: 'hierarchy_member_overlap',
        blocking: true,
        summary: 'Nur eine speisende Untergruppe pro Hierarchie ist erlaubt.',
        explanation:
          'Die Aktivierung wuerde diese Person in zwei Untergruppen derselben Hierarchie gleichzeitig aktiv machen.',
        details: {
          users: [await buildConflictUser(tx, targetUserId)],
          groups: [
            toConflictGroup(lock.hierarchy_group_id, snapshot.groupsById),
            toConflictGroup(targetGroupId, snapshot.groupsById),
            toConflictGroup(lock.source_group_id, snapshot.groupsById),
          ],
          source_groups: [
            toConflictGroup(targetGroupId, snapshot.groupsById),
            toConflictGroup(lock.source_group_id, snapshot.groupsById),
          ],
          paths: [],
          target_group: toConflictGroup(lock.hierarchy_group_id, snapshot.groupsById),
        },
        resolutions: [
          {
            label: translateText('generated.inline.0661_mitgliedschaft_zuerst_klaeren_d4f1a8e1'),
            description: translateText(
              'generated.inline.0662_die_person_braucht_vor_der_aktivierung_genau__e776cbaa'
            ),
            self_service: ctx.userID === targetUserId,
            group_id: lock.source_group_id,
            required_role: ctx.userID === targetUserId ? undefined : 'Admin',
          },
        ],
      });
    }

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
                label: translateText('generated.inline.0655_andere_untergruppe_verlassen_8424bbb5'),
                description: translateText(
                  'generated.inline.0656_beende_zuerst_die_aktive_mitgliedschaft_in_de_563d3245'
                ),
                self_service: true,
                group_id: conflictingGroupId,
              },
              {
                label: translateText('generated.inline.0657_andere_gruppe_waehlen_886e4e05'),
                description: translateText(
                  'generated.inline.0658_ziehe_die_aktuelle_anfrage_oder_einladung_zur_f209d59b'
                ),
                self_service: true,
                group_id: targetGroupId,
              },
              {
                label: translateText('generated.inline.0659_admin_kontaktieren_7e504533'),
                description: translateText(
                  'generated.inline.0660_wenn_du_die_andere_mitgliedschaft_nicht_selbs_3df3a2f3'
                ),
                self_service: false,
                group_id: conflictingGroupId,
                required_role: 'Admin',
              },
            ]
          : [
              {
                label: translateText(
                  'generated.inline.0661_mitgliedschaft_zuerst_klaeren_d4f1a8e1'
                ),
                description: translateText(
                  'generated.inline.0662_die_person_braucht_vor_der_aktivierung_genau__e776cbaa'
                ),
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
              label: translateText('generated.inline.0663_andere_source_gruppe_verlassen_1b7590bc'),
              description: translateText(
                'generated.inline.0664_beende_zuerst_die_aktive_mitgliedschaft_in_ei_d743c119'
              ),
              self_service: true,
              group_id: matchingSourceGroupIds[1] ?? matchingSourceGroupIds[0],
            },
            {
              label: translateText('generated.inline.0657_andere_gruppe_waehlen_886e4e05'),
              description: translateText(
                'generated.inline.0665_nutze_fuer_diese_parlamentsstruktur_nur_eine__06c7aa89'
              ),
              self_service: true,
              group_id: targetGroupId,
            },
            {
              label: translateText(
                'generated.inline.0666_zustaendige_admins_kontaktieren_1f3c2d84'
              ),
              description: translateText(
                'generated.inline.0667_falls_du_die_andere_source_mitgliedschaft_nic_b3b9e3b0'
              ),
              self_service: false,
              group_id: matchingSourceGroupIds[1] ?? matchingSourceGroupIds[0],
              required_role: 'Admin',
            },
          ]
        : [
            {
              label: translateText(
                'generated.inline.0668_source_mitgliedschaften_klaeren_9e94c7b6'
              ),
              description: translateText(
                'generated.inline.0669_vor_der_aktivierung_muss_die_person_in_genau__0425c1db'
              ),
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

export function buildDraftGroupConnectionRelationships(
  args: GroupConflictGroupConnectionUpsertPreflight
) {
  const connectionId = args.connection_id ?? 'draft';
  return deriveGroupRelationships({
    connections: [
      {
        id: connectionId,
        group_a_id: args.group_a_id,
        group_b_id: args.group_b_id,
        connection_type: args.connection_type,
        parent_group_id: args.parent_group_id,
        child_group_id: args.child_group_id,
        status: 'active',
        created_at: Date.now(),
      },
    ],
    grants: args.grants
      .filter(grant => grant.status !== 'rejected')
      .map(grant => ({
        id: grant.id ?? `${connectionId}:${grant.right_key}:${grant.holder_group_id}`,
        connection_id: connectionId,
        right_key: grant.right_key,
        holder_group_id: grant.holder_group_id,
        scope_group_id: grant.scope_group_id,
        status: 'active',
        initiator_group_id: grant.initiator_group_id ?? null,
        created_at: Date.now(),
      })),
    rules: args.membership_rule
      ? [
          {
            id: `${connectionId}:membership`,
            connection_id: connectionId,
            ...args.membership_rule,
          },
        ]
      : [],
    includeInactive: true,
  });
}

async function buildGroupConnectionUpsertConflicts(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictGroupConnectionUpsertPreflight
): Promise<GroupConflictResponse> {
  const snapshot = await loadGroupGraphSnapshot(tx);
  const inputRelationships = buildDraftGroupConnectionRelationships(args);

  const hierarchyRelationships = inputRelationships.filter(isHierarchyRelationship);
  const activeGroupLinks = [
    ...snapshot.relationships.filter(
      relationship =>
        isHierarchyRelationship(relationship) &&
        isActiveGroupRelationship(relationship) &&
        relationship.connection_id !== (args.connection_id ?? 'draft')
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
              label: translateText('generated.inline.0670_mitgliedschaften_angleichen_138832b6'),
              description: translateText(
                'generated.inline.0671_entferne_oder_deaktiviere_ueberlappende_mitgl_4fe5c235'
              ),
              self_service: await hasGroupPermission(
                tx,
                ctx,
                'groupMemberships',
                pair.parentGroupId
              ),
              group_id: pair.parentGroupId,
            },
            {
              label: translateText('generated.inline.0672_andere_gruppe_kontaktieren_b2abb8ae'),
              description: translateText(
                'generated.inline.0673_falls_du_die_konkurrierende_untergruppe_nicht_3f8b37a2'
              ),
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
              label: translateText(
                'generated.inline.0674_einen_pfad_entfernen_oder_deaktivieren_1a612b63'
              ),
              description: translateText(
                'generated.inline.0675_die_verknuepfung_ist_erst_moeglich_wenn_nur_n_0af11a5e'
              ),
              self_service: await hasGroupPermission(
                tx,
                ctx,
                'groupRelationships',
                duplicatePathConflict.targetGroupId
              ),
              group_id: duplicatePathConflict.targetGroupId,
            },
            {
              label: translateText(
                'generated.inline.0676_zustaendige_gruppe_kontaktieren_5200317b'
              ),
              description: translateText(
                'generated.inline.0677_wenn_du_den_konkurrierenden_pfad_nicht_selbst_a30ea1ef'
              ),
              self_service: false,
              group_id: duplicatePathConflict.targetGroupId,
              required_role: 'Admin',
            },
          ],
        });
      }
    }
  }

  if (args.connection_type === 'peer') {
    const membershipRule = args.membership_rule;
    const directionalRecipients: {
      recipientGroupId: string;
      sourceGroupIds: string[];
    }[] = [];

    if (membershipRule?.membership_mode === 'selected_source_groups') {
      directionalRecipients.push({
        recipientGroupId: membershipRule.member_target_group_id,
        sourceGroupIds: [
          ...new Set((membershipRule.eligible_origin_group_ids ?? []).filter(Boolean)),
        ],
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
            label: translateText('generated.inline.0678_source_gruppen_bereinigen_010e44a9'),
            description: translateText(
              'generated.inline.0679_entferne_ueberschneidende_source_gruppen_oder_4948994c'
            ),
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
    case 'group_connection_upsert':
      return buildGroupConnectionUpsertConflicts(tx, ctx, input);
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

export async function getGroupConnectionUpsertConflictResponse(
  tx: ZeroTransactionLike,
  ctx: ZeroContext,
  args: GroupConflictGroupConnectionUpsertPreflight
) {
  return buildGroupConnectionUpsertConflicts(tx, ctx, args);
}
