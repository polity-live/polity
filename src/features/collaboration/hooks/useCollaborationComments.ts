import { useCallback, useEffect, useRef, useState } from 'react';
import type { Value } from 'platejs';
import type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit';
import { collaborationRequest, type CollaborationClient } from './useCollaborationDocument';

interface Row {
  id: string;
  thread_id: string;
  author_id: string;
  content: Value;
  revision: number;
  deleted: boolean;
  resolved: boolean;
  orphaned: boolean;
  created_at: number;
  change_request_id: string | null;
  visibility: string;
}
type CollaborationDiscussion = TDiscussion & { orphaned: boolean };
export function useCollaborationComments(client: CollaborationClient, userId?: string) {
  const [discussions, setDiscussions] = useState<CollaborationDiscussion[]>([]),
    rows = useRef<Row[]>([]);
  const queue = useRef(Promise.resolve());
  const [error, setError] = useState('');
  const session = client.session;
  const active = useRef(session);
  active.current = client.phase === 'active' ? session : null;
  const refresh = useCallback(async (session: NonNullable<CollaborationClient['session']>) => {
    const result = await collaborationRequest<Row[]>('comments', {
      id: session.id,
      generation: session.generation,
    });
    if (active.current?.id !== session.id || active.current.generation !== session.generation)
      return;
    rows.current = result;
    const threads = new Map<string, CollaborationDiscussion>();
    for (const row of result.filter(r => !r.deleted)) {
      const thread: CollaborationDiscussion = threads.get(row.thread_id) ?? {
        id: row.thread_id,
        comments: [],
        createdAt: new Date(Number(row.created_at)),
        userId: row.author_id,
        isResolved: row.resolved,
        orphaned: row.orphaned,
        changeRequestEntityId: row.change_request_id ?? undefined,
        visibilityScope: row.visibility,
      };
      thread.comments.push({
        id: row.id,
        contentRich: row.content,
        createdAt: new Date(Number(row.created_at)),
        userId: row.author_id,
        discussionId: row.thread_id,
        isEdited: row.revision > 1,
      });
      threads.set(row.thread_id, thread);
    }
    setDiscussions([...threads.values()]);
  }, []);
  useEffect(() => {
    rows.current = [];
    setDiscussions([]);
    setError('');
    if (client.phase !== 'active' || !session) return;
    const poll = () => {
      void queue.current.then(() => refresh(session)).catch(e => setError(String(e.message)));
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [client.phase, session?.id, session?.generation, refresh]);
  const save = useCallback(
    (next: TDiscussion[]) => {
      if (!session) return Promise.resolve();
      // A plugin list is only a source of individual additions/edits. Omission
      // never deletes a server discussion or another participant's comment.
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          for (const thread of next)
            for (const comment of thread.comments) {
              if (comment.userId !== userId) continue;
              const old = rows.current.find(row => row.id === comment.id);
              if (
                old &&
                JSON.stringify(old.content) === JSON.stringify(comment.contentRich) &&
                old.resolved === thread.isResolved
              )
                continue;
              await collaborationRequest('comment', {
                id: session.id,
                generation: session.generation,
                operationId: crypto.randomUUID(),
                change: {
                  id: comment.id,
                  threadId: thread.id,
                  expectedRevision: old?.revision ?? 0,
                  content: comment.contentRich,
                  resolved: thread.isResolved,
                  changeRequestId: old?.change_request_id ?? thread.changeRequestEntityId,
                  visibility:
                    old?.visibility ??
                    (thread.visibilityScope === 'collaborators' ? 'collaborators' : 'document'),
                },
              });
            }
          await refresh(session);
        });
      return queue.current.catch(e => {
        setError(String(e.message));
        throw e;
      });
    },
    [session?.id, session?.generation, userId, refresh]
  );
  const remove = useCallback(
    (id: string) => {
      if (!session) return Promise.resolve();
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          const old = rows.current.find(row => row.id === id);
          if (!old || old.deleted) return;
          await collaborationRequest('comment', {
            id: session.id,
            generation: session.generation,
            operationId: crypto.randomUUID(),
            change: {
              id: old.id,
              threadId: old.thread_id,
              expectedRevision: old.revision,
              content: old.content,
              deleted: true,
              resolved: old.resolved,
              changeRequestId: old.change_request_id ?? undefined,
              visibility: old.visibility,
            },
          });
          await refresh(session);
        });
      return queue.current.catch(e => {
        setError(String(e.message));
        throw e;
      });
    },
    [session?.id, session?.generation, refresh]
  );
  return { discussions, save, remove, error };
}
