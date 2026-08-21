/**
 * Server-side Permission Check for Zero Mutators
 *
 * Use `can()` inside mutator handlers to enforce permissions.
 * On the server, it queries the DB for roles/action_rights and throws PermissionError on failure.
 * On the client (optimistic), it skips checks (the authoritative server run is what matters).
 *
 * @example
 * ```ts
 * // In a mutator:
 * delete: defineMutator(schema, async ({ tx, ctx, args }) => {
 *   await can(tx, ctx, { action: 'manage', resource: 'groups', groupId: args.groupId })
 *   await tx.mutate.group.delete({ id: args.id })
 * })
 * ```
 */

import { createBuilder, type Transaction } from '@rocicorp/zero';
import { schema, type Schema, type ActionRight as ActionRightRow } from '../schema';
import { checkPermission, type PermissionData } from './check';
import { PermissionError } from './errors';
import type { ResourceType, ActionType, Membership, GuestAccess, ActionRight, Role } from './types';

// Build zql inside this module to avoid circular imports with schema.ts
const zql = createBuilder(schema);
const ACTIVE_EVENT_PARTICIPANT_STATUSES = ['active', 'confirmed', 'member', 'admin'];
const DISCOVERY_EVENT_PARTICIPANT_STATUSES = ['invited', ...ACTIVE_EVENT_PARTICIPANT_STATUSES];
const ACTIVE_AMENDMENT_COLLABORATOR_STATUSES = ['active', 'collaborator', 'member', 'admin'];
const DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES = [
  'invited',
  ...ACTIVE_AMENDMENT_COLLABORATOR_STATUSES,
];
const ACTIVE_BLOGGER_STATUSES = ['owner', 'admin', 'member', 'writer'];
const DISCOVERY_BLOGGER_STATUSES = ['owner', 'invited', 'admin', 'member', 'writer'];

interface PermissionRoleLinkLike {
  role?: {
    id: string;
    name?: string | null;
    description?: string | null;
    scope?: string | null;
    group_id?: string | null;
    event_id?: string | null;
    amendment_id?: string | null;
    blog_id?: string | null;
    action_rights?: readonly ActionRightRow[];
  } | null;
}

// ============================================================================
// Types
// ============================================================================

/** What permission to check. */
export interface PermissionCheck {
  action: ActionType;
  resource: ResourceType;
  groupId?: string | null;
  eventId?: string | null;
  blogId?: string | null;
  amendmentId?: string | null;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Check a permission inside a mutator. Throws PermissionError on failure.
 *
 * On client (optimistic): skips check — the server run is authoritative.
 * On server: queries the DB for the user's roles and checks against them.
 */
export async function can(
  tx: Transaction<Schema>,
  ctx: { readonly userID: string },
  check: PermissionCheck
): Promise<void> {
  // Skip permission checks on client — server is authoritative
  if (tx.location === 'client') return;

  const { userID } = ctx;
  if (!userID || userID === 'anon') {
    throw new PermissionError(check.action, check.resource, 'authentication required');
  }

  const data = await loadPermissionData(tx, userID, check);

  const groupId = check.groupId ?? undefined;
  const eventId = check.eventId ?? undefined;
  const blogId = check.blogId ?? undefined;
  const amendmentId = check.amendmentId ?? undefined;

  const allowed = checkPermission(
    data,
    { groupId, eventId, blogId, amendment: data.amendment },
    check.action,
    check.resource
  );

  if (!allowed) {
    const scopeLabel = groupId
      ? `group:${groupId}`
      : eventId
        ? `event:${eventId}`
        : blogId
          ? `blog:${blogId}`
          : amendmentId
            ? `amendment:${amendmentId}`
            : undefined;
    throw new PermissionError(check.action, check.resource, scopeLabel);
  }
}

// ============================================================================
// Data Loading (server-only, runs in tx)
// ============================================================================

async function loadPermissionData(
  tx: Transaction<Schema>,
  userId: string,
  check: PermissionCheck
): Promise<PermissionData> {
  const data: PermissionData = { userId };

  if (check.groupId) {
    data.memberships = await loadGroupMemberships(tx, userId, check.groupId);
    data.guestAccesses = await loadGroupGuestAccesses(tx, userId, check.groupId);
    data.ownedGroupIds = await loadOwnedGroupIds(tx, userId, check.groupId);
  }

  if (check.eventId) {
    data.participations = await loadEventParticipations(
      tx,
      userId,
      check.eventId,
      check.action === 'view'
    );
  }

  if (check.blogId) {
    data.bloggerRelations = await loadBloggerRelations(
      tx,
      userId,
      check.blogId,
      check.action === 'view'
    );
  }

  if (check.amendmentId) {
    data.amendment = await loadAmendment(tx, check.amendmentId, check.action === 'view');
  }

  return data;
}

async function loadGroupMemberships(
  tx: Transaction<Schema>,
  userId: string,
  groupId: string
): Promise<Membership[]> {
  const rows = await tx.run(
    zql.group_membership
      .where('user_id', userId)
      .where('group_id', groupId)
      .where('status', 'IN', ['active', 'member', 'admin'])
      .related('membership_roles', q => q.related('role', rq => rq.related('action_rights')))
      .related('group')
  );

  return rows.map(m => ({
    id: m.id,
    group: m.group ? { id: m.group.id } : undefined,
    roles: mapRolesFromLinks(m.membership_roles, 'group'),
    status: m.status ?? undefined,
  }));
}

async function loadGroupGuestAccesses(
  tx: Transaction<Schema>,
  userId: string,
  groupId: string
): Promise<GuestAccess[]> {
  const rows = await tx.run(
    zql.group_guest_access
      .where('user_id', userId)
      .where('group_id', groupId)
      .where('status', 'active')
      .related('guest_roles', q => q.related('role', rq => rq.related('action_rights')))
      .related('group')
  );

  return rows.map(guestAccess => ({
    id: guestAccess.id,
    group: guestAccess.group ? { id: guestAccess.group.id } : undefined,
    roles: mapRolesFromLinks(guestAccess.guest_roles, 'group'),
    status: guestAccess.status ?? undefined,
  }));
}

async function loadOwnedGroupIds(
  tx: Transaction<Schema>,
  userId: string,
  groupId: string
): Promise<string[]> {
  const ownedGroups = await tx.run(zql.group.where('id', groupId).where('owner_id', userId));
  return ownedGroups.map(group => group.id);
}

async function loadEventParticipations(
  tx: Transaction<Schema>,
  userId: string,
  eventId: string,
  includeInvited: boolean
) {
  const rows = await tx.run(
    zql.event_participant
      .where('user_id', userId)
      .where('event_id', eventId)
      .where(
        'status',
        'IN',
        includeInvited ? DISCOVERY_EVENT_PARTICIPANT_STATUSES : ACTIVE_EVENT_PARTICIPANT_STATUSES
      )
      .related('participant_roles', q => q.related('role', rq => rq.related('action_rights')))
      .related('event')
  );

  return rows.map(p => ({
    id: p.id,
    event: p.event ? { id: p.event.id } : undefined,
    roles: mapRolesFromLinks(p.participant_roles, 'event'),
    status: p.status ?? undefined,
  }));
}

async function loadBloggerRelations(
  tx: Transaction<Schema>,
  userId: string,
  blogId: string,
  includeInvited: boolean
) {
  const rows = await tx.run(
    zql.blog_blogger
      .where('user_id', userId)
      .where('blog_id', blogId)
      .where('status', 'IN', includeInvited ? DISCOVERY_BLOGGER_STATUSES : ACTIVE_BLOGGER_STATUSES)
      .related('role', q => q.related('action_rights'))
      .related('blog')
  );

  return rows.map(b => ({
    id: b.id,
    blog: b.blog ? { id: b.blog.id } : undefined,
    status: b.status ?? undefined,
    role: b.role
      ? {
          id: b.role.id,
          name: b.role.name ?? '',
          description: b.role.description ?? undefined,
          scope: (b.role.scope ?? 'blog') as Role['scope'],
          ...(b.role.blog_id ? { blog: { id: b.role.blog_id } } : {}),
          actionRights: mapActionRights(b.role.action_rights),
        }
      : undefined,
  }));
}

async function loadAmendment(
  tx: Transaction<Schema>,
  amendmentId: string,
  includeInvited: boolean
) {
  const amendment = await tx.run(
    zql.amendment
      .where('id', amendmentId)
      .related('created_by')
      .related('collaborators', q =>
        q
          .where(
            'status',
            'IN',
            includeInvited
              ? DISCOVERY_AMENDMENT_COLLABORATOR_STATUSES
              : ACTIVE_AMENDMENT_COLLABORATOR_STATUSES
          )
          .related('user')
          .related('role', rq => rq.related('action_rights'))
      )
      .one()
  );

  if (!amendment) return undefined;

  return {
    id: amendment.id,
    owner: amendment.created_by_id ? { id: amendment.created_by_id } : undefined,
    user: amendment.created_by_id ? { id: amendment.created_by_id } : undefined,
    group: amendment.group_id ? { id: amendment.group_id } : undefined,
    amendmentRoleCollaborators: amendment.collaborators?.map(collaborator => ({
      id: collaborator.id,
      user: collaborator.user_id ? { id: collaborator.user_id } : undefined,
      status: collaborator.status ?? undefined,
      role: collaborator.role
        ? {
            id: collaborator.role.id,
            name: collaborator.role.name ?? '',
            description: collaborator.role.description ?? undefined,
            scope: (collaborator.role.scope ?? 'amendment') as Role['scope'],
            ...(collaborator.role.amendment_id
              ? { amendment: { id: collaborator.role.amendment_id } }
              : {}),
            actionRights: mapActionRights(collaborator.role.action_rights),
          }
        : undefined,
    })),
  };
}

function mapActionRights(raw: readonly ActionRightRow[] | undefined): ActionRight[] {
  if (!raw) return [];
  return raw.map(ar => ({
    id: ar.id,
    resource: (ar.resource ?? 'groups') as ResourceType,
    action: (ar.action ?? 'view') as ActionType,
    group: ar.group_id ? { id: ar.group_id } : undefined,
    event: ar.event_id ? { id: ar.event_id } : undefined,
    amendment: ar.amendment_id ? { id: ar.amendment_id } : undefined,
    blog: ar.blog_id ? { id: ar.blog_id } : undefined,
  }));
}

function mapRolesFromLinks<T extends PermissionRoleLinkLike>(
  raw: readonly T[] | undefined,
  fallbackScope: Role['scope']
): Role[] {
  if (!raw) return [];

  return raw.flatMap(link => {
    if (!link.role) return [];

    return [
      {
        id: link.role.id,
        name: link.role.name ?? '',
        description: link.role.description ?? undefined,
        scope: (link.role.scope ?? fallbackScope) as Role['scope'],
        ...(link.role.group_id ? { group: { id: link.role.group_id } } : {}),
        ...(link.role.event_id ? { event: { id: link.role.event_id } } : {}),
        ...(link.role.amendment_id ? { amendment: { id: link.role.amendment_id } } : {}),
        ...(link.role.blog_id ? { blog: { id: link.role.blog_id } } : {}),
        actionRights: mapActionRights(link.role.action_rights),
      },
    ];
  });
}
