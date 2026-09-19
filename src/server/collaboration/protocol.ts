import type { beforeSyncPayload } from '@hocuspocus/server';
import * as Y from 'yjs';
import { acceptSync, committedState } from './service';
import type { CollaborationConnectionContext } from './delivery';
import { CollaborationError } from '@/features/collaboration/logic/types';
import { recordCollaborationFailure } from './diagnostics';

/** Hocuspocus 4.7 awaits this hook before applying an update or acknowledging
 * sync. Keep the installed version pinned and exercise this boundary over WS. */
export function commitBeforeSync(dependencies = { acceptUpdate: acceptSync, committedState }) {
  return async ({
    type,
    payload,
    context,
    connection,
    document,
  }: beforeSyncPayload<CollaborationConnectionContext>) => {
    const started = performance.now();
    if (type === 0) {
      const loaded = await dependencies.committedState(
        context.userId,
        context.id,
        context.generation
      );
      Y.applyUpdate(document, loaded.bytes, 'committed');
      return;
    }
    let saved;
    try {
      saved = await dependencies.acceptUpdate(
        context.userId,
        context.id,
        context.generation,
        payload
      );
    } catch (error) {
      recordCollaborationFailure(error);
      if (error instanceof CollaborationError && error.code === 'incomplete_update') {
        // A delta sent while the initial handshake is in flight can depend on
        // earlier local normalization. Never stage it in the live server doc.
        // The client must submit a complete state to the same transactional
        // validator; current generation and permissions still apply there.
        connection.sendStateless(
          JSON.stringify({ type: 'resync_required', generation: context.generation })
        );
        // A virtual document close leaves the provider's socket connected and
        // does not start a new handshake. Reset the transport so queued deltas
        // are reconciled from the client's complete document on reconnect.
        connection.webSocket.close(1012, 'Resync required');
      }
      throw error;
    }
    Y.applyUpdate(document, saved.document.state, 'committed');
    if (saved.duplicate) return;
    connection.sendStateless(
      JSON.stringify({
        type: 'committed',
        revision: saved.document.revision,
        checksum: saved.document.checksum,
        generation: saved.document.generation,
        commitLatencyMs: performance.now() - started,
      })
    );
  };
}
