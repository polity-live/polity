/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  conversations: [] as { id: string; name: string }[],
  mutate: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: state.mutate }),
  useQuery: () => [state.conversations],
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
  state.mutate
    .mockReset()
    .mockReturnValue({ client: Promise.resolve(), server: Promise.resolve({ type: 'success' }) });
});
afterEach(cleanup);
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
it('shows creation progress, prevents duplicate submission and retains errors for retry', async () => {
  let reject!: (reason: Error) => void;
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: new Promise((_resolve, fail) => {
      reject = fail;
    }),
  });
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'title' }));
  fireEvent.click(screen.getByRole('button', { name: 'start' }));
  expect((screen.getByRole('button', { name: 'new' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error('Permission denied')));
  expect(screen.getByRole('alert').textContent).toContain('Permission denied');
  fireEvent.click(screen.getByRole('button', { name: 'start' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(state.mutate).toHaveBeenCalledTimes(2);
});
