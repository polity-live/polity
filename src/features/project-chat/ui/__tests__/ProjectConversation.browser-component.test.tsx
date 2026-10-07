import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ProjectConversation } from '../ProjectConversation';

const io = vi.hoisted(() => ({
  conversation: {
    id: 'conversation',
    requested_by_id: 'actor',
    name: 'Project chat',
    studio_project_id: 'project',
    participants: [{ id: 'participant', user_id: 'actor', last_read_at: 0 }],
    messages: [],
  },
  empty: [],
  mutate: vi.fn(),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'actor' } }) }));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    messages: { conversationById: () => 'conversation', messagesWindow: () => 'messages' },
    projectChat: { runs: () => 'runs', changes: () => 'changes' },
    studio: { project: () => 'studio' },
  },
}));
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate: io.mutate }),
  useQuery: (query: string) => [
    query === 'conversation'
      ? io.conversation
      : query === 'studio'
        ? { title: 'Studio project', group_id: null }
        : io.empty,
  ],
}));
vi.mock('@/zero/mutators', () => ({ mutators: {} }));
vi.mock('../../hooks/useProjectComposerContext', () => ({
  useProjectComposerContext: () => ({ liveContext: {}, references: [], options: [] }),
}));
vi.mock('@/features/messages/hooks/useAssistantChat', () => ({
  useAssistantChat: () => ({
    selectedModel: { id: 'model' },
    isSending: false,
    streamingText: '',
    isThinking: false,
    isToolCalling: false,
    streamError: null,
  }),
}));
vi.mock('@/features/messages/ui/AssistantMessageContentView', () => ({
  AssistantMessageContentView: ({ contextActions }: any) => (
    <div>
      {contextActions}
      <textarea aria-label="Chat composer" />
    </div>
  ),
}));

it.each(['{Enter}', ' '] as const)(
  'dismisses the project context toolbar with native %s activation and continues keyboard focus in the composer',
  async key => {
    const ui = render(<ProjectConversation conversationId="conversation" />);
    const dismiss = screen.getByRole('button', { name: 'features.projectChat.dismissContext' });
    expect(dismiss.getAttribute('data-action-id')).toBe(
      'project-chat.context-toolbar.dismiss.button'
    );
    expect(
      screen.getByRole('link', { name: 'features.projectChat.project' }).getAttribute('href')
    ).toBe('/studio/project?conversationId=conversation');
    dismiss.focus();
    expect(document.activeElement).toBe(dismiss);
    await userEvent.keyboard(key);
    expect(
      screen.queryByRole('button', { name: 'features.projectChat.dismissContext' })
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'features.projectChat.project' })).toBeNull();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Chat composer' }));
    ui.rerender(<ProjectConversation conversationId="conversation" active={false} />);
    ui.rerender(<ProjectConversation conversationId="conversation" active />);
    expect(
      screen.queryByRole('button', { name: 'features.projectChat.dismissContext' })
    ).toBeNull();
    expect(io.mutate).not.toHaveBeenCalled();
  }
);
