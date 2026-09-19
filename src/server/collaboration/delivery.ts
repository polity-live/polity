import { Connection, OutgoingMessage } from '@hocuspocus/server';
import { authorizedDelivery } from './service';

export interface CollaborationConnectionContext {
  userId: string;
  id: string;
  generation: string;
  expires: number;
}
const deliveries = new WeakMap<
  Connection,
  { tail: Promise<void>; size: number; failed: boolean; messages: Uint8Array[]; scheduled: boolean }
>();
export async function waitForDelivery(connection: Connection) {
  await deliveries.get(connection)?.tail;
}
/** Guard every document-bearing send, including initial awareness sent by the
 * Connection constructor before Hocuspocus's `connected` hook. Pinned-version
 * contract tests cover this boundary. A per-connection queue preserves order. */
export function installDeliveryGuard(authorize: typeof authorizedDelivery = authorizedDelivery) {
  const original = Connection.prototype.send;
  const pending = deliveries;
  Connection.prototype.send = function (message: Uint8Array) {
    const context = this.context as CollaborationConnectionContext;
    let queue = pending.get(this);
    if (!queue) {
      queue = { tail: Promise.resolve(), size: 0, failed: false, messages: [], scheduled: false };
      pending.set(this, queue);
    }
    if (queue.failed) return;
    const state = queue;
    state.size += message.byteLength;
    state.messages.push(message.slice());
    if (state.scheduled) return;
    state.scheduled = true;
    state.tail = state.tail
      .then(async () => {
        if (!context?.userId || context.expires < Date.now() || state.size > 24_000_000)
          throw new Error('Session unavailable');
        await authorize(context.userId, context.id, context.generation, () => {
          // Drain under the same current permission check and authority lock.
          // Sends that arrive while waiting for the lock join this batch.
          const batch = state.messages.splice(0);
          for (const bytes of batch) {
            original.call(this, bytes);
            state.size -= bytes.byteLength;
          }
          state.scheduled = false;
        });
      })
      .catch(() => {
        state.failed = true;
        // This control frame contains no document bytes and must bypass the
        // rejected queue so clients can stop retrying the obsolete session.
        original.call(
          this,
          new OutgoingMessage(this.messageAddress)
            .writeCloseMessage('Access changed; recover your local draft')
            .toUint8Array()
        );
        this.close({ code: 4403, reason: 'Access changed; reconnect to recover your draft' });
      })
      .finally(() => {
        if (state.failed) {
          state.messages.length = 0;
          state.size = 0;
          state.scheduled = false;
        }
      });
  };
  return () => {
    Connection.prototype.send = original;
  };
}
