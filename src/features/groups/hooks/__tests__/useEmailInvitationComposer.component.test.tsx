/* @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  session: { access_token: 'test-session' } as { access_token: string } | null,
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: auth.session } }) },
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
import {
  useEmailInvitationComposer,
  emailInvitationRequest,
  EmailInvitationApiError,
} from '../useEmailInvitationComposer';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  auth.session = { access_token: 'test-session' };
});

it.each([false, true])(
  'ignores stale preview completion after closing the composer, rejected=%s',
  async rejected => {
    let finish!: (value: Response) => void, fail!: (reason: Error) => void;
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      !init.body
        ? Promise.resolve(Response.json({ invitations: [] }))
        : new Promise<Response>((resolve, reject) => {
            finish = resolve;
            fail = reject;
          })
    );
    vi.stubGlobal('fetch', fetch);
    const { result, rerender } = renderHook(
      ({ open }) => useEmailInvitationComposer('group', open, ['role']),
      { initialProps: { open: true } }
    );
    act(() => {
      result.current.setMode('email');
      result.current.setText('a@example.com');
    });
    await waitFor(() => expect(typeof finish).toBe('function'));
    rerender({ open: false });
    await act(async () => {
      if (rejected) fail(new Error('stale'));
      else
        finish(
          Response.json({ available: 1, results: [{ email: 'a@example.com', status: 'ready' }] })
        );
    });
    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBe('');
    expect(result.current.checking).toBe(false);
  }
);
it('keeps a cleared preview cleared when a pending send reports a changed quota', async () => {
  let fail!: (error: Error) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      if (!init.body) return Promise.resolve(Response.json({ invitations: [] }));
      const body = JSON.parse(String(init.body));
      if (body.action === 'preview')
        return Promise.resolve(
          Response.json({ available: 1, results: [{ email: 'a@example.com', status: 'ready' }] })
        );
      return new Promise<Response>((_resolve, reject) => {
        fail = reject;
      });
    })
  );
  const { result } = renderHook(() => useEmailInvitationComposer('group', true, ['role']));
  act(() => {
    result.current.setMode('email');
    result.current.setText('a@example.com');
  });
  await waitFor(() => expect(result.current.canSend).toBe(true));
  let sending!: Promise<void>;
  act(() => {
    sending = result.current.send();
  });
  await waitFor(() => expect(result.current.sending).toBe(true));
  act(() => result.current.setMode('users'));
  await act(async () => {
    fail(new EmailInvitationApiError('quota_exceeded', 0));
    await sending;
  });
  expect(result.current.preview).toBeNull();
  expect(result.current.error).toContain('quota_exceeded');
});
it('sends no authorization header when the session is absent', async () => {
  auth.session = null;
  const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json({ invitations: [] })
  );
  vi.stubGlobal('fetch', fetch);
  await emailInvitationRequest('/api/invitations');
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
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
it.each([true, false])(
  'shows a quota-aware sending error and freezes recipient edits while sending, typed=%s',
  async typed => {
    let fail!: (error: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        if (!init.body) return Response.json({ invitations: [] });
        const body = JSON.parse(String(init.body));
        if (body.action === 'create')
          return new Promise<Response>((_resolve, reject) => {
            fail = reject;
          });
        return Response.json({
          available: 4,
          results: [{ email: 'a@example.com', status: 'ready' }],
        });
      })
    );
    const { result } = renderHook(() => useEmailInvitationComposer('group', true, ['role']));
    await act(() => result.current.send());
    act(() => {
      result.current.setMode('email');
      result.current.setText('a@example.com');
    });
    await waitFor(() => expect(result.current.canSend).toBe(true));
    let sending!: Promise<void>;
    act(() => {
      sending = result.current.send();
    });
    await waitFor(() => expect(result.current.sending).toBe(true));
    act(() => {
      result.current.setRecipientName('a@example.com', 'firstName', 'Ignored');
      result.current.removeRecipient('a@example.com');
      result.current.startNewList();
    });
    expect(result.current.text).toBe('a@example.com');
    expect(result.current.recipients[0].firstName).toBeUndefined();
    await act(async () => {
      fail(typed ? new EmailInvitationApiError('quota_exceeded', 0) : new Error('offline'));
      await sending;
    });
    expect(result.current.error).toContain(typed ? 'quota_exceeded' : 'server_error');
    if (typed) expect(result.current.preview?.available).toBe(0);
  }
);
it.each([true, false])(
  'reports preview and list errors without retaining a previous successful preview, typed=%s',
  async typed => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (typed) return Response.json({ error: 'permission_denied' }, { status: 403 });
        throw new Error('network');
      })
    );
    const { result } = renderHook(() => useEmailInvitationComposer('group', true, ['role']));
    act(() => {
      result.current.setMode('email');
      result.current.setText('a@example.com');
    });
    await waitFor(() =>
      expect(result.current.listError).toContain(typed ? 'permission_denied' : 'server_error')
    );
    await waitFor(() =>
      expect(result.current.error).toContain(typed ? 'permission_denied' : 'server_error')
    );
    expect(result.current.canSend).toBe(false);
    expect(result.current.checking).toBe(false);
  }
);
it('uses server_error for failed responses without an error code', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({}, { status: 500 }))
  );
  await expect(emailInvitationRequest('/api/invitations')).rejects.toMatchObject({
    code: 'server_error',
  });
});
it('ignores aborted list refresh success and failure and does no requests without a group', async () => {
  const fetch = vi.fn(async () => Response.json({ invitations: [] }));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(
    ({ groupId }) => useEmailInvitationComposer(groupId, false, []),
    { initialProps: { groupId: undefined as string | undefined } }
  );
  await act(() => result.current.refreshInvitations());
  expect(fetch).not.toHaveBeenCalled();
  rerender({ groupId: 'group' });
  const controller = new AbortController();
  controller.abort();
  await act(() => result.current.refreshInvitations(controller.signal));
  fetch.mockRejectedValueOnce(new Error('aborted'));
  await act(() => result.current.refreshInvitations(controller.signal));
  expect(result.current.listError).toBe('');
});
