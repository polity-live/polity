/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useContext } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectConversation } from '../ProjectConversation';
import { ProjectContextNavigation } from '../ProjectContextNavigation';

const io = vi.hoisted(() => ({
  user: { id: 'actor' } as { id: string } | null,
  conversation: null as any,
  messages: [] as any[],
  runs: [] as any[],
  changes: [] as any[],
  studio: null as any,
  assistant: {} as any,
  shared: null as any,
  composer: null as any,
  query: vi.fn(),
  mutate: vi.fn(),
  send: vi.fn(),
  options: null as any,
  navigate: vi.fn(),
  notify: vi.fn(),
  reference: { id: 'node', kind: 'element' } as any,
  sourceContext: undefined as any,
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: io.notify } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => io.navigate,
  Link: ({ children }: any) => <a href="/messages">{children}</a>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    messages: {
      conversationById: () => 'conversation',
      messagesWindow: (args: any) => ({ kind: 'messages', ...args }),
    },
    projectChat: { runs: () => 'runs', changes: () => 'changes' },
    studio: { project: () => 'studio' },
  },
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: (query: any) => {
    io.query(query);
    return [
      query === 'conversation'
        ? io.conversation
        : query === 'runs'
          ? io.runs
          : query === 'changes'
            ? io.changes
            : query === 'studio'
              ? io.studio
              : io.messages,
    ];
  },
}));
vi.mock('@/zero/mutators', () => ({
  mutators: {
    messages: {
      markRead: (input: any) => ({ action: 'markRead', input }),
      updateConversation: (input: any) => ({ action: 'update', input }),
      deleteConversationFull: (input: any) => ({ action: 'delete', input }),
    },
    projectChat: {
      join: (input: any) => ({ action: 'join', input }),
      setSurface: (input: any) => ({ action: 'surface', input }),
      cancel: (input: any) => ({ action: 'cancel', input }),
      undo: (input: any) => ({ action: 'undo', input }),
    },
  },
}));
vi.mock('../../hooks/useProjectComposerContext', () => ({
  useProjectComposerContext: () => io.composer,
}));
vi.mock('@/features/messages/hooks/useAssistantChat', () => ({
  useAssistantChat: (_conversation: any, _user: any, options: any) => {
    io.options = options;
    return { ...io.assistant };
  },
}));
vi.mock('@/features/messages/ui/AssistantMessageContentView', () => ({
  AssistantMessageContentView: (props: any) => {
    const activate = useContext(ProjectContextNavigation);
    io.shared = props;
    return (
      <section>
        {props.contextActions}
        {props.timelineItems.map((item: any) => (
          <div key={item.id}>{item.content}</div>
        ))}
        <button onClick={() => props.onTogglePin('conversation', false)}>Pin</button>
        <button onClick={() => props.onDeleteClick('conversation')}>Delete</button>
        <button onClick={props.onLoadOlderMessages}>Older</button>
        <button onClick={() => activate?.(io.reference, io.sourceContext)}>Focus context</button>
      </section>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  io.shared = null;
  io.reference = { id: 'node', kind: 'element' };
  io.sourceContext = undefined;
  io.navigate.mockResolvedValue(undefined);
  localStorage.clear();
  io.user = { id: 'actor' };
  io.conversation = {
    id: 'conversation',
    requested_by_id: 'actor',
    name: 'Chat',
    studio_project_id: 'project',
    participants: [{ id: 'participant', user_id: 'actor', last_read_at: 0 }],
    messages: [{ id: 'stored-message' }],
  };
  io.messages = [];
  io.runs = [];
  io.changes = [];
  io.studio = { title: 'Project', group_id: null };
  io.assistant = {
    selectedModel: { id: 'model' },
    isSending: false,
    streamingText: '',
    isThinking: false,
    isToolCalling: false,
    streamError: null,
    sendAssistantMessage: io.send,
  };
  io.composer = { liveContext: {}, references: [], options: [] };
  io.mutate.mockImplementation(() => ({ server: Promise.resolve({ type: 'success' }) }));
});

it('cancels only the actor run and preserves interrupted request identity and streaming tool previews', async () => {
  io.runs = [
    { id: 'running', actor_id: 'actor', status: 'running' },
    { id: 'previous', actor_id: 'actor', status: 'interrupted', request_id: 'request' },
  ];
  io.assistant.activeToolCall = { preview: { title: 'Tool preview' } };
  render(<ProjectConversation conversationId="conversation" />);
  expect(io.options.project.resumeRequestId).toBe('request');
  expect(io.shared.streamingAssistantMessage.toolPreview).toEqual({ title: 'Tool preview' });
  await io.options.project.onCancel();
  expect(io.mutate).toHaveBeenCalledWith({ action: 'cancel', input: { runId: 'running' } });
  cleanup();
  io.runs = [{ id: 'another', actor_id: 'other', status: 'running' }];
  render(<ProjectConversation conversationId="conversation" />);
  expect(io.options.project.onCancel).toBeUndefined();
  expect(io.options.project.externallyBusy).toBe(true);
});

it('uses the anonymous project title fallback and preserves amendment branch deep links', () => {
  io.studio = null;
  io.conversation.name = null;
  io.user = null;
  render(<ProjectConversation conversationId="conversation" />);
  expect(io.shared.currentUserId).toBeUndefined();
  cleanup();
  io.conversation.studio_project_id = null;
  io.conversation.amendment_id = 'amendment';
  render(
    <ProjectConversation
      conversationId="conversation"
      context={{ surface: 'amendment_text', branchId: 'branch' }}
    />
  );
  expect(screen.getByRole('link', { name: 'project' }).getAttribute('href')).toBe(
    '/amendment/amendment/text?conversationId=conversation&branch=branch'
  );
});

it.each([undefined, {}, { proposalId: 'proposal' }])(
  'opens canonical and proposal node references using the available source context %s',
  async source => {
    io.sourceContext = source;
    render(<ProjectConversation conversationId="conversation" />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus context' }));
    await waitFor(() =>
      expect(io.navigate).toHaveBeenCalledWith({
        to: '/studio/$projectId',
        params: { projectId: 'project' },
        search: {
          conversationId: 'conversation',
          workspaceId: source?.proposalId,
          focusNodeId: 'node',
        },
      })
    );
  }
);

it('ignores non-node context references and reports a rejected navigation without losing the conversation', async () => {
  io.reference = { id: 'message', kind: 'message' };
  render(<ProjectConversation conversationId="conversation" />);
  fireEvent.click(screen.getByRole('button', { name: 'Focus context' }));
  expect(io.navigate).not.toHaveBeenCalled();
  io.reference = { id: 'node', kind: 'element' };
  io.navigate.mockRejectedValueOnce(new Error('Navigation unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Focus context' }));
  await waitFor(() => expect(io.notify).toHaveBeenCalledExactlyOnceWith('focusFailed'));
  expect(screen.getByRole('button', { name: 'Pin' })).toBeTruthy();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('reports absent conversations and non-project conversations without mounting a composer', () => {
  io.conversation = null;
  const view = render(<ProjectConversation conversationId="conversation" />);
  expect(screen.getByText('unavailable')).toBeTruthy();
  expect(io.shared).toBeNull();
  io.conversation = { participants: [], messages: [] };
  view.rerender(<ProjectConversation conversationId="conversation" />);
  expect(screen.getByText('unavailable')).toBeTruthy();
});

it('joins a missing participant once and leaves unauthenticated visitors out of the conversation', async () => {
  io.conversation.participants = [];
  const view = render(<ProjectConversation conversationId="conversation" />);
  await waitFor(() =>
    expect(io.mutate).toHaveBeenCalledWith({
      action: 'join',
      input: { conversationId: 'conversation', participantId: expect.any(String) },
    })
  );
  view.rerender(<ProjectConversation conversationId="conversation" />);
  expect(io.mutate).toHaveBeenCalledTimes(1);
  io.user = null;
  view.rerender(<ProjectConversation conversationId="conversation" />);
  expect(io.shared.canManage).toBe(false);
  expect(io.mutate).toHaveBeenCalledTimes(1);
});

it('loads older windows up to the bounded limit and delegates externally supplied pagination', () => {
  io.messages = Array.from({ length: 80 }, (_, i) => ({ id: `message-${i}`, created_at: i }));
  const view = render(<ProjectConversation conversationId="conversation" />);
  expect(io.shared.hasMoreOlderMessages).toBe(true);
  for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Older' }));
  expect(io.query).toHaveBeenCalledWith({
    kind: 'messages',
    conversation_id: 'conversation',
    limit: 500,
  });
  expect(io.shared.hasMoreOlderMessages).toBe(false);
  const older = vi.fn();
  view.rerender(
    <ProjectConversation
      conversationId="conversation"
      messages={[]}
      hasMoreOlderMessages
      onLoadOlderMessages={older}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Older' }));
  expect(older).toHaveBeenCalledTimes(1);
  expect(io.shared.messages).toEqual([]);
});

it('pins, renames and confirms deletion with the complete stored message and participant identifiers', async () => {
  render(<ProjectConversation conversationId="conversation" />);
  fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
  expect(io.mutate).toHaveBeenCalledWith({
    action: 'update',
    input: { id: 'conversation', pinned: true },
  });
  expect(await io.shared.onRenameConversation('conversation', 'Renamed')).toBe(true);
  expect(io.mutate).toHaveBeenCalledWith({
    action: 'update',
    input: { id: 'conversation', name: 'Renamed' },
  });
  io.mutate.mockImplementationOnce(() => ({ server: Promise.reject(new Error('Denied')) }));
  expect(await io.shared.onRenameConversation('conversation', null)).toBe(false);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(io.mutate).toHaveBeenCalledTimes(3);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(io.mutate).toHaveBeenCalledWith({
    action: 'delete',
    input: {
      id: 'conversation',
      messageIds: ['stored-message'],
      participantIds: ['participant'],
    },
  });
  for (const key of ['onBack', 'onMembersClick', 'onAcceptConversation', 'onRejectConversation'])
    expect(io.shared[key]()).toBeUndefined();
});

it.each(['city_design', 'amendment_text'] as const)(
  'restores the participant surface %s and persists a subsequent surface choice',
  surface => {
    io.conversation.studio_project_id = null;
    io.conversation.amendment_id = 'amendment';
    io.conversation.participants[0].project_surface = surface;
    const view = render(<ProjectConversation conversationId="conversation" />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(surface);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'city_design' } });
    expect(localStorage.getItem('project-chat-surface:actor:conversation')).toBe('city_design');
    expect(io.mutate).toHaveBeenCalledWith({
      action: 'surface',
      input: { conversationId: 'conversation', surface: 'city_design' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'amendment_text' } });
    expect(io.mutate).toHaveBeenCalledWith({
      action: 'surface',
      input: { conversationId: 'conversation', surface: 'amendment_text' },
    });
    const updated = surface === 'city_design' ? 'amendment_text' : 'city_design';
    io.conversation.participants[0].project_surface = updated;
    view.rerender(<ProjectConversation conversationId="conversation" />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(updated);
  }
);

it('uses the local surface fallback and renders the same project header on the server without browser storage', () => {
  io.conversation.studio_project_id = null;
  io.conversation.amendment_id = 'amendment';
  localStorage.setItem('project-chat-surface:actor:conversation', 'city_design');
  render(<ProjectConversation conversationId="conversation" />);
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('city_design');
  cleanup();
  vi.stubGlobal('window', undefined);
  const html = renderToString(<ProjectConversation conversationId="conversation" />);
  expect(html).toContain('/amendment/amendment/text?conversationId=conversation');
});

it('starts an empty conversation briefing once and waits for a model and an idle assistant', () => {
  io.assistant.selectedModel = null;
  const view = render(
    <ProjectConversation conversationId="conversation" initialInstruction="Briefing" />
  );
  expect(io.send).not.toHaveBeenCalled();
  io.assistant.selectedModel = { id: 'model' };
  io.assistant.isSending = true;
  view.rerender(
    <ProjectConversation conversationId="conversation" initialInstruction="Briefing" />
  );
  expect(io.send).not.toHaveBeenCalled();
  io.assistant.isSending = false;
  view.rerender(
    <ProjectConversation conversationId="conversation" initialInstruction="Briefing" />
  );
  expect(io.send).toHaveBeenCalledExactlyOnceWith('Briefing');
  view.rerender(
    <ProjectConversation conversationId="conversation" initialInstruction="Briefing" />
  );
  expect(io.send).toHaveBeenCalledTimes(1);
});
