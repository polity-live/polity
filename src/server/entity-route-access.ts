import { createServerFn } from '@tanstack/react-start';
import { getWebRequest } from '@tanstack/start-server-core';
import { z } from 'zod';
import {
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

export const entityRouteAccessFn = createServerFn({ method: 'POST' })
  .validator(entityRouteAccessSchema.parse)
  .handler(async ({ data }): Promise<EntityRouteAccessResult> => {
    const session = await getSession(getWebRequest());
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
                  zql.group_membership.where('group_id', data.entityId).where('user_id', userId)
                )
              : Promise.resolve([]),
            userId
              ? tx.run(
                  zql.group_guest_access.where('group_id', data.entityId).where('user_id', userId)
                )
              : Promise.resolve([]),
          ]);

          return {
            exists: !!group,
            visibilities: group ? [group.visibility] : [],
            canAccessPrivate: group
              ? hasPrivateGroupRouteAccess(
                  group.owner_id,
                  userId,
                  memberships.map(membership => membership.status),
                  guestAccesses.map(guestAccess => guestAccess.status)
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
                )
              : Promise.resolve([]),
          ]);

          return {
            exists: !!amendment,
            visibilities: amendment ? [amendment.visibility, amendment.group?.visibility] : [],
            canAccessPrivate: amendment
              ? hasPrivateAmendmentRouteAccess(
                  amendment.created_by_id,
                  userId,
                  collaborators.map(collaborator => collaborator.status)
                )
              : false,
          };
        }

        case 'event': {
          const [event, participants] = await Promise.all([
            tx.run(zql.event.where('id', data.entityId).related('group').one()),
            userId
              ? tx.run(
                  zql.event_participant.where('event_id', data.entityId).where('user_id', userId)
                )
              : Promise.resolve([]),
          ]);

          return {
            exists: !!event,
            visibilities: event ? [event.visibility, event.group?.visibility] : [],
            canAccessPrivate: event
              ? hasPrivateEventRouteAccess(
                  event.creator_id,
                  userId,
                  participants.map(participant => participant.status)
                )
              : false,
          };
        }

        case 'blog': {
          const blog = await tx.run(
            zql.blog.where('id', data.entityId).related('group').related('bloggers').one()
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

          const bloggerStatuses = (blog.bloggers ?? [])
            .filter(blogger => blogger.user_id === userId)
            .map(blogger => blogger.status);

          return {
            exists: true,
            visibilities: [blog.visibility],
            canAccessPrivate: hasPrivateBlogRouteAccess(userId, bloggerStatuses),
          };
        }
      }
    });
  });
