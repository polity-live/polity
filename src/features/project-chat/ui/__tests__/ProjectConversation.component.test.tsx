/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectConversation } from '../ProjectConversation';
import { ProjectContextChips } from '../ProjectContextChips';
import { useProjectEditorBridge } from '../../hooks/editor-bridge';

const state = vi.hoisted(() => ({
  amendment: false,
  navigate: vi.fn(),
  focus: vi.fn().mockResolvedValue(undefined),
  groupId: null as string | null,
  editorWorkspaceId: null as string | null,
  contextReferences: [] as any[],
  sourceContext: undefined as any,
  mutate: vi.fn(),
  fetch: vi.fn(),
  flush: vi.fn(),
  runs: [] as any[],
  changes: [] as any[],
  messages: [] as any[],
  lastReadAt: 0,
  participantId: 'participant',
  revision: 0,
  listeners: new Set<() => void>(),
  lastControllerOptions: null as any,
}));
const projectId = '00000000-0000-4000-a000-000000000001';
const chatId = '00000000-0000-4000-a000-000000000002';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'actor' }, session: { access_token: 'test-session' } }),
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => state.navigate,
  Link: ({ to, search, children, ...props }: any) => (
    <a
      href={`${to}${search?.conversationId ? `?conversationId=${search.conversationId}` : ''}`}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    messages: {
      conversationById: ({ id }: any) => ({ kind: 'conversation', id }),
      messagesWindow: ({ conversation_id }: any) => ({ kind: 'messages', id: conversation_id }),
    },
    projectChat: { runs: () => 'runs', changes: () => 'changes' },
    studio: { project: () => 'studioProject' },
  },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    messages: { markRead: (args: unknown) => ({ markRead: args }) },
    projectChat: {
      setSurface: (args: unknown) => ({ setSurface: args }),
      join: (args: unknown) => ({ join: args }),
      cancel: (args: unknown) => ({ cancel: args }),
      undo: (args: unknown) => ({ undo: args }),
    },
  },
}));
vi.mock('@rocicorp/zero/react', async () => {
  const { useSyncExternalStore } = await vi.importActual<typeof import('react')>('react');
  const zero = { mutate: state.mutate };
  const subscribe = (listener: () => void) => {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
  };
  return {
    useZero: () => zero,
    useQuery: (query: any) => {
      useSyncExternalStore(subscribe, () => state.revision);
      return [
        query?.kind === 'conversation'
          ? {
              id: query.id,
              type: 'project_ai',
              status: 'accepted',
              pinned: false,
              requested_by_id: 'actor',
              studio_project_id: state.amendment ? null : projectId,
              amendment_id: state.amendment ? projectId : null,
              name: 'Shared design',
              messages: [],
              participants: [
                { id: state.participantId, user_id: 'actor', last_read_at: state.lastReadAt },
              ],
            }
          : query === 'runs'
            ? state.runs
            : query === 'changes'
              ? state.changes
              : query === 'studioProject'
                ? { id: projectId, group_id: state.groupId }
                : query?.kind === 'messages'
                  ? state.messages
                  : [],
        { type: 'complete' },
      ];
    },
  };
});
vi.mock('@/features/messages/hooks/useMessageMutations', () => ({
  useMessageMutations: () => ({
    togglePin: vi.fn(),
    updateConversationName: vi.fn().mockResolvedValue({ success: true }),
    deleteConversation: vi.fn(),
  }),
}));
vi.mock('@/features/messages/hooks/useAssistantChat', async () => {
  const { useState } = await vi.importActual<typeof import('react')>('react');
  return {
    useAssistantChat: (_conversation: unknown, _userId: unknown, options: any) => {
      state.lastControllerOptions = options;
      const [error, setError] = useState<string | null>(null);
      return {
        selectedModel: { provider: 'openai', id: 'model' },
        isSending: Boolean(options.project.externallyBusy),
        streamingText: '',
        isThinking: false,
        isToolCalling: false,
        isCompressing: false,
        streamError: error,
        activeToolName: null,
        activeToolCall: null,
        canRetry: false,
        retryLastAssistantMessage: vi.fn(),
        resolveAttachmentCardData: vi.fn(),
        sendAssistantMessage: async (content: string) => {
          try {
            const editorContext = await options.project.beforeSend();
            await fetch('/api/ai/chat', {
              method: 'POST',
              body: JSON.stringify({
                conversationId: chatId,
                requestId: crypto.randomUUID(),
                content,
                editorContext,
              }),
            });
            return true;
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
            return false;
          }
        },
      };
    },
  };
});
vi.mock('@/features/messages/ui/AssistantMessageContentView', () => ({
  AssistantMessageContentView: (props: any) => (
    <section
      data-testid="shared-assistant-chat"
      data-compact={String(props.compact)}
      data-active={String(props.active)}
    >
      <button
        type="button"
        disabled={props.assistantChat.isSending}
        onClick={() => void props.assistantChat.sendAssistantMessage('Change the selected heading')}
      >
        send
      </button>
      {props.assistantChat.streamError ? (
        <p role="alert">{props.assistantChat.streamError}</p>
      ) : null}
      {props.streamingAssistantMessage?.text ? <p>{props.streamingAssistantMessage.text}</p> : null}
      <ProjectContextChips
        references={state.contextReferences}
        sourceContext={state.sourceContext}
      />
      {props.contextActions}
      {props.timelineItems?.map((item: any) => (
        <div key={item.id}>{item.content}</div>
      ))}
    </section>
  ),
}));

function Editor() {
  useProjectEditorBridge(
    { kind: 'studio', projectId },
    state.flush,
    {
      context: {
        surface: 'studio',
        pageId: 'page',
        elementIds: ['selected'],
        proposalId: state.editorWorkspaceId,
      },
    },
    state.focus
  );
  return null;
}

function publishQueryUpdate() {
  state.revision += 1;
  state.listeners.forEach(listener => listener());
}

function message(createdAt: number, id = `message-${createdAt}`) {
  return {
    id,
    conversation_id: chatId,
    sender_id: 'colleague',
    content: 'Update',
    created_at: createdAt,
    updated_at: createdAt,
  };
}

beforeEach(() => {
  state.groupId = null;
  state.editorWorkspaceId = null;
  state.contextReferences = [];
  state.sourceContext = undefined;
  state.navigate.mockReset();
  state.focus.mockReset().mockResolvedValue(undefined);
  state.amendment = false;
  state.runs = [];
  state.changes = [];
  state.messages = [];
  state.lastReadAt = 0;
  state.participantId = 'participant';
  state.revision = 0;
  state.fetch.mockReset().mockResolvedValue(new Response('{}'));
  state.mutate.mockReset().mockReturnValue({ server: Promise.resolve({ type: 'success' }) });
  state.flush.mockReset().mockResolvedValue({
    surface: 'studio',
    pageId: 'page',
    elementIds: ['selected'],
  });
  vi.stubGlobal('fetch', state.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('dismisses project information and links while keeping the conversation usable', () => {
  const { rerender } = render(
    <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} compact />
  );
  expect(screen.getByText('shared')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'project' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'messages' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'dismissContext' }));
  expect(screen.queryByText('shared')).toBeNull();
  expect(screen.queryByRole('link', { name: 'project' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'messages' })).toBeNull();
  expect(screen.getByRole('button', { name: 'send' })).toBeTruthy();
  rerender(
    <ProjectConversation
      conversationId={chatId}
      context={{ surface: 'studio' }}
      compact
      active={false}
    />
  );
  rerender(
    <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} compact active />
  );
  expect(screen.queryByText('shared')).toBeNull();
});

it('keeps a minimized conversation mounted without marking messages as read', async () => {
  state.messages = [
    {
      id: 'message-1',
      conversation_id: chatId,
      sender_id: 'colleague',
      content: 'Unread update',
      created_at: 1,
      updated_at: 1,
    },
  ];
  const ui = render(
    <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} active={false} />
  );
  const content = screen.getByTestId('shared-assistant-chat');
  expect(content.getAttribute('data-active')).toBe('false');
  expect(state.mutate).not.toHaveBeenCalledWith(
    expect.objectContaining({ markRead: expect.anything() })
  );

  ui.rerender(
    <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} active />
  );
  expect(screen.getByTestId('shared-assistant-chat')).toBe(content);
  expect(content.getAttribute('data-active')).toBe('true');
  await waitFor(() =>
    expect(state.mutate).toHaveBeenCalledWith({
      markRead: { id: 'participant', last_read_at: expect.any(Number) },
    })
  );
});

it('settles after Zero reactively replaces the participant when marking a message read', async () => {
  state.messages = [message(100)];
  state.mutate.mockImplementation(({ markRead }: any) => {
    state.lastReadAt = markRead.last_read_at;
    // Bound feedback so the regression fails instead of hanging the test runner.
    if (state.mutate.mock.calls.length <= 5) queueMicrotask(publishQueryUpdate);
    return { server: Promise.resolve({ type: 'success' }) };
  });

  render(<ProjectConversation conversationId={chatId} />);
  await act(async () => undefined);
  expect(state.mutate).toHaveBeenCalledOnce();
  expect(state.lastReadAt).toBeGreaterThanOrEqual(100);
  expect(screen.getByRole('link', { name: 'project' })).toBeTruthy();
});

it('deduplicates pending read requests through Strict Mode and stale query updates', async () => {
  state.messages = [message(100)];
  let confirm!: (result: { type: 'success' }) => void;
  state.mutate.mockReturnValue({
    server: new Promise(resolve => {
      confirm = resolve;
    }),
  });
  const ui = render(
    <StrictMode>
      <ProjectConversation conversationId={chatId} />
    </StrictMode>
  );
  await act(async () => publishQueryUpdate());
  ui.rerender(
    <StrictMode>
      <ProjectConversation conversationId={chatId} active={false} />
    </StrictMode>
  );
  ui.rerender(
    <StrictMode>
      <ProjectConversation conversationId={chatId} active />
    </StrictMode>
  );
  await act(async () => confirm({ type: 'success' }));
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledOnce();
});

it('does not write for empty or already-read message windows', async () => {
  const ui = render(<ProjectConversation conversationId={chatId} />);
  expect(state.mutate).not.toHaveBeenCalled();
  state.messages = [message(100)];
  state.lastReadAt = 100;
  await act(async () => publishQueryUpdate());
  state.lastReadAt = 200;
  ui.rerender(<ProjectConversation conversationId={chatId} />);
  expect(state.mutate).not.toHaveBeenCalled();
});

it('only marks newer messages, not older history, participant updates or streaming', async () => {
  state.messages = [message(100)];
  render(<ProjectConversation conversationId={chatId} />);
  expect(state.mutate).toHaveBeenCalledOnce();

  state.messages = [message(50), message(100)];
  state.runs = [{ id: 'run', actor_id: 'colleague', status: 'running', partial_text: 'Thinking' }];
  await act(async () => publishQueryUpdate());
  state.runs = [{ ...state.runs[0], streaming_text: ' more' }];
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledOnce();
  expect(screen.getByText('Thinking more')).toBeTruthy();

  // This server timestamp can exceed the local clock and must still be covered.
  const newerAt = Date.now() + 10_000;
  state.messages = [...state.messages, message(newerAt)];
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledTimes(2);
  expect(state.mutate).toHaveBeenLastCalledWith({
    markRead: { id: 'participant', last_read_at: newerAt },
  });
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledTimes(2);
});

it('marks messages received while minimized only after reopening', async () => {
  state.messages = [message(100)];
  state.lastReadAt = 100;
  const ui = render(<ProjectConversation conversationId={chatId} active={false} />);
  state.messages = [message(200), ...state.messages];
  await act(async () => publishQueryUpdate());
  expect(state.mutate).not.toHaveBeenCalled();
  ui.rerender(<ProjectConversation conversationId={chatId} active />);
  await act(async () => undefined);
  expect(state.mutate).toHaveBeenCalledOnce();
});

it('keeps the read guard scoped to the conversation and participant', async () => {
  state.messages = [message(100)];
  const ui = render(<ProjectConversation conversationId={chatId} />);
  expect(state.mutate).toHaveBeenCalledOnce();
  ui.rerender(<ProjectConversation conversationId={`${chatId}-other`} />);
  expect(state.mutate).toHaveBeenCalledTimes(2);
  state.participantId = 'other-participant';
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledTimes(3);
  expect(state.mutate).toHaveBeenLastCalledWith({
    markRead: { id: 'other-participant', last_read_at: expect.any(Number) },
  });
});

it('catches a rejected read update without looping and retries for a newer message', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.messages = [message(100)];
  state.mutate.mockReturnValueOnce({
    server: Promise.resolve({ type: 'error', error: { message: 'Read rejected' } }),
  });
  render(<ProjectConversation conversationId={chatId} />);
  await act(async () => undefined);
  expect(log).toHaveBeenCalledWith('Failed to mark project messages as read:', expect.any(Error));
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledOnce();
  state.messages = [message(200)];
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledTimes(2);
});

it('retries a failed read on reopening even when rejection arrives while minimized', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  state.messages = [message(100)];
  let reject!: (error: Error) => void;
  state.mutate.mockReturnValueOnce({
    server: new Promise((_resolve, rejectPromise) => {
      reject = rejectPromise;
    }),
  });
  const ui = render(<ProjectConversation conversationId={chatId} />);
  ui.rerender(<ProjectConversation conversationId={chatId} active={false} />);
  await act(async () => reject(new Error('Offline')));
  await act(async () => publishQueryUpdate());
  expect(state.mutate).toHaveBeenCalledOnce();
  ui.rerender(<ProjectConversation conversationId={chatId} active />);
  await act(async () => undefined);
  expect(state.mutate).toHaveBeenCalledTimes(2);
});

it('starts an initial Studio briefing while the dock is minimized', async () => {
  render(
    <>
      <Editor />
      <ProjectConversation
        conversationId={chatId}
        context={{ surface: 'studio' }}
        initialInstruction="Prepare the launch"
        active={false}
      />
    </>
  );
  await waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toMatchObject({
    conversationId: chatId,
    content: 'Prepare the launch',
  });
});

it('uses the shared assistant view, flushes the editor and sends through the existing transport', async () => {
  render(
    <>
      <Editor />
      <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} compact />
    </>
  );
  expect(screen.getByTestId('shared-assistant-chat').getAttribute('data-compact')).toBe('true');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'send' })));
  await waitFor(() => expect(state.fetch).toHaveBeenCalledOnce());
  expect(JSON.parse(state.fetch.mock.calls[0][1].body)).toMatchObject({
    conversationId: chatId,
    content: 'Change the selected heading',
    editorContext: { surface: 'studio', pageId: 'page', elementIds: ['selected'] },
  });
  expect(state.lastControllerOptions.project.projectTools).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'studio_read', alwaysActive: true })])
  );
  expect(screen.getByRole('link', { name: 'messages' }).getAttribute('href')).toBe(
    `/messages?conversationId=${chatId}`
  );
});

it('does not start an AI run if the editor cannot confirm its save', async () => {
  state.flush.mockRejectedValue(new Error('Unsaved conflict'));
  render(
    <>
      <Editor />
      <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} />
    </>
  );
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'send' })));
  expect((await screen.findByRole('alert')).textContent).toContain('Unsaved conflict');
  expect(state.fetch).not.toHaveBeenCalled();
});

it('shows shared progress and offers undo for an applied change by the current sender', async () => {
  state.runs = [
    { id: 'run', actor_id: 'colleague', status: 'running', partial_text: 'Shared progress' },
  ];
  state.changes = [
    {
      id: 'change',
      actor_id: 'actor',
      status: 'applied',
      summary: 'Updated heading',
      created_at: 1,
    },
  ];
  render(<ProjectConversation conversationId={chatId} />);
  expect(screen.getByText('Shared progress')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'undo' })));
  expect(state.mutate).toHaveBeenCalledWith({ undo: { changeSetId: 'change' } });
});

it('links to the project and review and saves the selected amendment surface', async () => {
  state.amendment = true;
  state.changes = [
    { id: 'proposal', actor_id: 'actor', status: 'proposed', summary: 'Proposal', created_at: 1 },
  ];
  render(<ProjectConversation conversationId={chatId} />);
  expect(screen.getByRole('link', { name: 'project' }).getAttribute('href')).toContain('/text?');
  const select = screen.getByRole('combobox');
  select.focus();
  expect(document.activeElement).toBe(select);
  await act(async () => fireEvent.change(select, { target: { value: 'city_design' } }));
  expect(state.mutate).toHaveBeenCalledWith({
    setSurface: { conversationId: chatId, surface: 'city_design' },
  });
  expect(screen.getByRole('link', { name: 'project' }).getAttribute('href')).toContain(
    '/citydesign?'
  );
  expect(screen.getByRole('link', { name: 'review' }).getAttribute('href')).toContain(
    '/citydesign?'
  );
});

it.each([null, 'group-1'])(
  'opens the correct Studio route from Messages and retains the conversation (%s)',
  async groupId => {
    state.groupId = groupId;
    state.contextReferences = [
      {
        kind: 'element',
        id: 'title',
        label: 'Heading',
        origin: 'automatic',
        workspaceId: '00000000-0000-4000-a000-000000000003',
      },
    ];
    render(<ProjectConversation conversationId={chatId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'element · Heading' }));
    await waitFor(() =>
      expect(state.navigate).toHaveBeenCalledWith({
        to: groupId ? '/group/$id/studio/$projectId' : '/studio/$projectId',
        params: groupId ? { id: groupId, projectId } : { projectId },
        search: {
          conversationId: chatId,
          workspaceId: '00000000-0000-4000-a000-000000000003',
          focusNodeId: 'title',
        },
      })
    );
  }
);
it('resolves legacy original references against their message context instead of the current draft', async () => {
  state.editorWorkspaceId = '00000000-0000-4000-a000-000000000099';
  state.contextReferences = [
    { kind: 'element', id: 'title', label: 'Heading', origin: 'automatic' },
  ];
  state.sourceContext = { surface: 'studio', proposalId: null };
  render(
    <>
      <Editor />
      <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} />
    </>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'element · Heading' }));
  await waitFor(() =>
    expect(state.focus).toHaveBeenCalledWith({ nodeId: 'title', workspaceId: null })
  );
  expect(state.navigate).not.toHaveBeenCalled();
});
