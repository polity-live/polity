import { z } from 'zod';
import {
  studioTransaction,
  canvasEnabled,
  StudioError,
  assertStudioCollaborationAccess,
} from './db';
import { assertCanvasWorkspace } from './workspace-access';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
  cursor: z
    .object({ pageId: z.string().uuid(), x: z.number().finite(), y: z.number().finite() })
    .optional(),
  selection: z.array(z.string().max(200)).max(100).default([]),
});
interface Peer {
  userId: string;
  user: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    color: string;
  };
  cursor?: z.infer<typeof schema>['cursor'];
  selection: string[];
  at: number;
}
// Transient presence is disposable. Durable content always comes from PostgreSQL/Zero.
const rooms = new Map<string, Map<string, Peer>>();
export async function canvasPresence(actor: string, raw: unknown) {
  if (!canvasEnabled()) throw new StudioError('Canvas preview is not enabled', 404);
  const input = schema.parse(raw),
    key = `${input.projectId}:${input.workspaceId ?? 'main'}`;
  return studioTransaction(
    async sql => {
      await assertCanvasWorkspace(actor, input.projectId, input.workspaceId, false, sql);
      await assertStudioCollaborationAccess(actor, input.projectId, sql);
      const [user] = await sql`select first_name,last_name,avatar from "user" where id=${actor}`;
      const now = Date.now();
      for (const [roomId, room] of rooms) {
        for (const [id, p] of room) if (p.at < now - 15000) room.delete(id);
        if (!room.size) rooms.delete(roomId);
      }
      const room = rooms.get(key) ?? new Map<string, Peer>();
      rooms.set(key, room);
      room.set(actor, {
        userId: actor,
        user: {
          id: actor,
          name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Polity',
          firstName: user?.first_name ?? null,
          lastName: user?.last_name ?? null,
          avatar: user?.avatar ?? null,
          color: '#B88A3B',
        },
        cursor: input.cursor,
        selection: input.selection,
        at: now,
      });
      for (const id of room.keys()) {
        const [right] =
          await sql`select studio_collaboration_access(${id}::uuid,${input.projectId}::uuid) and (${input.workspaceId ?? null}::uuid is null or canvas_proposal_access(${id}::uuid,${input.workspaceId ?? null}::uuid)) as allowed`;
        if (!right.allowed) room.delete(id);
      }
      const peers = [...room.values()];
      const supabase = createClient();
      await Promise.all(
        peers.map(async p => {
          const channel = supabase.channel(`canvas-user:${key}:${p.userId}`, {
            config: { private: true },
          });
          try {
            const result = await channel.httpSend(
              'peers',
              { peers: peers.filter(other => other.userId !== p.userId) },
              { timeout: 2000 }
            );
            if (!result.success) throw new StudioError('Presence delivery is unavailable', 503);
          } finally {
            await supabase.removeChannel(channel);
          }
        })
      );
      return { peers: peers.filter(p => p.userId !== actor) };
    },
    { readOnly: true }
  );
}
