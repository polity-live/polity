import { ProjectContextNavigation } from '@/features/project-chat/ui/ProjectContextNavigation';
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const auth = vi.hoisted(() => ({ token: 'session-token' as string | null }));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: auth.token ? { access_token: auth.token } : null }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/errors/app-error', () => ({
  localizeAppError: () => 'Invalid identifier',
}));
import { AiTraceDetails } from '../AiTraceDetails';
beforeEach(() => {
  auth.token = 'session-token';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

it('preserves origin deep links through keyboard navigation and hides them while loading or failed', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>(done => {
        resolve = done;
      })
    )
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  const { container } = render(<AiTraceDetails traceId="trace-1" />);
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect(await screen.findByRole('status')).toHaveProperty('textContent', 'common.aiTrace.loading');
  expect(screen.queryByRole('link')).toBeNull();
  await act(async () => resolve(Response.json({ traces: [trace] })));
  const origin = await screen.findByRole('link', { name: 'common.aiTrace.origin' });
  expect(origin.getAttribute('href')).toBe('#message-message-1');
  const user = userEvent.setup();
  origin.focus();
  expect(document.activeElement).toBe(origin);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(window.location.hash).toBe('#message-message-1'));
  const refresh = screen.getByRole('button', { name: 'common.aiTrace.refresh' });
  refresh.focus();
  expect(document.activeElement).toBe(refresh);
  await user.keyboard('{Enter}');
  expect((await screen.findByRole('alert')).textContent).toBe('common.aiTrace.unavailable');
  expect(screen.queryByRole('link')).toBeNull();
  expect(fetch.mock.calls[0][0]).toBe('/api/ai/traces?traceId=trace-1');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not request private diagnostics without an authenticated session', async () => {
  auth.token = null;
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { container } = render(<AiTraceDetails messageId="private" />);
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  fireEvent.click(screen.getByRole('button'));
  await act(async () => {
    await Promise.resolve();
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('link')).toBeNull();
});

it('aborts pending requests on unmount and tolerates responses without trace data', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi
    .fn()
    .mockReturnValueOnce(
      new Promise<Response>(done => {
        resolve = done;
      })
    )
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch', fetch);
  const ui = render(<AiTraceDetails />);
  const details = ui.container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByRole('status');
  const signal = fetch.mock.calls[0][1].signal as AbortSignal;
  ui.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(Response.json({ traces: [trace] })));
  const next = render(<AiTraceDetails />);
  const second = next.container.querySelector('details')!;
  second.open = true;
  fireEvent(second, new Event('toggle'));
  expect(await screen.findByText('common.aiTrace.empty')).toBeTruthy();
  expect(fetch.mock.calls[1][0]).toBe('/api/ai/traces?messageId=');
});
const trace = {
  id: 'trace-1',
  origin_message_id: 'message-1',
  surface: 'city_design',
  invocation: 'project_chat',
  prompt: { content: 'Create a park' },
  operations: [
    {
      id: 'model-1',
      parent_operation_id: null,
      name: 'model',
      kind: 'model',
      status: 'completed',
      created_at: 0,
      finished_at: 10,
      input: { prompt: 'Create a park' },
      output: { text: 'Done' },
    },
    {
      id: 'tool-1',
      parent_operation_id: 'model-1',
      name: 'write_city_design',
      kind: 'tool',
      status: 'failed',
      created_at: 1,
      finished_at: 8,
      error: { code: 'ai_invalid_identifier' },
      tool_call_id: 'call-1',
    },
  ],
};
it('loads on demand and presents prompt, nested tool failures and origin link after reload', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ traces: [trace] }));
  vi.stubGlobal('fetch', fetch);
  const { container } = render(<AiTraceDetails messageId="message-1" />);
  expect(fetch).not.toHaveBeenCalled();
  const details = container.querySelector('details');
  if (!details) throw new Error('Missing diagnostics panel');
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await screen.findByText('Invalid identifier');
  expect(screen.getByRole('link').getAttribute('href')).toBe('#message-message-1');
  expect(
    screen
      .getByText('write_city_design · common.aiTrace.status.failed · 7 ms')
      .closest('ol')
      ?.parentElement?.closest('li')?.textContent
  ).toContain('model');
  expect(fetch).toHaveBeenCalledWith(
    '/api/ai/traces?messageId=message-1',
    expect.objectContaining({ headers: { Authorization: 'Bearer session-token' } })
  );
  expect(screen.getAllByText(/Create a park/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
});
it('shows a recoverable loading failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  const { container } = render(<AiTraceDetails documentId="document-1" />);
  const details = container.querySelector('details');
  if (!details) throw new Error('Missing diagnostics panel');
  details.open = true;
  fireEvent(details, new Event('toggle'));
  expect((await screen.findByRole('alert')).textContent).toBe('common.aiTrace.unavailable');
});

it('activates stored Studio context from AI details with its original workspace', async () => {
  const reference = { kind: 'element', id: 'title', label: 'Heading', origin: 'automatic' };
  const editorContext = {
    surface: 'studio',
    proposalId: '00000000-0000-4000-a000-000000000001',
    references: [reference],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ traces: [{ ...trace, prompt: { editorContext } }] }))
  );
  const activate = vi.fn();
  const { container } = render(
    <ProjectContextNavigation.Provider value={activate}>
      <AiTraceDetails messageId="message-1" />
    </ProjectContextNavigation.Provider>
  );
  const details = container.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  fireEvent.click(await screen.findByRole('button', { name: /Heading/ }));
  expect(activate).toHaveBeenCalledWith(reference, editorContext);
});
