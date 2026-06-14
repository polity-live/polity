import {
  buildWikiIncumbentCarouselSections,
  type WikiIncumbentRoleCards,
} from '@/features/shared/logic/wikiIncumbentSections';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function buildEventWikiIncumbentSections(
  roles: readonly EventRoleLike[],
  participants: readonly EventParticipantRoleLike[]
) {
  const normalizedRoles: WikiIncumbentRoleCards[] = roles
    .filter(role => role.visibility === 'public')
    .map(role => {
      const assignees = new Map<string, EventVisibleAssignee>();

      participants.forEach(participant => {
        const participantRoleIds = participant.roles?.length
          ? participant.roles.map(assignedRole => assignedRole.id).filter(Boolean)
          : participant.role?.id
            ? [participant.role.id]
            : [];

        if (!participantRoleIds.includes(role.id) || !participant.user?.id) {
          return;
        }

        assignees.set(participant.user.id, {
          id: participant.user.id,
          name:
            `${participant.user.first_name ?? ''} ${participant.user.last_name ?? ''}`.trim() ||
            participant.user.handle ||
            'Unknown',
          handle: participant.user.handle ?? null,
          avatar: participant.user.avatar ?? null,
        });
      });

      role.holders?.forEach(holder => {
        if (!holder.user?.id) {
          return;
        }

        assignees.set(holder.user.id, {
          id: holder.user.id,
          name:
            `${holder.user.first_name ?? ''} ${holder.user.last_name ?? ''}`.trim() ||
            holder.user.handle ||
            'Unknown',
          handle: holder.user.handle ?? null,
          avatar: holder.user.avatar ?? null,
        });
      });

      const title =
        role.title?.trim() || translateText('generated.inline.0017_untitled_role_216c6117');
      const description = role.description?.trim() || null;
      const cards = Array.from(assignees.values()).map(assignee => ({
        kind: 'person' as const,
        id: `${role.id}:${assignee.id}`,
        userId: assignee.id,
        name: assignee.name,
        handle: assignee.handle,
        avatar: assignee.avatar,
        roleId: role.id,
        roleTitle: title,
        roleDescription: description,
      }));

      return {
        id: role.id,
        title,
        description,
        assigneeCount: cards.length,
        cards:
          cards.length > 0
            ? cards
            : [
                {
                  kind: 'vacancy' as const,
                  id: `${role.id}:vacancy`,
                  roleId: role.id,
                  roleTitle: title,
                  roleDescription: description,
                },
              ],
      };
    });

  return buildWikiIncumbentCarouselSections(normalizedRoles);
}

interface EventVisibleAssignee {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
}

interface EventRoleUserLike {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
}

interface EventRoleHolderLike {
  user?: EventRoleUserLike | null;
}

interface EventRoleLike {
  id: string;
  title?: string | null;
  description?: string | null;
  visibility?: string | null;
  holders?: readonly EventRoleHolderLike[] | null;
}

interface EventParticipantRoleLike {
  role?: { id?: string | null } | null;
  roles?: readonly { id?: string | null }[] | null;
  user?: EventRoleUserLike | null;
}
