import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import {
  hasActiveGroupRelationshipAccess,
  hasPrivateAmendmentRouteAccess,
  hasPrivateBlogRouteAccess,
  hasPrivateEventRouteAccess,
  hasPrivateGroupRouteAccess,
} from '@/features/auth/logic/privateEntityRelationshipAccess';
import { getSession } from '@/lib/supabase/server';
import { executeZeroRead } from '@/server/zero-mutate';
import { zql } from '@/zero/schema';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

const entityRouteAccessSchema = z
  .object({
    entityType: z.enum(['user', 'group', 'amendment', 'event', 'blog']),
    entityId: z.string(),
    parentType: z.enum(['user', 'group']).optional(),
    parentId: z.string().optional(),
  })
  .refine(
    value =>
      (value.parentType == null && value.parentId == null) ||
      (value.parentType != null && value.parentId != null),
    {
      message: translateText(
        'generated.inline.0653_parenttype_and_parentid_must_be_provided_toge_3662ca4b'
      ),
      path: ['parentId'],
    }
  );

export type EntityRouteAccessInput = z.infer<typeof entityRouteAccessSchema>;

export interface EntityRouteAccessResult {
  exists: boolean;
  visibilities: (string | null | undefined)[];
  canAccessPrivate: boolean;
}

async function hasActiveGroupParentAccess(tx: any, groupId: string | null, userId: string | null) {
  if (!groupId || !userId) return false;

  const [group, memberships, guestAccesses] = await Promise.all([
    tx.run(zql.group.where('id', groupId).one()),
    tx.run(zql.group_membership.where('group_id', groupId).where('user_id', userId)),
    tx.run(zql.group_guest_access.where('group_id', groupId).where('user_id', userId)),
  ]);

  return hasActiveGroupRelationshipAccess(
    group?.owner_id,
    userId,
    memberships.map((membership: any) => membership.status),
    guestAccesses.map((guestAccess: any) => guestAccess.status)
  );
}

export const entityRouteAccessFn = createServerFn({ method: 'POST' })
  .validator(entityRouteAccessSchema.parse)
  .handler(async ({ data }): Promise<EntityRouteAccessResult> => {
    const request = getRequest();
    if (!request) {
      throw new Error('Request context unavailable.');
    }

    const session = await getSession(request);
    const userId = session?.user.id ?? null;

    return executeZeroRead(async tx => {
      switch (data.entityType) {
        case 'user': {
          const user = await tx.run(zql.user.where('id', data.entityId).one());

          return {
            exists: !!user,
            visibilities: user ? [user.visibility] : [],
            canAccessPrivate: !!user && user.id === userId,
          };
        }

        case 'group': {
          const [group, memberships, guestAccesses] = await Promise.all([
            tx.run(zql.group.where('id', data.entityId).one()),
            userId
              ? tx.run(
                  zql.group_membership
                    .where('group_id', data.entityId)
                    .where('user_id', userId)
                    .related('membership_roles', membershipRole =>
                      membershipRole.related('role', role => role.related('action_rights'))
                    )
                )
              : Promise.resolve([]),
            userId
              ? tx.run(
                  zql.group_guest_access
                    .where('group_id', data.entityId)
                    .where('user_id', userId)
                    .related('guest_roles', guestRole =>
                      guestRole.related('role', role => role.related('action_rights'))
                    )
                )
              : Promise.resolve([]),
          ]);

          return {
            exists: !!group,
            visibilities: group ? [group.visibility] : [],
            canAccessPrivate: group
              ? hasPrivateGroupRouteAccess(
                  group.id,
                  group.owner_id,
                  userId,
                  memberships.map(membership => ({
                    status: membership.status,
                    roles: (membership.membership_roles ?? []).flatMap(link =>
                      link.role ? [link.role] : []
                    ),
                  })),
                  guestAccesses.map(guestAccess => ({
                    status: guestAccess.status,
                    roles: (guestAccess.guest_roles ?? []).flatMap(link =>
                      link.role ? [link.role] : []
                    ),
                  }))
                )
              : false,
          };
        }

        case 'amendment': {
          const [amendment, collaborators] = await Promise.all([
            tx.run(zql.amendment.where('id', data.entityId).related('group').one()),
            userId
              ? tx.run(
                  zql.amendment_collaborator
                    .where('amendment_id', data.entityId)
                    .where('user_id', userId)
                    .related('role', role => role.related('action_rights'))
                )
              : Promise.resolve([]),
          ]);

          const [activeGroupAccess, activeEventAccess] = amendment
            ? await Promise.all([
                hasActiveGroupParentAccess(tx, amendment.group_id, userId),
                amendment.event_id && userId
                  ? tx
                      .run(
                        zql.event_participant
                          .where('event_id', amendment.event_id)
                          .where('user_id', userId)
                          .where('status', 'IN', ['active', 'confirmed', 'member', 'admin'])
                      )
                      .then((rows: unknown[]) => rows.length > 0)
                  : false,
              ])
            : [false, false];

          return {
            exists: !!amendment,
            visibilities: amendment ? [amendment.visibility, amendment.group?.visibility] : [],
            canAccessPrivate: amendment
              ? hasPrivateAmendmentRouteAccess(
                  amendment.id,
                  amendment.created_by_id,
                  userId,
                  collaborators.map(collaborator => ({
                    status: collaborator.status,
                    role: collaborator.role,
                  })),
                  activeGroupAccess || activeEventAccess
                )
              : false,
          };
        }

        case 'event': {
          const [event, participants] = await Promise.all([
            tx.run(zql.event.where('id', data.entityId).related('group').one()),
            userId
              ? tx.run(
                  zql.event_participant
                    .where('event_id', data.entityId)
                    .where('user_id', userId)
                    .related('participant_roles', participantRole =>
                      participantRole.related('role', role => role.related('action_rights'))
                    )
                )
              : Promise.resolve([]),
          ]);

          const activeGroupAccess = event
            ? await hasActiveGroupParentAccess(tx, event.group_id, userId)
            : false;

          return {
            exists: !!event,
            visibilities: event ? [event.visibility, event.group?.visibility] : [],
            canAccessPrivate: event
              ? hasPrivateEventRouteAccess(
                  event.id,
                  event.creator_id,
                  userId,
                  participants.map(participant => ({
                    status: participant.status,
                    roles: (participant.participant_roles ?? []).flatMap(link =>
                      link.role ? [link.role] : []
                    ),
                  })),
                  activeGroupAccess
                )
              : false,
          };
        }

        case 'blog': {
          const blog = await tx.run(
            zql.blog
              .where('id', data.entityId)
              .related('group')
              .related('bloggers', blogger =>
                blogger.related('role', role => role.related('action_rights'))
              )
              .one()
          );

          if (!blog) {
            return { exists: false, visibilities: [], canAccessPrivate: false };
          }

          if (data.parentType === 'group' && blog.group_id !== data.parentId) {
            return { exists: false, visibilities: [], canAccessPrivate: false };
          }

          if (
            data.parentType === 'user' &&
            !(blog.bloggers ?? []).some(blogger => blogger.user_id === data.parentId)
          ) {
            return { exists: false, visibilities: [], canAccessPrivate: false };
          }

          const bloggers = (blog.bloggers ?? [])
            .filter(blogger => blogger.user_id === userId)
            .map(blogger => ({ status: blogger.status, role: blogger.role }));
          const activeGroupAccess = await hasActiveGroupParentAccess(tx, blog.group_id, userId);

          return {
            exists: true,
            visibilities: [blog.visibility],
            canAccessPrivate: hasPrivateBlogRouteAccess(
              blog.id,
              userId,
              bloggers,
              activeGroupAccess
            ),
          };
        }
      }
    });
  });
