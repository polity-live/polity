import { afterEach, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => ({ group: vi.fn(), token: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock('@/server/group-email-invitations', () => ({
  handleGroupEmailInvitations: handlers.group,
  handlePublicGroupInvitation: handlers.token,
}));
import { Route as GroupRoute } from '../api/groups/$groupId/email-invitations';
import { Route as TokenRoute } from '../api/invitations/$token';

type InvitationHandlers = Record<
  'GET' | 'POST',
  (context: { request: Request; params: Record<string, string> }) => Promise<Response>
>;
const groupHandlers = GroupRoute.options.server!.handlers as unknown as InvitationHandlers;
const tokenHandlers = TokenRoute.options.server!.handlers as unknown as InvitationHandlers;

afterEach(() => vi.resetAllMocks());

it.each(['GET', 'POST'] as const)(
  'preserves the original authenticated %s request and group identity at the invitation boundary',
  async method => {
    const request = new Request('http://localhost/api/groups/group/email-invitations', {
      method,
      headers: { Authorization: 'Bearer local-test-token' },
      ...(method === 'POST' ? { body: '{"action":"preview"}' } : {}),
    });
    const denied = Response.json({ error: 'forbidden' }, { status: 403 });
    handlers.group.mockResolvedValue(denied);
    const response = await groupHandlers[method]({
      request,
      params: { groupId: 'group' },
    });
    expect(handlers.group).toHaveBeenCalledExactlyOnceWith(request, 'group');
    expect(response).toBe(denied);
  }
);

it.each(['GET', 'POST'] as const)(
  'preserves the original %s request and personal token at the invitation acceptance boundary',
  async method => {
    const request = new Request('http://localhost/api/invitations/local-test-token', { method });
    const response = Response.json({ error: 'expired' }, { status: 410 });
    handlers.token.mockResolvedValue(response);
    expect(
      await tokenHandlers[method]({
        request,
        params: { token: 'local-test-token' },
      })
    ).toBe(response);
    expect(handlers.token).toHaveBeenCalledExactlyOnceWith(request, 'local-test-token');
  }
);
