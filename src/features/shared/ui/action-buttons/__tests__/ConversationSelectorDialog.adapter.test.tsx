/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationSelectorDialog } from '../ConversationSelectorDialog';

const capture = vi.hoisted(() => vi.fn((props: Record<string, unknown>) => props));
vi.mock('../useConversationSelectorDialogController', () => ({
  useConversationSelectorDialogController: capture,
}));
vi.mock('../ConversationSelectorDialogView', () => ({
  ConversationSelectorDialogView: (props: { isLoading: boolean }) => (
    <div>selector:{String(props.isLoading)}</div>
  ),
}));

afterEach(cleanup);

describe('ConversationSelectorDialog adapter', () => {
  const required = {
    open: true,
    onOpenChange: vi.fn(),
    shareUrl: '/share',
    shareTitle: 'Share',
  };

  it('uses empty conversations and a non-loading default', () => {
    render(<ConversationSelectorDialog {...required} />);
    expect(capture).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversations: [], isLoading: false })
    );
    expect(screen.getByText('selector:false')).toBeTruthy();
  });

  it('forwards explicit conversations and loading state', () => {
    const conversations = [{ id: '1', name: 'One' }];
    render(<ConversationSelectorDialog {...required} conversations={conversations} isLoading />);
    expect(capture).toHaveBeenLastCalledWith(
      expect.objectContaining({ conversations, isLoading: true })
    );
  });
});
