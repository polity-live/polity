import { generateDistinctUserColorMap } from '@/features/editor/logic/editor-helpers';
import type { EditorCollaborator, EditorPresencePeer } from '@/features/editor/types';

interface StudioPresencePeer {
  userId?: string;
  user?: {
    id?: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    color?: string;
  };
  cursor?: { pageId?: string };
}

export function buildStudioPresence(
  identity: {
    id: string;
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string;
  },
  peers: Record<string, unknown>[]
) {
  const normalizedPeers = peers as StudioPresencePeer[];
  const peerByUserId = new Map<string, StudioPresencePeer>();

  for (const peer of normalizedPeers) {
    const userId = peer.userId ?? peer.user?.id;
    if (userId && userId !== identity.id) peerByUserId.set(userId, peer);
  }

  const userIds = [identity.id, ...peerByUserId.keys()].filter(Boolean);
  const presenceColorByUserId = generateDistinctUserColorMap(userIds);
  const collaborators: EditorCollaborator[] = [];

  if (identity.id) {
    collaborators.push({
      id: `studio-presence-${identity.id}`,
      user: {
        id: identity.id,
        name: identity.name,
        firstName: identity.firstName,
        lastName: identity.lastName,
        avatarUrl: identity.avatarUrl,
      },
      canEdit: true,
      status: 'collaborator',
    });
  }

  const onlinePeerMap = new Map<string, EditorPresencePeer>();
  const activeCursorUserIds = new Set<string>();

  for (const [userId, peer] of peerByUserId) {
    const name = peer.user?.name || 'Polity';
    // Every roster ID is included in the deterministic color map above.
    const color = presenceColorByUserId.get(userId) as string;
    collaborators.push({
      id: `studio-presence-${userId}`,
      user: {
        id: userId,
        name,
        firstName: peer.user?.firstName,
        lastName: peer.user?.lastName,
        avatarUrl: peer.user?.avatar ?? undefined,
      },
      canEdit: true,
      status: 'collaborator',
    });
    onlinePeerMap.set(userId, {
      peerId: userId,
      userId,
      name,
      avatar: peer.user?.avatar ?? undefined,
      color,
    });
    if (peer.cursor) activeCursorUserIds.add(userId);
  }

  return { collaborators, onlinePeerMap, activeCursorUserIds, presenceColorByUserId };
}
