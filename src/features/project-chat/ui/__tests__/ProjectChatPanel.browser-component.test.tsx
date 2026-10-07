import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  conversations: [] as { id: string; name: string }[],
  mutate: vi.fn(),
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: state.mutate }),
  useQuery: () => [state.conversations, { type: 'complete' }],
}));
vi.mock('@/zero/queries', () => ({ queries: { projectChat: { conversations: () => ({}) } } }));
vi.mock('@/zero/mutators', () => ({
  mutators: { projectChat: { create: (value: unknown) => value } },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key.split('.').at(-1),
    language: 'en',
    isGerman: false,
  }),
  translate: (key: string) => key,
}));
vi.mock('../ProjectConversation', () => ({
  ProjectConversation: ({
    conversationId,
    active,
  }: {
    conversationId: string;
    active: boolean;
  }) => (
    <p data-testid="conversation" data-active={String(active)}>
      {conversationId}
    </p>
  ),
}));
import { ProjectChatPanel } from '../ProjectChatPanel';

const scope = { kind: 'studio' as const, projectId: '00000000-0000-4000-a000-000000000001' };
const context = { surface: 'studio' as const };
beforeEach(async () => {
  await page.viewport(1280, 800);
  localStorage.clear();
  state.conversations = [
    { id: 'one', name: 'First' },
    { id: 'two', name: 'Second' },
  ];
  state.mutate.mockReset().mockReturnValue({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  });
});
afterEach(cleanup);

it('changes conversations with native arrow keys and restores dock focus after keyboard minimization', async () => {
  render(<ProjectChatPanel scope={scope} context={context} />);
  const open = screen.getByRole('button', { name: 'title' });
  open.focus();
  await userEvent.keyboard('{Enter}');
  const choose = screen.getByRole<HTMLSelectElement>('combobox', { name: 'choose' });
  choose.focus();
  expect(choose.value).toBe('one');
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(choose.value).toBe('two');
  expect(screen.getByTestId('conversation').textContent).toBe('two');
  expect(document.activeElement).toBe(choose);
  await userEvent.keyboard('{ArrowUp}{Enter}');
  expect(choose.value).toBe('one');
  expect(localStorage.getItem(`project-chat:studio:${scope.projectId}`)).toBe('one');
  const content = screen.getByTestId('conversation');
  screen.getByRole('button', { name: 'minimize' }).focus();
  await userEvent.keyboard(' ');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(open);
  expect(content.getAttribute('data-active')).toBe('false');
  await userEvent.keyboard('{Enter}');
  expect(screen.getByTestId('conversation')).toBe(content);
  expect(content.getAttribute('data-active')).toBe('true');
  expect(choose.value).toBe('one');
});

it('submits chat creation once from native keyboard and keeps its control focused through acknowledgement', async () => {
  let acknowledge!: (value: { type: 'success' }) => void;
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: new Promise(resolve => {
      acknowledge = resolve;
    }),
  });
  const ui = render(<ProjectChatPanel scope={scope} context={context} initiallyOpen />);
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'new' });
  create.focus();
  await userEvent.keyboard('{Enter}');
  expect(create.disabled).toBe(true);
  await userEvent.keyboard('{Enter} ');
  expect(state.mutate).toHaveBeenCalledTimes(1);
  const command = state.mutate.mock.calls[0][0];
  expect(command).toEqual({ id: expect.any(String), scope, name: 'title 3' });
  await act(async () => acknowledge({ type: 'success' }));
  state.conversations = [...state.conversations, { id: command.id, name: 'Third' }];
  ui.rerender(<ProjectChatPanel scope={scope} context={context} initiallyOpen />);
  expect(create.disabled).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(create));
  expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(command.id);
});

it('returns focus after a rejected keyboard creation and allows a native keyboard retry', async () => {
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'error', error: { message: 'Permission denied' } }),
  });
  render(<ProjectChatPanel scope={scope} context={context} initiallyOpen />);
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'new' });
  create.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Permission denied'));
  await waitFor(() => expect(document.activeElement).toBe(create));
  expect(create.disabled).toBe(false);
  expect(screen.getByTestId('conversation').textContent).toBe('one');
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(create));
  expect(state.mutate).toHaveBeenCalledTimes(2);
});

it('keeps focus on the dock when a pending creation completes after minimization', async () => {
  let acknowledge!: (value: { type: 'success' }) => void;
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: new Promise(resolve => {
      acknowledge = resolve;
    }),
  });
  const ui = render(<ProjectChatPanel scope={scope} context={context} initiallyOpen />);
  screen.getByRole('button', { name: 'new' }).focus();
  await userEvent.keyboard('{Enter}');
  screen.getByRole('button', { name: 'minimize' }).focus();
  await userEvent.keyboard('{Enter}');
  const open = screen.getByRole('button', { name: 'title' });
  expect(document.activeElement).toBe(open);
  await act(async () => acknowledge({ type: 'success' }));
  const command = state.mutate.mock.calls[0][0];
  state.conversations = [...state.conversations, { id: command.id, name: 'Third' }];
  ui.rerender(<ProjectChatPanel scope={scope} context={context} initiallyOpen />);
  expect(document.activeElement).toBe(open);
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByTestId('conversation').textContent).toBe(command.id);
});

it.each(['width', 'height', 'both'] as const)(
  'changes the %s resize handle with native arrow keys and keeps focus on the handle',
  async direction => {
    const { container } = render(
      <ProjectChatPanel scope={scope} context={context} initiallyOpen />
    );
    const dock = container.querySelector<HTMLElement>('[data-project-chat-dock]')!;
    Object.assign(dock.style, { position: 'fixed', right: '16px', bottom: '16px' });
    const panel = screen.getByRole('dialog');
    Object.assign(panel.style, { width: '400px', height: '400px' });
    const handle = screen.getByRole('button', {
      name:
        direction === 'both' ? 'resize' : direction === 'width' ? 'resizeWidth' : 'resizeHeight',
    });
    handle.focus();
    const key = direction === 'height' ? '{ArrowUp}' : '{ArrowLeft}';
    await userEvent.keyboard(key);
    expect(panel.style.width).toBe(direction === 'height' ? '400px' : '410px');
    expect(panel.style.height).toBe(direction === 'height' ? '410px' : '400px');
    expect(document.activeElement).toBe(handle);
    await userEvent.keyboard(direction === 'height' ? '{ArrowDown}' : '{ArrowRight}');
    expect(panel.style.width).toBe('400px');
    expect(panel.style.height).toBe('400px');
    expect(document.activeElement).toBe(handle);
    expect(state.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('conversation').textContent).toBe('one'));
  }
);
