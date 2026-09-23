/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectConversation } from '../ProjectConversation';
import { useProjectEditorBridge } from '../../hooks/editor-bridge';

const state = vi.hoisted(() => ({
  amendment: false,
  mutate: vi.fn(),
  fetch: vi.fn(),
  flush: vi.fn(),
  runs: [] as any[],
  changes: [] as any[],
  messages: [] as any[],
  lastControllerOptions: null as any,
}));
const projectId = '00000000-0000-4000-a000-000000000001';
const chatId = '00000000-0000-4000-a000-000000000002';

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'actor' }, session: { access_token: 'test-session' } }),
}));
vi.mock('@tanstack/react-router', () => ({
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
    messages: { conversationById: () => 'conversation', messagesWindow: () => 'messages' },
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
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: state.mutate }),
  useQuery: (query: string) => [
    query === 'conversation'
      ? {
          id: chatId,
          type: 'project_ai',
          status: 'accepted',
          pinned: false,
          requested_by_id: 'actor',
          studio_project_id: state.amendment ? null : projectId,
          amendment_id: state.amendment ? projectId : null,
          name: 'Shared design',
          messages: [],
          participants: [{ id: 'participant', user_id: 'actor' }],
        }
      : query === 'runs'
        ? state.runs
        : query === 'changes'
          ? state.changes
          : query === 'studioProject'
            ? { id: projectId, group_id: null }
            : query === 'messages'
              ? state.messages
              : [],
    { type: 'complete' },
  ],
}));
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
    <section data-testid="shared-assistant-chat" data-compact={String(props.compact)}>
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
      {props.contextActions}
      {props.timelineItems?.map((item: any) => (
        <div key={item.id}>{item.content}</div>
      ))}
    </section>
  ),
}));

function Editor() {
  useProjectEditorBridge({ kind: 'studio', projectId }, state.flush);
  return null;
}

beforeEach(() => {
  state.amendment = false;
  state.runs = [];
  state.changes = [];
  state.messages = [];
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
  expect(state.mutate).not.toHaveBeenCalledWith(
    expect.objectContaining({ markRead: expect.anything() })
  );

  ui.rerender(
    <ProjectConversation conversationId={chatId} context={{ surface: 'studio' }} active />
  );
  await waitFor(() =>
    expect(state.mutate).toHaveBeenCalledWith({
      markRead: { id: 'participant', last_read_at: expect.any(Number) },
    })
  );
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
