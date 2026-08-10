/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => `t:${key}`),
  parseActiveMentionQuery: vi.fn(),
  getSuggestionAnchorPosition: vi.fn(() => ({ left: 1, top: 2, width: 3 })),
  replaceTextRange: vi.fn(
    (value: string, start: number, end: number, replacement: string) =>
      `${value.slice(0, start)}${replacement}${value.slice(end)}`
  ),
  getOtherParticipant: vi.fn(),
  isConversationRequester: vi.fn(),
  attachments: {
    selectedAttachments: [] as Record<string, unknown>[],
    attachmentOptions: [] as Record<string, any>[],
    isUploadingAttachments: false,
    addAttachment: vi.fn(),
    clearAttachments: vi.fn(),
  },
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.t }),
  translate: mocks.t,
}));
vi.mock('../../logic/messageUtils', () => ({
  getOtherParticipant: mocks.getOtherParticipant,
  isConversationRequester: mocks.isConversationRequester,
}));
vi.mock('../../logic/assistantComposer', async importOriginal => {
  const actual = await importOriginal<typeof import('../../logic/assistantComposer')>();
  return {
    ...actual,
    parseActiveMentionQuery: mocks.parseActiveMentionQuery,
    getSuggestionAnchorPosition: mocks.getSuggestionAnchorPosition,
    replaceTextRange: mocks.replaceTextRange,
  };
});
vi.mock('../../hooks/useMessageAttachments', () => ({
  useMessageAttachments: () => mocks.attachments,
}));

import { useMessageInputController } from '../useMessageInputController';

const directConversation = {
  id: 'conversation-1',
  type: 'direct',
  status: 'accepted',
  participants: [],
};

function renderController(
  overrides: {
    conversation?: Record<string, unknown>;
    currentUserId?: string;
    onSendMessage?: (content: string, contextJson: string) => Promise<boolean>;
  } = {}
) {
  const onSendMessage = overrides.onSendMessage ?? vi.fn().mockResolvedValue(true);
  return {
    ...renderHook(() =>
      useMessageInputController({
        conversation: (overrides.conversation ?? directConversation) as never,
        currentUserId: overrides.currentUserId ?? 'current-user',
        onSendMessage,
      })
    ),
    onSendMessage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseActiveMentionQuery.mockReturnValue(null);
  mocks.getOtherParticipant.mockReturnValue(null);
  mocks.isConversationRequester.mockReturnValue(true);
  mocks.attachments.selectedAttachments = [];
  mocks.attachments.attachmentOptions = [];
  mocks.attachments.isUploadingAttachments = false;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMessageInputController branch contract', () => {
  it('covers absent mentions, empty suggestions, fallback names, and pending-request visibility', () => {
    const accepted = renderController();
    expect(accepted.result.current).toEqual(
      expect.objectContaining({
        mentionQuery: null,
        attachmentTypeSuggestions: [],
        attachmentSuggestions: [],
        hasSuggestionPanel: false,
        otherParticipantName: 't:common.labels.unspecifiedUser',
      })
    );

    cleanup();
    mocks.isConversationRequester.mockReturnValue(false);
    const hidden = renderController({
      conversation: {
        ...directConversation,
        status: 'pending',
      },
    });
    expect(hidden.result.current).toBeNull();

    cleanup();
    const group = renderController({
      conversation: { ...directConversation, type: 'group', status: 'pending' },
    });
    expect(group.result.current).not.toBeNull();
  });

  it('filters type and entity suggestions across every mention-query decision', () => {
    mocks.attachments.selectedAttachments = [{ entityType: 'group', entityId: 'selected' }];
    mocks.attachments.attachmentOptions = [
      { key: 'group:selected', entityType: 'group', searchText: 'selected' },
      { key: 'event:wrong', entityType: 'event', searchText: 'agenda' },
      { key: 'group:empty', entityType: 'group', searchText: 'anything' },
      { key: 'group:match', entityType: 'group', searchText: 'agenda match' },
      { key: 'group:miss', entityType: 'group', searchText: 'different' },
    ];
    mocks.parseActiveMentionQuery.mockReturnValue({
      raw: '@gr',
      start: 0,
      end: 3,
      entityType: undefined,
      searchText: 'agenda',
    });
    const untyped = renderController();
    expect(untyped.result.current?.attachmentTypeSuggestions.length).toBeGreaterThan(0);
    expect(untyped.result.current?.attachmentSuggestions.map(option => option.key)).toEqual([
      'event:wrong',
      'group:match',
    ]);

    cleanup();
    mocks.parseActiveMentionQuery.mockReturnValue({
      raw: '@group@',
      start: 0,
      end: 7,
      entityType: 'group',
      searchText: '',
    });
    const typedEmpty = renderController();
    expect(typedEmpty.result.current?.attachmentTypeSuggestions).toEqual([]);
    expect(typedEmpty.result.current?.attachmentSuggestions.map(option => option.key)).toEqual([
      'group:empty',
      'group:match',
      'group:miss',
    ]);

    cleanup();
    mocks.parseActiveMentionQuery.mockReturnValue({
      raw: '@',
      start: 0,
      end: 1,
      entityType: undefined,
      searchText: '',
    });
    const allTypes = renderController();
    expect(allTypes.result.current?.attachmentTypeSuggestions.length).toBeGreaterThan(1);
    expect(allTypes.result.current?.attachmentSuggestions).toEqual([]);
  });

  it('positions the suggestion panel, updates carets, and handles missing or present textareas', () => {
    mocks.parseActiveMentionQuery.mockReturnValue({
      raw: '@',
      start: 0,
      end: 1,
      entityType: undefined,
      searchText: '',
    });
    const { result } = renderController();
    expect(result.current?.hasSuggestionPanel).toBe(true);
    expect(result.current?.suggestionAnchorPosition).toBeNull();

    const textarea = document.createElement('textarea');
    textarea.value = '@';
    textarea.selectionStart = 1;
    const focus = vi.spyOn(textarea, 'focus');
    if (result.current) result.current.textareaRef.current = textarea;
    act(() => result.current?.setTextareaScrollVersion(version => version + 1));
    expect(result.current?.suggestionAnchorPosition).toEqual({ left: 1, top: 2, width: 3 });

    act(() => {
      result.current?.updateCaretPosition();
      result.current?.moveCaret(1);
      window.dispatchEvent(new Event('resize'));
    });
    expect(focus).toHaveBeenCalled();
    expect(textarea.selectionStart).toBe(1);

    if (result.current) {
      result.current.textareaRef.current = { selectionStart: undefined } as never;
    }
    act(() => result.current?.updateCaretPosition());
    if (result.current) result.current.textareaRef.current = null;
    act(() => result.current?.moveCaret(2));
    window.dispatchEvent(new Event('resize'));
  });

  it('applies type and attachment replacements for leading, spaced, and embedded mentions', () => {
    const query = { raw: '@g', start: 0, end: 2, entityType: undefined, searchText: '' };
    mocks.parseActiveMentionQuery.mockReturnValue(null);
    const absent = renderController();
    act(() => {
      absent.result.current?.handleAttachmentTypeSelect('group');
      absent.result.current?.handleAttachmentSelect({ key: 'group:1' } as never);
    });
    expect(mocks.attachments.addAttachment).not.toHaveBeenCalled();

    cleanup();
    mocks.parseActiveMentionQuery.mockReturnValue(query);
    const leading = renderController();
    act(() => {
      leading.result.current?.setMessageText('@g rest');
      leading.result.current?.setCaretPosition(2);
    });
    act(() => leading.result.current?.handleAttachmentTypeSelect('group'));
    act(() => leading.result.current?.handleAttachmentSelect({ key: 'group:1' } as never));
    expect(mocks.attachments.addAttachment).toHaveBeenCalled();

    cleanup();
    mocks.parseActiveMentionQuery.mockReturnValue({ ...query, start: 2, end: 4 });
    const embedded = renderController();
    act(() => embedded.result.current?.setMessageText('x @g-tail'));
    act(() => embedded.result.current?.handleAttachmentSelect({ key: 'group:2' } as never));

    cleanup();
    const spaced = renderController();
    act(() => spaced.result.current?.setMessageText('x @g rest'));
    act(() => spaced.result.current?.handleAttachmentSelect({ key: 'group:3' } as never));
    expect(mocks.replaceTextRange).toHaveBeenCalled();
  });

  it('guards sends, serializes attachments, clears successful sends, and preserves failed sends', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(false);
    const { result, rerender } = renderController({ onSendMessage });
    await act(() => result.current?.handleSendMessage());
    expect(onSendMessage).not.toHaveBeenCalled();

    mocks.attachments.isUploadingAttachments = true;
    act(() => result.current?.setMessageText(' message '));
    rerender();
    await act(() => result.current?.handleSendMessage());
    expect(onSendMessage).not.toHaveBeenCalled();

    mocks.attachments.isUploadingAttachments = false;
    rerender();
    await act(() => result.current?.handleSendMessage());
    expect(onSendMessage).toHaveBeenCalledWith('message', '[]');
    expect(mocks.attachments.clearAttachments).not.toHaveBeenCalled();

    onSendMessage.mockResolvedValue(true);
    mocks.attachments.selectedAttachments = [{ entityType: 'group', entityId: '1' }];
    rerender();
    await act(() => result.current?.handleSendMessage());
    expect(mocks.attachments.clearAttachments).toHaveBeenCalled();

    act(() => result.current?.setMessageText(''));
    rerender();
    await act(() => result.current?.handleSendMessage());
    expect(onSendMessage).toHaveBeenLastCalledWith(
      '',
      JSON.stringify(mocks.attachments.selectedAttachments)
    );
  });

  it('formats complete and partial participant names without the translation fallback', () => {
    mocks.getOtherParticipant.mockReturnValue({ first_name: 'Ada', last_name: 'Lovelace' });
    const complete = renderController();
    expect(complete.result.current?.otherParticipantName).toBe('Ada Lovelace');

    cleanup();
    mocks.getOtherParticipant.mockReturnValue({ first_name: '', last_name: 'Lovelace' });
    const partial = renderController();
    expect(partial.result.current?.otherParticipantName).toBe('Lovelace');
  });
});
