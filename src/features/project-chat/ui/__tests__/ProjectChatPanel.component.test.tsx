/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { flushSync } from 'react-dom';
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

it('opens, selects a conversation and minimizes by keyboard while preserving the mounted chat', async () => {
  const user = userEvent.setup();
  state.conversations = [
    { id: 'one', name: 'First' },
    { id: 'two', name: 'Second' },
  ];
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} />);
  const open = screen.getByRole('button', { name: 'title' });
  open.focus();
  await user.keyboard('{Enter}');
  const choose = screen.getByRole<HTMLSelectElement>('combobox', { name: 'choose' });
  expect(choose.value).toBe('one');
  choose.focus();
  await user.selectOptions(choose, 'two');
  expect(choose.value).toBe('two');
  expect(document.activeElement).toBe(choose);
  const content = screen.getByTestId('project-conversation');
  expect(content.textContent).toBe('Conversation two');
  expect(localStorage.getItem('project-chat:studio:' + scope.projectId)).toBe('two');
  await user.selectOptions(choose, 'one');
  expect(choose.value).toBe('one');
  expect(document.activeElement).toBe(choose);
  const minimizedContent = screen.getByTestId('project-conversation');
  const minimize = screen.getByRole('button', { name: 'minimize' });
  minimize.focus();
  await user.keyboard(' ');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(open);
  expect(minimizedContent.getAttribute('data-active')).toBe('false');
  await user.keyboard('{Enter}');
  expect(screen.getByTestId('project-conversation')).toBe(minimizedContent);
  expect(minimizedContent.getAttribute('data-active')).toBe('true');
  expect(choose.value).toBe('one');
  expect(state.mutate).not.toHaveBeenCalled();
});

it('creates a chat by keyboard, blocks duplicate submissions while pending and preserves control focus', async () => {
  const user = userEvent.setup();
  state.conversations = [{ id: 'one', name: 'First' }];
  let acknowledge!: (value: { type: 'success' }) => void;
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: new Promise(resolve => {
      acknowledge = resolve;
    }),
  });
  const ui = render(
    <ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />
  );
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'new' });
  expect(create.disabled).toBe(false);
  create.focus();
  await user.keyboard('{Enter}');
  expect(create.disabled).toBe(true);
  expect(document.activeElement).toBe(create);
  await user.keyboard('{Enter} ');
  expect(state.mutate).toHaveBeenCalledTimes(1);
  const command = state.mutate.mock.calls[0][0];
  expect(command).toEqual({ id: expect.any(String), scope, name: 'title 2' });
  await act(async () => acknowledge({ type: 'success' }));
  state.conversations = [...state.conversations, { id: command.id, name: 'Second' }];
  ui.rerender(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />);
  expect(create.disabled).toBe(false);
  expect(document.activeElement).toBe(create);
  expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(command.id);
  expect(screen.getByTestId('project-conversation').textContent).toBe(`Conversation ${command.id}`);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('reports create failures and permits a keyboard retry without losing the current conversation', async () => {
  const user = userEvent.setup();
  state.conversations = [{ id: 'one', name: 'First' }];
  state.mutate.mockReturnValueOnce({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'error', error: { message: 'Permission denied' } }),
  });
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />);
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'new' });
  create.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Permission denied'));
  expect(create.disabled).toBe(false);
  expect(document.activeElement).toBe(create);
  expect(screen.getByTestId('project-conversation').textContent).toBe('Conversation one');
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(state.mutate).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(create);
});

it('keeps chat creation disabled before its query completes and recovers from an unknown mutation failure', async () => {
  const user = userEvent.setup();
  state.queryType = 'unknown';
  state.conversations = [{ id: 'one', name: 'First' }];
  const ui = render(
    <ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />
  );
  const create = screen.getByRole<HTMLButtonElement>('button', { name: 'new' });
  expect(create.disabled).toBe(true);
  await user.click(create);
  expect(state.mutate).not.toHaveBeenCalled();
  state.queryType = 'complete';
  state.mutate.mockImplementationOnce(() => {
    throw 'Unknown failure';
  });
  ui.rerender(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />);
  create.focus();
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('failed'));
  expect(create.disabled).toBe(false);
  expect(document.activeElement).toBe(create);
  expect(screen.getByTestId('project-conversation').textContent).toBe('Conversation one');
});

it.each(['width', 'height', 'both'] as const)(
  'resizes the %s handle with keyboard, restores its dimensions and retains focus',
  async direction => {
    const user = userEvent.setup();
    state.conversations = [{ id: 'one', name: 'First' }];
    render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />);
    const panel = screen.getByRole('dialog');
    vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          width: parseFloat(panel.style.width) || 400,
          height: parseFloat(panel.style.height) || 500,
          right: 1000,
          bottom: 800,
        }) as DOMRect
    );
    const handle = screen.getByRole('button', {
      name:
        direction === 'both' ? 'resize' : direction === 'width' ? 'resizeWidth' : 'resizeHeight',
    });
    handle.focus();
    const initial = direction === 'height' ? '{ArrowUp}' : '{ArrowLeft}';
    const reverse = direction === 'height' ? '{ArrowDown}' : '{ArrowRight}';
    await user.keyboard(initial);
    expect(panel.style.width).toBe(direction === 'height' ? '400px' : '410px');
    expect(panel.style.height).toBe(direction === 'height' ? '510px' : '500px');
    expect(document.activeElement).toBe(handle);
    await user.keyboard(reverse);
    expect(panel.style.width).toBe('400px');
    expect(panel.style.height).toBe('500px');
    await user.keyboard('{Shift>}' + initial + '{/Shift}');
    expect(panel.style.width).toBe(direction === 'height' ? '400px' : '440px');
    expect(panel.style.height).toBe(direction === 'height' ? '540px' : '500px');
    await user.keyboard(
      direction === 'both'
        ? '{ArrowUp}{ArrowDown}'
        : direction === 'height'
          ? '{ArrowLeft}'
          : '{ArrowUp}'
    );
    expect(document.activeElement).toBe(handle);
    expect(state.mutate).not.toHaveBeenCalled();
  }
);

it('ignores unrelated pointers, handles lost capture and ends a drag after capture was released', () => {
  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  state.conversations = [{ id: 'one', name: 'First' }];
  render(<ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />);
  const panel = screen.getByRole('dialog');
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 500,
    right: 1000,
    bottom: 800,
  } as DOMRect);
  const handle = screen.getByRole('button', { name: 'resize' });
  handle.setPointerCapture = vi.fn();
  handle.hasPointerCapture = () => false;
  handle.releasePointerCapture = vi.fn();
  fireEvent.pointerDown(handle, { button: 2, pointerId: 1 });
  expect(handle.setPointerCapture).not.toHaveBeenCalled();
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  expect(handle.setPointerCapture).toHaveBeenCalledExactlyOnceWith(1);
  fireEvent.pointerMove(handle, { pointerId: 2, clientX: 50, clientY: 50 });
  fireEvent.pointerUp(handle, { pointerId: 2 });
  expect(panel.style.width).toBe('');
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 50, clientY: 50 });
  expect(panel.style.width).toBe('450px');
  expect(panel.style.height).toBe('550px');
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(handle.releasePointerCapture).not.toHaveBeenCalled();
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.lostPointerCapture(handle, { pointerId: 1 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 0, clientY: 0 });
  expect(panel.style.width).toBe('450px');
  expect(state.mutate).not.toHaveBeenCalled();
});

it.each(['start', 'move', 'keyboard'] as const)(
  'safely cancels %s resizing when navigation removes the panel during event capture',
  async phase => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    state.conversations = [{ id: 'one', name: 'First' }];
    function NavigationBoundary() {
      const [mounted, setMounted] = useState(true);
      const navigateAway = () => flushSync(() => setMounted(false));
      return (
        <div
          onPointerDownCapture={phase === 'start' ? navigateAway : undefined}
          onPointerMoveCapture={phase === 'move' ? navigateAway : undefined}
          onKeyDownCapture={phase === 'keyboard' ? navigateAway : undefined}
        >
          {mounted ? (
            <ProjectChatPanel scope={scope} context={{ surface: 'studio' }} initiallyOpen />
          ) : (
            <p>Another page</p>
          )}
        </div>
      );
    }
    render(<NavigationBoundary />);
    const handle = screen.getByRole('button', { name: 'resize' });
    handle.setPointerCapture = vi.fn();
    if (phase === 'keyboard') {
      handle.focus();
      await userEvent.setup().keyboard('{ArrowLeft}');
    } else {
      fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
      if (phase === 'move') fireEvent.pointerMove(handle, { clientX: 50, clientY: 50 });
    }
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Another page')).toBeTruthy();
    expect(state.mutate).not.toHaveBeenCalled();
  }
);
