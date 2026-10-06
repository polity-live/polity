/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  conversations: [] as { id: string; name: string }[],
  queryType: 'complete' as 'complete' | 'unknown',
  mutate: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: state.mutate }),
  useQuery: () => [state.conversations, { type: state.queryType }],
}));
vi.mock('@/zero/queries', () => ({ queries: { projectChat: { conversations: () => ({}) } } }));
vi.mock('@/zero/mutators', () => ({ mutators: { projectChat: { create: (x: unknown) => x } } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (s: string) => s.split('.').at(-1) }),
}));
vi.mock('../ProjectConversation', () => ({
  ProjectConversation: ({ conversationId, active, initialInstruction }: any) => (
    <p
      data-testid="project-conversation"
      data-active={String(active)}
      data-initial-instruction={initialInstruction}
    >
      Conversation {conversationId}
    </p>
  ),
}));
import { ProjectChatPanel, ProjectChatWorkspace } from '../ProjectChatPanel';
const scope = { kind: 'studio' as const, projectId: '00000000-0000-4000-a000-000000000001' };
beforeEach(() => {
  localStorage.clear();
  state.conversations = [];
  state.queryType = 'complete';
  state.mutate
    .mockReset()
    .mockReturnValue({ client: Promise.resolve(), server: Promise.resolve({ type: 'success' }) });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('resizes from edges and corner, clamps dimensions and retains size when reopened', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  state.conversations = [{ id: 'one', name: 'First' }];
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  const panel = screen.getByRole('dialog') as HTMLElement;
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => {
    const width = parseFloat(panel.style.width) || 400;
    const height = parseFloat(panel.style.height) || 500;
    return {
      width,
      height,
      right: 1000,
      bottom: 800,
      left: 1000 - width,
      top: 800 - height,
    } as DOMRect;
  });
  const pointer = (label: string, dx: number, dy: number, cancel = false) => {
    const handle = screen.getByRole('button', { name: label });
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = () => true;
    handle.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(handle, { button: 0, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { clientX: 400 + dx, clientY: 300 + dy });
    if (cancel) fireEvent.pointerCancel(handle);
    else fireEvent.pointerUp(handle);
    const width = panel.style.width;
    fireEvent.pointerMove(handle, { clientX: 0, clientY: 0 });
    expect(panel.style.width).toBe(width);
  };
  pointer('resizeWidth', -100, -100);
  expect(panel.style.width).toBe('500px');
  expect(panel.style.height).toBe('500px');
  pointer('resizeHeight', -100, -100, true);
  expect(panel.style.width).toBe('500px');
  expect(panel.style.height).toBe('600px');
  pointer('resize', -100, -100);
  expect(panel.style.width).toBe('600px');
  expect(panel.style.height).toBe('700px');
  pointer('resize', -2000, -2000);
  expect(panel.style.width).toBe('984px');
  expect(panel.style.height).toBe('792px');
  pointer('resize', 2000, 2000);
  expect(panel.style.width).toBe('280px');
  expect(panel.style.height).toBe('320px');
  fireEvent.keyDown(screen.getByRole('button', { name: 'resizeWidth' }), {
    key: 'ArrowLeft',
    shiftKey: true,
  });
  fireEvent.keyDown(screen.getByRole('button', { name: 'resizeHeight' }), { key: 'ArrowUp' });
  expect(panel.style.width).toBe('320px');
  expect(panel.style.height).toBe('330px');
  fireEvent.click(screen.getByRole('button', { name: 'minimize' }));
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  expect(panel.style.width).toBe('320px');
  expect(panel.style.height).toBe('330px');
});
it('keeps workspace content full width instead of creating a side-panel column', () => {
  const { container } = render(
    <ProjectChatWorkspace scope={scope} context={{ surface: 'studio' }}>
      <main data-testid="workspace-content">Workspace</main>
    </ProjectChatWorkspace>
  );
  expect(screen.getByTestId('workspace-content').parentElement).toBe(container);
  expect(container.querySelector('[data-project-chat-dock]')).toBeTruthy();
  expect(container.querySelector('aside')).toBeNull();
});
it('opens from a bottom dock, switches chats and restores focus when minimized', async () => {
  state.conversations = [
    { id: 'one', name: 'First' },
    { id: 'two', name: 'Second' },
  ];
  const { container } = render(
    <ProjectChatPanel
      scope={scope}
      context={{ surface: 'studio' }}
      initialInstruction="Create a campaign"
    />
  );
  const dock = container.querySelector('[data-project-chat-dock]');
  expect(dock?.className).toContain('--app-shell-mobile-bottom-offset');
  expect(dock?.className).toContain('--app-shell-desktop-right-offset');
  const open = screen.getByRole('button', { name: 'title' });
  expect(open.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('dialog', { name: 'title' })).toBeNull();
  expect(screen.getByTestId('project-conversation').getAttribute('data-active')).toBe('false');
  expect(screen.getByTestId('project-conversation').getAttribute('data-initial-instruction')).toBe(
    'Create a campaign'
  );

  fireEvent.click(open);
  expect(screen.getByRole('dialog', { name: 'title' })).toBeTruthy();
  expect(screen.getByTestId('project-conversation').getAttribute('data-active')).toBe('true');
  const choose = screen.getByLabelText('choose');
  expect(choose.closest('header')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'new' }).closest('header')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'new' }).textContent).toBe('');
  choose.focus();
  expect(document.activeElement).toBe(choose);
  fireEvent.change(choose, { target: { value: 'two' } });
  expect(screen.getByText('Conversation two')).toBeTruthy();
  expect(localStorage.getItem('project-chat:studio:' + scope.projectId)).toBe('two');

  fireEvent.click(screen.getByRole('button', { name: 'minimize' }));
  expect(screen.queryByRole('dialog', { name: 'title' })).toBeNull();
  expect(document.activeElement).toBe(open);
  expect(open.getAttribute('aria-expanded')).toBe('false');

  fireEvent.click(open);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'title' })).toBeNull();
  expect(document.activeElement).toBe(open);

  fireEvent.click(open);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'new' })));
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ scope, name: 'title 3' }));
});
it('creates the first chat automatically after the query resolves, and allows retry after an error', async () => {
  let reject!: (reason: Error) => void;
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: new Promise((_resolve, fail) => {
      reject = fail;
    }),
  });
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  expect(state.mutate).toHaveBeenCalledTimes(1);
  expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ scope, name: 'title 1' }));
  expect((screen.getByRole('button', { name: 'new' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error('Permission denied')));
  expect(screen.getByRole('alert').textContent).toContain('Permission denied');
  expect(state.mutate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'new' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(state.mutate).toHaveBeenCalledTimes(2);
});
it('waits for the conversation query before creating a first chat', () => {
  state.queryType = 'unknown';
  const { rerender } = render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  expect(state.mutate).not.toHaveBeenCalled();
  state.queryType = 'complete';
  rerender(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  expect(state.mutate).toHaveBeenCalledTimes(1);
});
it('shows the automatically created chat when it arrives in the conversation query', async () => {
  const { rerender } = render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  const created = state.mutate.mock.calls[0][0] as { id: string };
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'new' }) as HTMLButtonElement).disabled).toBe(false)
  );
  state.conversations = [{ id: created.id, name: 'First project chat' }];
  rerender(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  expect(screen.getByText(`Conversation ${created.id}`)).toBeTruthy();
  expect((screen.getByLabelText('choose') as HTMLSelectElement).value).toBe(created.id);
  expect(state.mutate).toHaveBeenCalledTimes(1);
});
