/* @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
import { useEmailInvitationComposer } from '../useEmailInvitationComposer';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('previews only valid lists, blocks oversized budgets and reuses request keys after uncertain client failures', async () => {
  const bodies: Record<string, unknown>[] = [];
  let fail = true;
  let available = 1;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-session');
    if (!init.body) return Response.json({ invitations: [] });
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    if (body.action === 'create' && fail) {
      fail = false;
      throw new Error('timeout');
    }
    return Response.json({
      available,
      results: body.recipients.map((person: { email: string }) => ({
        ...person,
        status: body.action === 'preview' ? 'ready' : 'sent',
      })),
    });
  });
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useEmailInvitationComposer('group', true, ['role']));
  expect(fetch).not.toHaveBeenCalled();
  act(() => {
    result.current.setMode('email');
    result.current.setText('bad-address');
  });
  expect(result.current.canSend).toBe(false);
  act(() => result.current.setText('a@example.com;b@example.com'));
  await waitFor(() => expect(result.current.preview?.available).toBe(1));
  expect(result.current.canSend).toBe(false);
  available = 2;
  act(() => {
    result.current.setText('a@example.com, b@example.com');
    result.current.setRecipientName('a@example.com', 'firstName', 'Ada');
  });
  await waitFor(() => expect(result.current.canSend).toBe(true));
  await act(() => result.current.send());
  expect(result.current.error).toContain('server_error');
  await act(() => result.current.send());
  const sends = bodies.filter(body => body.action === 'create');
  expect(sends).toHaveLength(2);
  expect(sends[0].idempotencyKey).toBe(sends[1].idempotencyKey);
  expect(result.current.result?.results[0].status).toBe('sent');
  expect(result.current.canSend).toBe(false);
});
it('preserves names and results across list refreshes and explicitly starts a fresh batch', async () => {
  const bodies: Record<string, any>[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    if (!init.body)
      return Response.json({
        invitations: [
          {
            id: 'existing',
            email: 'old@example.com',
            first_name: 'Old',
            state: 'pending',
            delivery_status: 'sent',
          },
        ],
      });
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    return Response.json({
      available: 10,
      results: body.recipients.map((person: object) => ({
        ...person,
        status: body.action === 'create' ? 'sent' : 'ready',
      })),
    });
  });
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useEmailInvitationComposer('group', true, ['role']));
  act(() => {
    result.current.setMode('email');
    result.current.setText('A@EXAMPLE.com; b@example.com');
  });
  await waitFor(() => expect(result.current.canSend).toBe(true));
  act(() => result.current.setRecipientName('a@example.com', 'firstName', 'Ada'));
  act(() => result.current.setText('a@example.com, B@EXAMPLE.COM'));
  await waitFor(() => expect(result.current.canSend).toBe(true));
  expect(result.current.recipients[0].firstName).toBe('Ada');
  act(() => result.current.removeRecipient('b@example.com'));
  await waitFor(() => expect(result.current.canSend).toBe(true));
  expect(result.current.recipients).toHaveLength(1);
  await act(() => result.current.send());
  const completed = result.current.result;
  await act(() => result.current.refreshInvitations());
  expect(result.current.result).toBe(completed);
  expect(result.current.openInvitations[0].email).toBe('old@example.com');
  expect(result.current.canSend).toBe(false);
  act(() => {
    result.current.startNewList();
    result.current.setText('next@example.com');
  });
  await waitFor(() => expect(result.current.canSend).toBe(true));
  await act(() => result.current.send());
  const sends = bodies.filter(body => body.action === 'create');
  expect(sends[0].idempotencyKey).not.toBe(sends[1].idempotencyKey);
});
