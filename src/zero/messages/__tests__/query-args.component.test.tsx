// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
const hook = vi.hoisted(() => vi.fn(() => [[], { type: 'complete' }]));
vi.mock('@rocicorp/zero/react', () => ({ useQuery: hook }));
import { useMessageState } from '../useMessageState';
import { INITIAL_CONVERSATION_LIMIT, INITIAL_MESSAGE_LIMIT } from '../query-args';
import { createMessagesPreloadTask } from '../../preloads/route-manifests';

afterEach(() => hook.mockClear());
describe('Message query arguments', () => {
  it('uses identical query requests for the initial visible page and its background preload', () => {
    renderHook(() =>
      useMessageState({
        conversationId: 'conversation',
        includeRelations: true,
        limit: INITIAL_CONVERSATION_LIMIT,
        messageLimit: INITIAL_MESSAGE_LIMIT,
      })
    );
    const entries = createMessagesPreloadTask('conversation').entries;
    const requests = hook.mock.calls.map(call => (call as unknown[])[0] as any).filter(Boolean);
    for (const name of [
      'messages.conversationsWithRelations',
      'messages.messagesWindow',
      'messages.conversationById',
    ]) {
      const visible = requests.find(request => request.query.queryName === name);
      const preloaded = entries
        .map(entry => entry.query as any)
        .find(request => request.query.queryName === name);
      expect(visible, name).toBeDefined();
      expect(preloaded, name).toBeDefined();
      expect(visible.args).toEqual(preloaded.args);
    }
  });
});
