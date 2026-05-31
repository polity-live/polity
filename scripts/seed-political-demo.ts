#!/usr/bin/env tsx

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const env = process.env.NODE_ENV ?? 'development';
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), `.env.${env}.local`), override: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEMO_PASSWORD = '123456';
const BASE_TIMESTAMP = Date.parse('2026-01-01T09:00:00.000Z');
const RIGHT_TYPES = [
  'informationRight',
  'amendmentRight',
  'rightToSpeak',
  'activeVotingRight',
  'passiveVotingRight',
] as const;
const NON_HIERARCHY_RIGHTS = RIGHT_TYPES.filter(right => right !== 'passiveVotingRight');

type RightType = (typeof RIGHT_TYPES)[number];
type GroupType = 'base' | 'hierarchical' | 'sibling';
type MembershipSource = 'direct' | 'derived' | 'sibling_elected' | 'sibling_parliament';
type SiblingMembershipMode = 'open' | 'elected' | 'parliament';
type AssigneeKind = 'member' | 'guest';

interface DemoUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  handle: string;
}

interface DemoGroup {
  id: string;
  name: string;
  group_type: GroupType;
  owner_id: string;
  connected_group_id?: string | null;
  sibling_membership_mode?: SiblingMembershipMode | null;
  sibling_role_id?: string | null;
  created_at: string;
}

interface DemoRole {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  default_invite_role: boolean;
  default_request_role: boolean;
  assignee_kind: AssigneeKind;
}

interface DemoMembership {
  id: string;
  group_id: string;
  user_id: string;
  status: 'active';
  visibility: 'public';
  source: MembershipSource;
  source_group_id: string | null;
  created_at: string;
}

interface DemoRelationship {
  id: string;
  group_id: string;
  related_group_id: string;
  relationship_type: 'parent' | 'child' | 'sibling';
  with_right: RightType;
  status: 'active';
  initiator_group_id: string;
  created_at: string;
}

interface DemoGuestAccess {
  id: string;
  group_id: string;
  user_id: string;
  invited_by_id: string;
}

interface DemoConversation {
  id: string;
  type: 'group';
  name: string;
  status: 'accepted';
  pinned: boolean;
  last_message_at: string;
  assistant_for_user_id: null;
  group_id: string;
  event_id: null;
  requested_by_id: string;
  created_at: string;
}

interface DemoConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  left_at: null;
}

interface DemoMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  context_json: string;
  is_read: boolean;
  deleted_at: null;
  created_at: string;
  updated_at: string;
}

function stableUuid(seed: string) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function isoAt(offsetMinutes: number) {
  return new Date(BASE_TIMESTAMP + offsetMinutes * 60_000).toISOString();
}

function membershipId(groupId: string, userId: string) {
  return stableUuid(`membership:${groupId}:${userId}`);
}

function membershipRoleId(groupMembershipId: string, roleId: string) {
  return stableUuid(`membership-role:${groupMembershipId}:${roleId}`);
}

function relationshipId(
  groupId: string,
  relatedGroupId: string,
  right: RightType,
  relationshipType: string
) {
  return stableUuid(`relationship:${groupId}:${relatedGroupId}:${relationshipType}:${right}`);
}

function actionRightId(roleId: string, resource: string, action: string) {
  return stableUuid(`action-right:${roleId}:${resource}:${action}`);
}

function groupConversationId(groupId: string) {
  return stableUuid(`conversation:group:${groupId}`);
}

function conversationParticipantId(conversationId: string, userId: string) {
  return stableUuid(`conversation-participant:${conversationId}:${userId}`);
}

function messageId(conversationId: string, messageKey: string) {
  return stableUuid(`message:${conversationId}:${messageKey}`);
}

async function listAllAuthUsers(client: SupabaseClient) {
  const users: { id: string; email?: string | null }[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    users.push(...data.users.map(user => ({ id: user.id, email: user.email })));

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

async function ensureAuthUsers(users: DemoUser[]) {
  const existingAuthUsers = await listAllAuthUsers(supabase);
  const authUsersById = new Map(existingAuthUsers.map(user => [user.id, user]));
  const authUsersByEmail = new Map(
    existingAuthUsers
      .filter(user => user.email)
      .map(user => [String(user.email).toLowerCase(), user])
  );

  for (const user of users) {
    const existingById = authUsersById.get(user.id);
    const existingByEmail = authUsersByEmail.get(user.email.toLowerCase());
    const existingAuthUser = existingById ?? existingByEmail;

    if (existingAuthUser) {
      const { error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: user.first_name,
          last_name: user.last_name,
          handle: user.handle,
        },
      });

      if (error) {
        throw error;
      }
      continue;
    }

    const { error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: user.first_name,
        last_name: user.last_name,
        handle: user.handle,
      },
    });

    if (error) {
      throw error;
    }
  }
}

async function upsertRows<TRow extends object>(table: string, rows: TRow[]) {
  if (rows.length === 0) {
    return;
  }

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const row of rows) {
    const rowId = (row as { id?: unknown }).id;
    if (typeof rowId !== 'string') {
      continue;
    }

    if (seenIds.has(rowId)) {
      duplicateIds.add(rowId);
    } else {
      seenIds.add(rowId);
    }
  }

  if (duplicateIds.size > 0) {
    throw new Error(
      `Duplicate ids detected for table "${table}": ${Array.from(duplicateIds).join(', ')}`
    );
  }

  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  }
}

function toGroupRow(group: DemoGroup, memberCount = 0) {
  return {
    ...group,
    member_count: memberCount,
    updated_at: group.created_at,
  };
}

function toRoleRow(role: DemoRole, createdAt: string) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    scope: 'group',
    group_id: role.group_id,
    event_id: null,
    amendment_id: null,
    blog_id: null,
    assignment_mode: 'assigned',
    visibility: 'public',
    term_start_date: null,
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_rule: null,
    recurrence_interval: null,
    recurrence_days: null,
    recurrence_end_date: null,
    scheduled_revote_date: null,
    default_request_role: role.default_request_role,
    default_invite_role: role.default_invite_role,
    assignee_kind: role.assignee_kind,
    sort_order: role.sort_order,
    created_at: createdAt,
  };
}

function createDemoUsers() {
  const users: DemoUser[] = [
    {
      id: stableUuid('demo-user:test-user'),
      email: 'test.user@gmail.com',
      first_name: 'Test',
      last_name: 'User',
      handle: 'testuser',
    },
  ];

  for (let index = 2; index <= 200; index += 1) {
    const padded = String(index).padStart(3, '0');
    users.push({
      id: stableUuid(`demo-user:${padded}`),
      email: `demo.user.${padded}@polity-demo.local`,
      first_name: 'Demo',
      last_name: `User ${padded}`,
      handle: `demouser${padded}`,
    });
  }

  return users;
}

function buildPartyData(
  partyName: 'Rot' | 'Grün',
  partyUsers: DemoUser[],
  ownerId: string,
  createdAtOffset: number
) {
  const groups: DemoGroup[] = [];
  const roles: DemoRole[] = [];
  const directMemberships: DemoMembership[] = [];
  const hierarchyRelationships: DemoRelationship[] = [];

  const groupIds = {
    party: stableUuid(`group:${partyName}`),
    local1: stableUuid(`group:${partyName}:local1`),
    local2: stableUuid(`group:${partyName}:local2`),
    local3: stableUuid(`group:${partyName}:local3`),
    local4: stableUuid(`group:${partyName}:local4`),
    regional5: stableUuid(`group:${partyName}:regional5`),
    regional6: stableUuid(`group:${partyName}:regional6`),
    bund7: stableUuid(`group:${partyName}:bund7`),
    bund8: stableUuid(`group:${partyName}:bund8`),
  } as const;

  const orderedGroups = [
    { key: 'party', id: groupIds.party, name: partyName, group_type: 'hierarchical' as const },
    {
      key: 'local1',
      id: groupIds.local1,
      name: `${partyName} lokal 1`,
      group_type: 'base' as const,
    },
    {
      key: 'local2',
      id: groupIds.local2,
      name: `${partyName} lokal 2`,
      group_type: 'base' as const,
    },
    {
      key: 'local3',
      id: groupIds.local3,
      name: `${partyName} lokal 3`,
      group_type: 'base' as const,
    },
    {
      key: 'local4',
      id: groupIds.local4,
      name: `${partyName} lokal 4`,
      group_type: 'base' as const,
    },
    {
      key: 'regional5',
      id: groupIds.regional5,
      name: `${partyName} regional 5`,
      group_type: 'hierarchical' as const,
    },
    {
      key: 'regional6',
      id: groupIds.regional6,
      name: `${partyName} regional 6`,
      group_type: 'hierarchical' as const,
    },
    {
      key: 'bund7',
      id: groupIds.bund7,
      name: `${partyName} bund 7`,
      group_type: 'hierarchical' as const,
    },
    {
      key: 'bund8',
      id: groupIds.bund8,
      name: `${partyName} bund 8`,
      group_type: 'hierarchical' as const,
    },
  ];

  orderedGroups.forEach((group, index) => {
    groups.push({
      id: group.id,
      name: group.name,
      group_type: group.group_type,
      owner_id: ownerId,
      created_at: isoAt(createdAtOffset + index),
    });

    roles.push(
      {
        id: stableUuid(`role:${group.id}:member`),
        group_id: group.id,
        name: 'Member',
        description: `${group.name} member role`,
        sort_order: 0,
        default_invite_role: true,
        default_request_role: true,
        assignee_kind: 'member',
      },
      {
        id: stableUuid(`role:${group.id}:board`),
        group_id: group.id,
        name: 'Vorstandsmitglied',
        description: `Vorstandsrolle fuer ${group.name}`,
        sort_order: 10,
        default_invite_role: false,
        default_request_role: false,
        assignee_kind: 'member',
      }
    );
  });

  const baseAssignments = [
    { groupId: groupIds.local1, users: partyUsers.slice(0, 10) },
    { groupId: groupIds.local2, users: partyUsers.slice(10, 30) },
    { groupId: groupIds.local3, users: partyUsers.slice(30, 60) },
    { groupId: groupIds.local4, users: partyUsers.slice(60, 100) },
  ];

  baseAssignments.forEach((assignment, index) => {
    assignment.users.forEach((user, memberIndex) => {
      directMemberships.push({
        id: membershipId(assignment.groupId, user.id),
        group_id: assignment.groupId,
        user_id: user.id,
        status: 'active',
        visibility: 'public',
        source: 'direct',
        source_group_id: null,
        created_at: isoAt(createdAtOffset + 30 + index * 20 + memberIndex),
      });
    });
  });

  const hierarchyPairs: { parent: string; child: string }[] = [
    { parent: groupIds.regional5, child: groupIds.local1 },
    { parent: groupIds.regional5, child: groupIds.local2 },
    { parent: groupIds.regional6, child: groupIds.local3 },
    { parent: groupIds.regional6, child: groupIds.local4 },
    { parent: groupIds.bund7, child: groupIds.regional5 },
    { parent: groupIds.bund7, child: groupIds.regional6 },
    { parent: groupIds.bund8, child: groupIds.regional5 },
    { parent: groupIds.bund8, child: groupIds.regional6 },
    { parent: groupIds.party, child: groupIds.bund7 },
    { parent: groupIds.party, child: groupIds.bund8 },
  ];

  hierarchyPairs.forEach((pair, index) => {
    hierarchyRelationships.push({
      id: relationshipId(pair.parent, pair.child, 'passiveVotingRight', 'child'),
      group_id: pair.parent,
      related_group_id: pair.child,
      relationship_type: 'child',
      with_right: 'passiveVotingRight',
      status: 'active',
      initiator_group_id: pair.parent,
      created_at: isoAt(createdAtOffset + 200 + index),
    });

    NON_HIERARCHY_RIGHTS.forEach((right, rightIndex) => {
      hierarchyRelationships.push(
        {
          id: relationshipId(pair.parent, pair.child, right, 'child'),
          group_id: pair.parent,
          related_group_id: pair.child,
          relationship_type: 'child',
          with_right: right,
          status: 'active',
          initiator_group_id: pair.parent,
          created_at: isoAt(createdAtOffset + 230 + index * 10 + rightIndex),
        },
        {
          id: relationshipId(pair.child, pair.parent, right, 'parent'),
          group_id: pair.child,
          related_group_id: pair.parent,
          relationship_type: 'parent',
          with_right: right,
          status: 'active',
          initiator_group_id: pair.parent,
          created_at: isoAt(createdAtOffset + 260 + index * 10 + rightIndex),
        }
      );
    });
  });

  return { groupIds, groups, roles, directMemberships, hierarchyRelationships };
}

function getHierarchyChildren(hierarchyRelationships: DemoRelationship[]) {
  const map = new Map<string, string[]>();

  hierarchyRelationships
    .filter(relationship => relationship.with_right === 'passiveVotingRight')
    .forEach(relationship => {
      const children = map.get(relationship.group_id) ?? [];
      children.push(relationship.related_group_id);
      map.set(relationship.group_id, children);
    });

  return map;
}

function deriveHierarchyMemberships(
  hierarchyGroupIds: string[],
  directMemberships: DemoMembership[],
  hierarchyRelationships: DemoRelationship[]
) {
  const childrenMap = getHierarchyChildren(hierarchyRelationships);
  const directByGroup = new Map<string, { userId: string; sourceGroupId: string }[]>();

  directMemberships.forEach(membership => {
    const members = directByGroup.get(membership.group_id) ?? [];
    members.push({
      userId: membership.user_id,
      sourceGroupId: membership.group_id,
    });
    directByGroup.set(membership.group_id, members);
  });

  const memo = new Map<string, Map<string, string>>();
  const visit = (groupId: string): Map<string, string> => {
    const cached = memo.get(groupId);
    if (cached) {
      return cached;
    }

    const members = new Map<string, string>();
    for (const directMember of directByGroup.get(groupId) ?? []) {
      members.set(directMember.userId, directMember.sourceGroupId);
    }

    for (const childGroupId of childrenMap.get(groupId) ?? []) {
      const childMembers = visit(childGroupId);
      childMembers.forEach((sourceGroupId, userId) => {
        if (!members.has(userId)) {
          members.set(userId, sourceGroupId);
        }
      });
    }

    memo.set(groupId, members);
    return members;
  };

  const derivedMemberships: DemoMembership[] = [];
  hierarchyGroupIds.forEach((groupId, index) => {
    const members = visit(groupId);
    members.forEach((sourceGroupId, userId) => {
      if (directByGroup.get(groupId)?.some(member => member.userId === userId)) {
        return;
      }

      derivedMemberships.push({
        id: membershipId(groupId, userId),
        group_id: groupId,
        user_id: userId,
        status: 'active',
        visibility: 'public',
        source: 'derived',
        source_group_id: sourceGroupId,
        created_at: isoAt(600 + index),
      });
    });
  });

  return derivedMemberships;
}

function buildSiblingGroups(
  baseAndHierarchyGroups: DemoGroup[],
  rolesByGroup: Map<string, { memberRoleId: string; boardRoleId?: string | null }>
) {
  const siblingGroups: DemoGroup[] = [];
  const siblingRoles: DemoRole[] = [];
  const siblingRelationships: DemoRelationship[] = [];

  baseAndHierarchyGroups.forEach((group, index) => {
    const connectedRoles = rolesByGroup.get(group.id);
    if (!connectedRoles?.boardRoleId) {
      return;
    }

    const siblingDefinitions = [
      {
        id: stableUuid(`group:${group.id}:vorstand`),
        name: `${group.name} Vorstand`,
        mode: 'elected' as const,
        siblingRoleId: connectedRoles.boardRoleId,
      },
      {
        id: stableUuid(`group:${group.id}:fraktion`),
        name: `${group.name} Fraktion`,
        mode: 'elected' as const,
        siblingRoleId: connectedRoles.boardRoleId,
      },
      {
        id: stableUuid(`group:${group.id}:arbeitskreis-bildung`),
        name: `${group.name} Arbeitskreis Bildung`,
        mode: 'open' as const,
        siblingRoleId: null,
      },
    ];

    siblingDefinitions.forEach((definition, siblingIndex) => {
      siblingGroups.push({
        id: definition.id,
        name: definition.name,
        group_type: 'sibling',
        owner_id: group.owner_id,
        connected_group_id: group.id,
        sibling_membership_mode: definition.mode,
        sibling_role_id: definition.siblingRoleId,
        created_at: isoAt(900 + index * 10 + siblingIndex),
      });

      siblingRoles.push({
        id: stableUuid(`role:${definition.id}:member`),
        group_id: definition.id,
        name: 'Member',
        description: `${definition.name} member role`,
        sort_order: 0,
        default_invite_role: definition.mode === 'open',
        default_request_role: definition.mode === 'open',
        assignee_kind: 'member',
      });

      RIGHT_TYPES.forEach((right, rightIndex) => {
        siblingRelationships.push(
          {
            id: relationshipId(definition.id, group.id, right, 'sibling'),
            group_id: definition.id,
            related_group_id: group.id,
            relationship_type: 'sibling',
            with_right: right,
            status: 'active',
            initiator_group_id: group.id,
            created_at: isoAt(1000 + index * 20 + rightIndex),
          },
          {
            id: relationshipId(group.id, definition.id, right, 'sibling'),
            group_id: group.id,
            related_group_id: definition.id,
            relationship_type: 'sibling',
            with_right: right,
            status: 'active',
            initiator_group_id: group.id,
            created_at: isoAt(1100 + index * 20 + rightIndex),
          }
        );
      });
    });
  });

  return { siblingGroups, siblingRoles, siblingRelationships };
}

function collectMembersByGroup(memberships: DemoMembership[]) {
  const map = new Map<string, DemoMembership[]>();
  memberships.forEach(membership => {
    const rows = map.get(membership.group_id) ?? [];
    rows.push(membership);
    map.set(membership.group_id, rows);
  });
  return map;
}

function sortMembershipsByUser(memberships: DemoMembership[]) {
  return [...memberships].sort((left, right) => left.user_id.localeCompare(right.user_id));
}

function buildGroupChats(
  groups: DemoGroup[],
  memberships: DemoMembership[],
  guestAccesses: DemoGuestAccess[]
) {
  const membershipsByGroup = collectMembersByGroup(memberships);
  const guestAccessesByGroup = new Map<string, DemoGuestAccess[]>();

  guestAccesses.forEach(guestAccess => {
    const rows = guestAccessesByGroup.get(guestAccess.group_id) ?? [];
    rows.push(guestAccess);
    guestAccessesByGroup.set(guestAccess.group_id, rows);
  });

  const conversations: DemoConversation[] = [];
  const participants: DemoConversationParticipant[] = [];
  const messages: DemoMessage[] = [];

  groups.forEach((group, index) => {
    const participantUserIds = new Set<string>();

    for (const membership of membershipsByGroup.get(group.id) ?? []) {
      if (membership.status === 'active') {
        participantUserIds.add(membership.user_id);
      }
    }

    for (const guestAccess of guestAccessesByGroup.get(group.id) ?? []) {
      participantUserIds.add(guestAccess.user_id);
    }

    if (participantUserIds.size === 0) {
      return;
    }

    const conversationId = groupConversationId(group.id);
    const orderedParticipantIds = Array.from(participantUserIds).sort();
    const createdAt = isoAt(3500 + index * 10);
    const welcomeMessageAt = isoAt(3501 + index * 10);
    const senderId = orderedParticipantIds[0] ?? group.owner_id;

    conversations.push({
      id: conversationId,
      type: 'group',
      name: group.name,
      status: 'accepted',
      pinned: false,
      last_message_at: welcomeMessageAt,
      assistant_for_user_id: null,
      group_id: group.id,
      event_id: null,
      requested_by_id: group.owner_id,
      created_at: createdAt,
    });

    orderedParticipantIds.forEach(userId => {
      participants.push({
        id: conversationParticipantId(conversationId, userId),
        conversation_id: conversationId,
        user_id: userId,
        joined_at: createdAt,
        last_read_at: welcomeMessageAt,
        left_at: null,
      });
    });

    messages.push({
      id: messageId(conversationId, 'welcome'),
      conversation_id: conversationId,
      sender_id: senderId,
      content: `Willkommen im Gruppenchat von ${group.name}.`,
      context_json: '[]',
      is_read: true,
      deleted_at: null,
      created_at: welcomeMessageAt,
      updated_at: welcomeMessageAt,
    });
  });

  return { conversations, participants, messages };
}

function createRoleAssignments(
  groups: DemoGroup[],
  membershipsByGroup: Map<string, DemoMembership[]>,
  rolesByGroup: Map<string, { memberRoleId: string; boardRoleId?: string | null }>
) {
  const membershipRoles: {
    id: string;
    group_membership_id: string;
    role_id: string;
    assigned_by_id: string | null;
    created_at: string;
  }[] = [];

  groups.forEach((group, index) => {
    const roleIds = rolesByGroup.get(group.id);
    if (!roleIds) {
      return;
    }

    const memberships = sortMembershipsByUser(membershipsByGroup.get(group.id) ?? []);
    memberships.forEach(membership => {
      membershipRoles.push({
        id: membershipRoleId(membership.id, roleIds.memberRoleId),
        group_membership_id: membership.id,
        role_id: roleIds.memberRoleId,
        assigned_by_id: group.owner_id,
        created_at: isoAt(1300 + index),
      });
    });

    if (!roleIds.boardRoleId) {
      return;
    }

    memberships.slice(0, Math.min(2, memberships.length)).forEach(membership => {
      membershipRoles.push({
        id: membershipRoleId(membership.id, roleIds.boardRoleId as string),
        group_membership_id: membership.id,
        role_id: roleIds.boardRoleId as string,
        assigned_by_id: group.owner_id,
        created_at: isoAt(1400 + index),
      });
    });
  });

  return membershipRoles;
}

async function main() {
  console.log('Creating deterministic political demo seed...');

  const users = createDemoUsers();
  await ensureAuthUsers(users);

  await upsertRows(
    'user',
    users.map((user, index) => ({
      id: user.id,
      email: user.email,
      handle: user.handle,
      first_name: user.first_name,
      last_name: user.last_name,
      bio:
        user.email === 'test.user@gmail.com'
          ? 'Deterministic demo account for political party scenarios.'
          : `Demo user ${index + 1} for deterministic political test data.`,
      visibility: 'public',
      created_at: isoAt(index),
      updated_at: isoAt(index),
    }))
  );

  const ownerId = users[0].id;
  const rotPartyUsers = users.slice(0, 100);
  const gruenPartyUsers = users.slice(100, 200);

  const rotData = buildPartyData('Rot', rotPartyUsers, ownerId, 50);
  const gruenData = buildPartyData('Grün', gruenPartyUsers, ownerId, 350);

  const baseAndHierarchyGroups = [
    ...rotData.groups,
    ...gruenData.groups,
    {
      id: stableUuid('group:rosbach:bevoelkerung'),
      name: 'Rosbach Bevölkerung',
      group_type: 'base' as const,
      owner_id: ownerId,
      created_at: isoAt(1600),
    },
    {
      id: stableUuid('group:rosbach:verwaltung'),
      name: 'Rosbach Verwaltung',
      group_type: 'base' as const,
      owner_id: ownerId,
      created_at: isoAt(1601),
    },
  ];

  const baseAndHierarchyRoles: DemoRole[] = [
    ...rotData.roles,
    ...gruenData.roles,
    {
      id: stableUuid('role:rosbach:bevoelkerung:member'),
      group_id: stableUuid('group:rosbach:bevoelkerung'),
      name: 'Member',
      description: 'Rosbach Bevölkerung member role',
      sort_order: 0,
      default_invite_role: true,
      default_request_role: true,
      assignee_kind: 'member',
    },
    {
      id: stableUuid('role:rosbach:bevoelkerung:ausschuss'),
      group_id: stableUuid('group:rosbach:bevoelkerung'),
      name: 'Ausschussmitglied Bildung',
      description: 'Bildungsausschuss role on Rosbach Bevölkerung',
      sort_order: 10,
      default_invite_role: false,
      default_request_role: false,
      assignee_kind: 'member',
    },
    {
      id: stableUuid('role:rosbach:verwaltung:member'),
      group_id: stableUuid('group:rosbach:verwaltung'),
      name: 'Member',
      description: 'Rosbach Verwaltung member role',
      sort_order: 0,
      default_invite_role: true,
      default_request_role: true,
      assignee_kind: 'member',
    },
  ];

  const rolesByGroup = new Map<string, { memberRoleId: string; boardRoleId?: string | null }>();
  [...rotData.groups, ...gruenData.groups].forEach(group => {
    rolesByGroup.set(group.id, {
      memberRoleId: stableUuid(`role:${group.id}:member`),
      boardRoleId: stableUuid(`role:${group.id}:board`),
    });
  });
  rolesByGroup.set(stableUuid('group:rosbach:bevoelkerung'), {
    memberRoleId: stableUuid('role:rosbach:bevoelkerung:member'),
  });
  rolesByGroup.set(stableUuid('group:rosbach:verwaltung'), {
    memberRoleId: stableUuid('role:rosbach:verwaltung:member'),
  });

  const directMemberships: DemoMembership[] = [
    ...rotData.directMemberships,
    ...gruenData.directMemberships,
    ...users.map((user, index) => ({
      id: membershipId(stableUuid('group:rosbach:bevoelkerung'), user.id),
      group_id: stableUuid('group:rosbach:bevoelkerung'),
      user_id: user.id,
      status: 'active' as const,
      visibility: 'public' as const,
      source: 'direct' as const,
      source_group_id: null,
      created_at: isoAt(1700 + index),
    })),
    ...users.slice(0, 20).map((user, index) => ({
      id: membershipId(stableUuid('group:rosbach:verwaltung'), user.id),
      group_id: stableUuid('group:rosbach:verwaltung'),
      user_id: user.id,
      status: 'active' as const,
      visibility: 'public' as const,
      source: 'direct' as const,
      source_group_id: null,
      created_at: isoAt(1900 + index),
    })),
  ];

  const hierarchyRelationships = [
    ...rotData.hierarchyRelationships,
    ...gruenData.hierarchyRelationships,
  ];
  const hierarchyGroupIds = baseAndHierarchyGroups
    .filter(group => group.group_type === 'hierarchical')
    .map(group => group.id);
  const hierarchyMemberships = deriveHierarchyMemberships(
    hierarchyGroupIds,
    directMemberships,
    hierarchyRelationships
  );

  const { siblingGroups, siblingRoles, siblingRelationships } = buildSiblingGroups(
    [...rotData.groups, ...gruenData.groups],
    new Map(
      [...rotData.groups, ...gruenData.groups].map(group => [
        group.id,
        {
          memberRoleId:
            rolesByGroup.get(group.id)?.memberRoleId ?? stableUuid(`role:${group.id}:member`),
          boardRoleId: rolesByGroup.get(group.id)?.boardRoleId ?? null,
        },
      ])
    )
  );

  const rotLocal3FactionId = stableUuid(`group:${rotData.groupIds.local3}:fraktion`);
  const gruenLocal3FactionId = stableUuid(`group:${gruenData.groupIds.local3}:fraktion`);
  const rosbachBevoelkerungId = stableUuid('group:rosbach:bevoelkerung');
  const parlamentRosbachId = stableUuid('group:rosbach:parlament');
  const bildungsausschussRosbachId = stableUuid('group:rosbach:bildungsausschuss');

  const kommuneSiblingGroups: DemoGroup[] = [
    {
      id: parlamentRosbachId,
      name: 'Parlament Rosbach',
      group_type: 'sibling',
      owner_id: ownerId,
      connected_group_id: rosbachBevoelkerungId,
      sibling_membership_mode: 'parliament',
      sibling_role_id: null,
      created_at: isoAt(2100),
    },
    {
      id: bildungsausschussRosbachId,
      name: 'Bildungsausschuss Rosbach',
      group_type: 'sibling',
      owner_id: ownerId,
      connected_group_id: rosbachBevoelkerungId,
      sibling_membership_mode: 'elected',
      sibling_role_id: stableUuid('role:rosbach:bevoelkerung:ausschuss'),
      created_at: isoAt(2101),
    },
  ];

  const kommuneSiblingRoles: DemoRole[] = [
    {
      id: stableUuid('role:rosbach:parlament:member'),
      group_id: parlamentRosbachId,
      name: 'Member',
      description: 'Parlament Rosbach member role',
      sort_order: 0,
      default_invite_role: false,
      default_request_role: false,
      assignee_kind: 'member',
    },
    {
      id: stableUuid('role:rosbach:parlament:guest'),
      group_id: parlamentRosbachId,
      name: 'Gastdelegierte Verwaltung',
      description: 'Gastrolle fuer Verwaltungsdelegierte im Parlament Rosbach',
      sort_order: 20,
      default_invite_role: false,
      default_request_role: false,
      assignee_kind: 'guest',
    },
    {
      id: stableUuid('role:rosbach:bildungsausschuss:member'),
      group_id: bildungsausschussRosbachId,
      name: 'Member',
      description: 'Bildungsausschuss Rosbach member role',
      sort_order: 0,
      default_invite_role: false,
      default_request_role: false,
      assignee_kind: 'member',
    },
  ];

  const kommuneSiblingRelationships: DemoRelationship[] = [];
  [parlamentRosbachId, bildungsausschussRosbachId].forEach((groupId, index) => {
    RIGHT_TYPES.forEach((right, rightIndex) => {
      kommuneSiblingRelationships.push(
        {
          id: relationshipId(groupId, rosbachBevoelkerungId, right, 'sibling'),
          group_id: groupId,
          related_group_id: rosbachBevoelkerungId,
          relationship_type: 'sibling',
          with_right: right,
          status: 'active',
          initiator_group_id: groupId,
          created_at: isoAt(2200 + index * 20 + rightIndex),
        },
        {
          id: relationshipId(rosbachBevoelkerungId, groupId, right, 'sibling'),
          group_id: rosbachBevoelkerungId,
          related_group_id: groupId,
          relationship_type: 'sibling',
          with_right: right,
          status: 'active',
          initiator_group_id: groupId,
          created_at: isoAt(2250 + index * 20 + rightIndex),
        }
      );
    });
  });

  RIGHT_TYPES.forEach((right, index) => {
    kommuneSiblingRelationships.push(
      {
        id: relationshipId(rotLocal3FactionId, parlamentRosbachId, right, 'sibling'),
        group_id: rotLocal3FactionId,
        related_group_id: parlamentRosbachId,
        relationship_type: 'sibling',
        with_right: right,
        status: 'active',
        initiator_group_id: parlamentRosbachId,
        created_at: isoAt(2300 + index),
      },
      {
        id: relationshipId(parlamentRosbachId, rotLocal3FactionId, right, 'sibling'),
        group_id: parlamentRosbachId,
        related_group_id: rotLocal3FactionId,
        relationship_type: 'sibling',
        with_right: right,
        status: 'active',
        initiator_group_id: parlamentRosbachId,
        created_at: isoAt(2310 + index),
      }
    );
  });

  const siblingSources = [
    {
      id: stableUuid(`sibling-source:${parlamentRosbachId}:${rotLocal3FactionId}`),
      group_id: parlamentRosbachId,
      source_group_id: rotLocal3FactionId,
      created_at: isoAt(2400),
    },
    {
      id: stableUuid(`sibling-source:${parlamentRosbachId}:${gruenLocal3FactionId}`),
      group_id: parlamentRosbachId,
      source_group_id: gruenLocal3FactionId,
      created_at: isoAt(2401),
    },
  ];

  const allGroups = [...baseAndHierarchyGroups, ...siblingGroups, ...kommuneSiblingGroups];
  const allRoles = [...baseAndHierarchyRoles, ...siblingRoles, ...kommuneSiblingRoles];

  const membershipsByGroupBeforeSiblings = collectMembersByGroup([
    ...directMemberships,
    ...hierarchyMemberships,
  ]);
  const membershipRoleLinks = createRoleAssignments(
    baseAndHierarchyGroups,
    membershipsByGroupBeforeSiblings,
    rolesByGroup
  );

  const boardMembersByGroup = new Map<string, string[]>();
  membershipRoleLinks.forEach(link => {
    const membership = [...directMemberships, ...hierarchyMemberships].find(
      currentMembership => currentMembership.id === link.group_membership_id
    );
    if (!membership) {
      return;
    }

    const groupRoles = rolesByGroup.get(membership.group_id);
    if (!groupRoles?.boardRoleId || link.role_id !== groupRoles.boardRoleId) {
      return;
    }

    const usersForGroup = boardMembersByGroup.get(membership.group_id) ?? [];
    usersForGroup.push(membership.user_id);
    boardMembersByGroup.set(membership.group_id, usersForGroup);
  });

  const siblingMemberships: DemoMembership[] = [];
  const siblingMemberRoleLinks: {
    id: string;
    group_membership_id: string;
    role_id: string;
    assigned_by_id: string | null;
    created_at: string;
  }[] = [];
  const memberRoleBySiblingGroup = new Map<string, string>(
    [...siblingRoles, ...kommuneSiblingRoles]
      .filter(role => role.name === 'Member' && role.assignee_kind === 'member')
      .map(role => [role.group_id, role.id])
  );

  const activeOfficialMemberships = [...directMemberships, ...hierarchyMemberships];
  const activeMembershipsByGroup = collectMembersByGroup(activeOfficialMemberships);

  siblingGroups.forEach((siblingGroup, index) => {
    const memberRoleId = memberRoleBySiblingGroup.get(siblingGroup.id);
    if (!memberRoleId || !siblingGroup.connected_group_id) {
      return;
    }

    const connectedMemberships = sortMembershipsByUser(
      activeMembershipsByGroup.get(siblingGroup.connected_group_id) ?? []
    );

    let selectedUsers: string[] = [];
    let source: MembershipSource = 'direct';
    let sourceGroupId: string | null = null;

    if (siblingGroup.sibling_membership_mode === 'open') {
      selectedUsers = connectedMemberships.slice(0, 3).map(membership => membership.user_id);
      source = 'direct';
    } else {
      selectedUsers = boardMembersByGroup.get(siblingGroup.connected_group_id) ?? [];
      source = 'sibling_elected';
      sourceGroupId = siblingGroup.connected_group_id;
    }

    selectedUsers.forEach((userId, userIndex) => {
      const membership = {
        id: membershipId(siblingGroup.id, userId),
        group_id: siblingGroup.id,
        user_id: userId,
        status: 'active' as const,
        visibility: 'public' as const,
        source,
        source_group_id: sourceGroupId,
        created_at: isoAt(2500 + index * 20 + userIndex),
      };
      siblingMemberships.push(membership);
      siblingMemberRoleLinks.push({
        id: membershipRoleId(membership.id, memberRoleId),
        group_membership_id: membership.id,
        role_id: memberRoleId,
        assigned_by_id: ownerId,
        created_at: isoAt(2700 + index),
      });
    });
  });

  const ausschussRoleId = stableUuid('role:rosbach:bevoelkerung:ausschuss');
  const populationMemberships = sortMembershipsByUser(
    activeMembershipsByGroup.get(rosbachBevoelkerungId) ?? []
  );
  const ausschussPopulationAssignments = populationMemberships.slice(0, 6);
  ausschussPopulationAssignments.forEach((membership, index) => {
    membershipRoleLinks.push({
      id: membershipRoleId(membership.id, ausschussRoleId),
      group_membership_id: membership.id,
      role_id: ausschussRoleId,
      assigned_by_id: ownerId,
      created_at: isoAt(2800 + index),
    });
  });

  const siblingMembershipsByGroup = collectMembersByGroup(siblingMemberships);
  const parliamentSourceUsers = new Map<string, string>();
  [rotLocal3FactionId, gruenLocal3FactionId].forEach(sourceGroupId => {
    for (const membership of siblingMembershipsByGroup.get(sourceGroupId) ?? []) {
      if (!parliamentSourceUsers.has(membership.user_id)) {
        parliamentSourceUsers.set(membership.user_id, sourceGroupId);
      }
    }
  });

  const parliamentMemberships: DemoMembership[] = [];
  Array.from(parliamentSourceUsers.entries())
    .filter(([userId]) => populationMemberships.some(membership => membership.user_id === userId))
    .forEach(([userId, sourceGroupId], index) => {
      parliamentMemberships.push({
        id: membershipId(parlamentRosbachId, userId),
        group_id: parlamentRosbachId,
        user_id: userId,
        status: 'active',
        visibility: 'public',
        source: 'sibling_parliament',
        source_group_id: sourceGroupId,
        created_at: isoAt(2900 + index),
      });
    });

  const committeeMemberships: DemoMembership[] = ausschussPopulationAssignments.map(
    (membership, index) => ({
      id: membershipId(bildungsausschussRosbachId, membership.user_id),
      group_id: bildungsausschussRosbachId,
      user_id: membership.user_id,
      status: 'active',
      visibility: 'public',
      source: 'sibling_elected',
      source_group_id: rosbachBevoelkerungId,
      created_at: isoAt(2950 + index),
    })
  );

  [...parliamentMemberships, ...committeeMemberships].forEach((membership, index) => {
    const memberRoleId = memberRoleBySiblingGroup.get(membership.group_id);
    if (!memberRoleId) {
      return;
    }

    siblingMemberRoleLinks.push({
      id: membershipRoleId(membership.id, memberRoleId),
      group_membership_id: membership.id,
      role_id: memberRoleId,
      assigned_by_id: ownerId,
      created_at: isoAt(3000 + index),
    });
  });

  const guestAccesses: DemoGuestAccess[] = [
    {
      id: stableUuid(`guest-access:${parlamentRosbachId}:${users[0].id}`),
      group_id: parlamentRosbachId,
      user_id: users[0].id,
      invited_by_id: ownerId,
    },
  ];
  const guestRoleLinks = guestAccesses.map((guestAccess, index) => ({
    id: stableUuid(`guest-role:${guestAccess.id}:${stableUuid('role:rosbach:parlament:guest')}`),
    group_guest_access_id: guestAccess.id,
    role_id: stableUuid('role:rosbach:parlament:guest'),
    assigned_by_id: ownerId,
    created_at: isoAt(3100 + index),
  }));

  const actionRights = [
    ...allRoles.flatMap(role => {
      if (role.assignee_kind === 'guest') {
        return [
          {
            id: actionRightId(role.id, 'groups', 'view'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'groups',
            action: 'view',
            created_at: isoAt(3200),
          },
          {
            id: actionRightId(role.id, 'events', 'manage'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'events',
            action: 'manage',
            created_at: isoAt(3201),
          },
        ];
      }

      if (role.name === 'Vorstandsmitglied') {
        return [
          {
            id: actionRightId(role.id, 'groups', 'manage'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'groups',
            action: 'manage',
            created_at: isoAt(3210),
          },
          {
            id: actionRightId(role.id, 'groupRelationships', 'manage'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'groupRelationships',
            action: 'manage',
            created_at: isoAt(3211),
          },
        ];
      }

      if (role.name === 'Member') {
        return [
          {
            id: actionRightId(role.id, 'groups', 'view'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'groups',
            action: 'view',
            created_at: isoAt(3220),
          },
          {
            id: actionRightId(role.id, 'messages', 'manage'),
            role_id: role.id,
            group_id: role.group_id,
            resource: 'messages',
            action: 'manage',
            created_at: isoAt(3221),
          },
        ];
      }

      return [];
    }),
  ];

  const allMemberships = [
    ...directMemberships,
    ...hierarchyMemberships,
    ...siblingMemberships,
    ...parliamentMemberships,
    ...committeeMemberships,
  ];
  const groupChats = buildGroupChats(allGroups, allMemberships, guestAccesses);
  const membershipsByGroup = collectMembersByGroup(allMemberships);
  const groupRowsWithCounts = allGroups.map(group => ({
    ...group,
    member_count: (membershipsByGroup.get(group.id) ?? []).length,
    updated_at: group.created_at,
  }));

  const userGroupCounts = new Map<string, number>();
  allMemberships.forEach(membership => {
    userGroupCounts.set(membership.user_id, (userGroupCounts.get(membership.user_id) ?? 0) + 1);
  });

  const userRowsWithCounts = users.map((user, index) => ({
    id: user.id,
    email: user.email,
    handle: user.handle,
    first_name: user.first_name,
    last_name: user.last_name,
    bio:
      user.email === 'test.user@gmail.com'
        ? 'Deterministic demo account for political party scenarios.'
        : `Demo user ${index + 1} for deterministic political test data.`,
    visibility: 'public',
    group_count: userGroupCounts.get(user.id) ?? 0,
    created_at: isoAt(index),
    updated_at: isoAt(index),
  }));

  const allSiblingGroups = [...siblingGroups, ...kommuneSiblingGroups];
  const allSiblingRoles = [...siblingRoles, ...kommuneSiblingRoles];

  await upsertRows('user', userRowsWithCounts);
  await upsertRows(
    'group',
    baseAndHierarchyGroups.map(group => toGroupRow(group))
  );
  await upsertRows(
    'role',
    baseAndHierarchyRoles.map((role, index) => toRoleRow(role, isoAt(3300 + index)))
  );
  await upsertRows(
    'group',
    allSiblingGroups.map(group => toGroupRow(group))
  );
  await upsertRows(
    'role',
    allSiblingRoles.map((role, index) =>
      toRoleRow(role, isoAt(3400 + baseAndHierarchyRoles.length + index))
    )
  );
  await upsertRows(
    'group',
    groupRowsWithCounts.map(group => toGroupRow(group, group.member_count))
  );
  await upsertRows('action_right', actionRights);
  await upsertRows('group_relationship', [
    ...hierarchyRelationships,
    ...siblingRelationships,
    ...kommuneSiblingRelationships,
  ]);
  await upsertRows('group_sibling_source', siblingSources);
  await upsertRows('group_membership', allMemberships);
  await upsertRows('group_membership_role', [...membershipRoleLinks, ...siblingMemberRoleLinks]);
  await upsertRows(
    'group_guest_access',
    guestAccesses.map((guestAccess, index) => ({
      id: guestAccess.id,
      group_id: guestAccess.group_id,
      user_id: guestAccess.user_id,
      status: 'active',
      invited_by_id: guestAccess.invited_by_id,
      created_at: isoAt(3400 + index),
      updated_at: isoAt(3400 + index),
    }))
  );
  await upsertRows('group_guest_role', guestRoleLinks);
  await upsertRows('conversation', groupChats.conversations);
  await upsertRows('conversation_participant', groupChats.participants);
  await upsertRows('message', groupChats.messages);
  await upsertRows('user', userRowsWithCounts);

  console.log(`Users ensured: ${users.length}`);
  console.log(`Groups ensured: ${allGroups.length}`);
  console.log(`Roles ensured: ${allRoles.length}`);
  console.log(`Memberships ensured: ${allMemberships.length}`);
  console.log(`Group chats ensured: ${groupChats.conversations.length}`);
  console.log(`Conversation participants ensured: ${groupChats.participants.length}`);
  console.log(`Messages ensured: ${groupChats.messages.length}`);
  console.log(
    `Relationships ensured: ${hierarchyRelationships.length + siblingRelationships.length + kommuneSiblingRelationships.length}`
  );
  console.log(`Guest accesses ensured: ${guestAccesses.length}`);
  console.log('Demo login: test.user@gmail.com / 123456');
}

main().catch(error => {
  console.error('Political demo seed failed:', error);
  process.exit(1);
});
