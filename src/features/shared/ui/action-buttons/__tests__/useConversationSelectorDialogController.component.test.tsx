/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useConversationSelectorDialogController } from '../useConversationSelectorDialogController';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

const requiredProps = {
  open: true,
  onOpenChange: vi.fn(),
  shareUrl: '/group/group-1',
  shareTitle: 'Civic Lab',
};

describe('useConversationSelectorDialogController', () => {
  it('uses defaults and safely ignores sharing without a callback', async () => {
    const { result } = renderHook(() => useConversationSelectorDialogController(requiredProps));

    expect(result.current.conversations).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.filteredConversations).toEqual([]);
    await act(() => result.current.handleShareToConversation('conversation-1'));
    expect(result.current.sending).toBeNull();
  });

  it('sorts by activity and filters by name or handle', () => {
    const conversations = [
      { id: 'old', name: 'Old Group', lastMessageAt: null },
      { id: 'older', name: 'Older Group' },
      { id: 'ada', name: 'Ada Lovelace', handle: null, lastMessageAt: 10 },
      { id: 'grace', name: 'Grace Hopper', handle: 'compiler', lastMessageAt: 20 },
    ];
    const { result } = renderHook(() =>
      useConversationSelectorDialogController({
        ...requiredProps,
        conversations,
        isLoading: true,
      })
    );

    expect(result.current.filteredConversations.map(item => item.id)).toEqual([
      'grace',
      'ada',
      'old',
      'older',
    ]);

    act(() => result.current.setSearchQuery('  ADA '));
    expect(result.current.filteredConversations.map(item => item.id)).toEqual(['ada']);

    act(() => result.current.setSearchQuery('compiler'));
    expect(result.current.filteredConversations.map(item => item.id)).toEqual(['grace']);

    act(() => result.current.setSearchQuery('missing'));
    expect(result.current.filteredConversations).toEqual([]);
  });

  it('shares the full payload, closes, and resets query after success', async () => {
    const onOpenChange = vi.fn();
    const onShareToConversation = vi.fn().mockResolvedValue(undefined);
    const context = { entity: 'group-1' };
    const { result } = renderHook(() =>
      useConversationSelectorDialogController({
        ...requiredProps,
        onOpenChange,
        onShareToConversation,
        shareDescription: 'Description',
        shareContextItem: context,
      })
    );

    act(() => result.current.setSearchQuery('Ada'));
    await act(() => result.current.handleShareToConversation('conversation-1'));

    expect(onShareToConversation).toHaveBeenCalledWith('conversation-1', {
      shareUrl: '/group/group-1',
      shareTitle: 'Civic Lab',
      shareDescription: 'Description',
      shareContextItem: context,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.sending).toBeNull();
  });

  it('clears sending state while preserving the dialog after a failed share', async () => {
    const onOpenChange = vi.fn();
    const failure = new Error('network');
    const { result } = renderHook(() =>
      useConversationSelectorDialogController({
        ...requiredProps,
        onOpenChange,
        onShareToConversation: vi.fn().mockRejectedValue(failure),
      })
    );

    await expect(
      act(() => result.current.handleShareToConversation('conversation-1'))
    ).rejects.toThrow('network');
    expect(result.current.sending).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
