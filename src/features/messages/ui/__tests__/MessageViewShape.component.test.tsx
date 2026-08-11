/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageView } from '../MessageView';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock('../AssistantMessageView', () => ({
  AssistantMessageView: () => null,
}));
vi.mock('../ConversationHeader', () => ({
  ConversationHeader: () => null,
}));
vi.mock('../MessageInput', () => ({
  MessageInput: () => null,
}));
vi.mock('../MessageList', () => ({
  MessageList: () => null,
}));

describe('regular message view surface', () => {
  it('removes the card surface on mobile and restores it on desktop', () => {
    const { container } = render(
      <MessageView
        isConversationUserOnline={false}
        onBack={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteClick={vi.fn()}
        onMembersClick={vi.fn()}
        onRenameConversation={vi.fn()}
        onSendMessage={vi.fn()}
        onAcceptConversation={vi.fn()}
        onRejectConversation={vi.fn()}
      />
    );

    const surface = container.querySelector('[data-slot="card"]');
    expect(surface?.className).toContain('rounded-none');
    expect(surface?.className).toContain('border-0');
    expect(surface?.className).toContain('bg-transparent');
    expect(surface?.className).toContain('shadow-none');
    expect(surface?.className).toContain('md:rounded-lg');
    expect(surface?.className).toContain('md:border');
    expect(surface?.className).toContain('md:bg-card');
    expect(surface?.className).toContain('md:shadow-[var(--shadow-panel)]');
  });
});
