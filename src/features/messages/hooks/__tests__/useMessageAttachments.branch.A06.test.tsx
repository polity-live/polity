// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMessageAttachments } from '../useMessageAttachments';

const mocks = vi.hoisted(() => ({
  data: undefined as any,
  votes: [] as any[],
  uploadFile: vi.fn(),
  isUploading: false,
  uploadingFile: undefined as any,
  buildAgenda: vi.fn(),
  mapMosaic: vi.fn(),
  buildOption: vi.fn(),
  buildVote: vi.fn(),
  buildIndex: vi.fn(),
  buildUpload: vi.fn(),
}));

vi.mock('@/features/file-upload/hooks/use-upload-file', () => ({
  useUploadFile: () => ({
    uploadFile: mocks.uploadFile,
    isUploading: mocks.isUploading,
    uploadingFile: mocks.uploadingFile,
  }),
}));
vi.mock('@/features/search/logic/searchFiltering', () => ({
  buildAgendaItemsByEventId: mocks.buildAgenda,
}));
vi.mock('@/features/search/logic/searchMappers', () => ({
  mapMosaicToContentItems: mocks.mapMosaic,
}));
vi.mock('@/features/search/hooks/useSearchData', () => ({
  useSearchData: () => ({ data: mocks.data }),
}));
vi.mock('@/zero/votes/useVoteState', () => ({
  useVoteState: () => ({ votesWithDetails: mocks.votes }),
}));
vi.mock('../../logic/buildAttachmentCardDataIndex', () => ({
  buildAttachmentCardDataIndex: mocks.buildIndex,
}));
vi.mock('../../logic/assistantComposer', () => ({
  buildAssistantAttachmentOption: mocks.buildOption,
  buildVoteSearchItem: mocks.buildVote,
}));
vi.mock('../../logic/uploadAttachmentCard', () => ({
  buildUploadAttachment: mocks.buildUpload,
}));

function option(entityType: string, entityId: string) {
  return {
    key: `${entityType}:${entityId}`,
    attachment: { entityType, entityId, title: entityId },
  } as any;
}

describe('useMessageAttachments exhaustive branches', () => {
  beforeEach(() => {
    mocks.data = undefined;
    mocks.votes = [];
    mocks.isUploading = false;
    mocks.uploadingFile = undefined;
    mocks.uploadFile.mockReset();
    mocks.buildAgenda.mockReset().mockReturnValue(new Map());
    mocks.mapMosaic.mockReset().mockReturnValue([{ id: 'keep' }, { id: 'drop' }]);
    mocks.buildOption
      .mockReset()
      .mockImplementation((item: any) => (item.id === 'drop' ? null : option('group', item.id)));
    mocks.buildVote.mockReset().mockImplementation((vote: any) => ({ id: `vote-${vote.id}` }));
    mocks.buildIndex.mockReset().mockReturnValue(new Map([['group:keep', '{"card":true}']]));
    mocks.buildUpload.mockReset().mockImplementation((uploaded: any) => ({
      entityType: 'document',
      entityId: uploaded.key,
      title: uploaded.name,
    }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses empty data fallbacks and exposes missing-card and upload-state fallbacks', () => {
    const { result } = renderHook(() => useMessageAttachments());
    expect(mocks.buildAgenda).toHaveBeenCalledWith([]);
    expect(mocks.mapMosaic).toHaveBeenCalledWith([], expect.any(Map));
    expect(result.current.attachmentOptions).toHaveLength(1);
    expect(result.current.resolveAttachmentCardData('group', 'keep')).toBe('{"card":true}');
    expect(result.current.resolveAttachmentCardData('group', 'missing')).toBeNull();
    expect(result.current.uploadingAttachmentName).toBeNull();
    expect(result.current.isUploadingAttachments).toBe(false);
  });

  it('maps every mosaic collection, votes and the current uploading filename', () => {
    mocks.data = {
      agendaItems: [{ id: 'agenda' }],
      $users: [{ id: 'user' }],
      groups: [{ id: 'group' }],
      statements: [{ id: 'statement' }],
      blogs: [{ id: 'blog' }],
      amendments: [{ id: 'amendment' }],
      events: [{ id: 'event' }],
      todos: [{ id: 'todo' }],
      elections: [{ id: 'election' }],
    };
    mocks.votes = [{ id: 'vote' }];
    mocks.uploadingFile = { name: 'upload.pdf' };
    mocks.isUploading = true;
    renderHook(() => useMessageAttachments());

    expect(mocks.mapMosaic.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 'user', _type: 'user' }),
      expect.objectContaining({ id: 'group', _type: 'group' }),
      expect.objectContaining({ id: 'statement', _type: 'statement' }),
      expect.objectContaining({ id: 'blog', _type: 'blog' }),
      expect.objectContaining({ id: 'amendment', _type: 'amendment' }),
      expect.objectContaining({ id: 'event', _type: 'event' }),
      expect.objectContaining({ id: 'todo', _type: 'todo' }),
      expect.objectContaining({ id: 'election', _type: 'election' }),
    ]);
    expect(mocks.buildVote).toHaveBeenCalledWith({ id: 'vote' }, 0, [{ id: 'vote' }]);
  });

  it('deduplicates, removes, clears and resets selected attachments', () => {
    const { result, rerender } = renderHook(({ resetKey }) => useMessageAttachments(resetKey), {
      initialProps: { resetKey: 'first' },
    });
    act(() => {
      result.current.addAttachment(option('group', 'one'));
      result.current.addAttachment(option('group', 'one'));
      result.current.addAttachment(option('group', 'two'));
      result.current.addAttachment(option('user', 'one'));
    });
    expect(result.current.selectedAttachments).toHaveLength(3);
    act(() => result.current.removeAttachment('group', 'one'));
    expect(
      result.current.selectedAttachments.map(item => `${item.entityType}:${item.entityId}`)
    ).toEqual(['group:two', 'user:one']);
    act(() => result.current.clearAttachments());
    expect(result.current.selectedAttachments).toEqual([]);
    act(() => result.current.addAttachment(option('group', 'again')));
    rerender({ resetKey: 'second' });
    expect(result.current.selectedAttachments).toEqual([]);
  });

  it('adds successful uploads, tolerates individual failures and leaves all-failure state unchanged', async () => {
    const first = new File(['one'], 'one.txt');
    const second = new File(['two'], 'two.txt');
    mocks.uploadFile
      .mockResolvedValueOnce({ key: 'one', name: 'one.txt' })
      .mockRejectedValueOnce(new Error('failed'));
    const { result } = renderHook(() => useMessageAttachments());
    let uploaded: any[] = [];
    await act(async () => {
      uploaded = await result.current.addUploadedFiles([first, second]);
    });
    expect(uploaded).toEqual([
      expect.objectContaining({ entityType: 'document', entityId: 'one' }),
    ]);
    expect(result.current.selectedAttachments).toEqual(uploaded);
    expect(console.error).toHaveBeenCalledTimes(1);

    mocks.uploadFile.mockRejectedValueOnce(new Error('still failed'));
    await act(async () => {
      expect(await result.current.addUploadedFiles([second])).toEqual([]);
    });
    expect(result.current.selectedAttachments).toEqual(uploaded);
  });
});
