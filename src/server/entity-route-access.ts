import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { executeZeroRead } from '@/server/zero-mutate';
import { zql } from '@/zero/schema';

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
      message: 'parentType and parentId must be provided together',
      path: ['parentId'],
    }
  );

export type EntityRouteAccessInput = z.infer<typeof entityRouteAccessSchema>;

export interface EntityRouteAccessResult {
  exists: boolean;
  visibilities: (string | null | undefined)[];
}

export const entityRouteAccessFn = createServerFn({ method: 'POST' })
  .validator(entityRouteAccessSchema.parse)
  .handler(async ({ data }): Promise<EntityRouteAccessResult> => {
    return executeZeroRead(async tx => {
      switch (data.entityType) {
        case 'user': {
          const user = await tx.run(zql.user.where('id', data.entityId).one());

          return {
            exists: !!user,
            visibilities: user ? [user.visibility] : [],
          };
        }

        case 'group': {
          const group = await tx.run(zql.group.where('id', data.entityId).one());

          return {
            exists: !!group,
            visibilities: group ? [group.visibility] : [],
          };
        }

        case 'amendment': {
          const amendment = await tx.run(
            zql.amendment.where('id', data.entityId).related('group').one()
          );

          return {
            exists: !!amendment,
            visibilities: amendment ? [amendment.visibility, amendment.group?.visibility] : [],
          };
        }

        case 'event': {
          const event = await tx.run(zql.event.where('id', data.entityId).related('group').one());

          return {
            exists: !!event,
            visibilities: event ? [event.visibility, event.group?.visibility] : [],
          };
        }

        case 'blog': {
          const blog = await tx.run(
            zql.blog.where('id', data.entityId).related('group').related('bloggers').one()
          );

          if (!blog) {
            return { exists: false, visibilities: [] };
          }

          if (data.parentType === 'group' && blog.group_id !== data.parentId) {
            return { exists: false, visibilities: [] };
          }

          if (
            data.parentType === 'user' &&
            !(blog.bloggers ?? []).some(blogger => blogger.user_id === data.parentId)
          ) {
            return { exists: false, visibilities: [] };
          }

          return {
            exists: true,
            visibilities: [blog.visibility],
          };
        }
      }
    });
  });
