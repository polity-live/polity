import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMessageAttachments } from '../useMessageAttachments';
import type { AssistantAttachmentOption } from '../../logic/assistantComposer';

const fixture = vi.hoisted(() => ({ votes: [], upload: vi.fn() }));
vi.mock('@/features/file-upload/hooks/use-upload-file', () => ({
  useUploadFile: () => ({
    uploadFile: fixture.upload,
    isUploading: false,
    uploadingFile: null,
  }),
}));
vi.mock('@/features/search/hooks/useSearchData', () => ({
  useSearchData: () => ({ data: undefined }),
}));
vi.mock('@/zero/votes/useVoteState', () => ({
  useVoteState: () => ({ votesWithDetails: fixture.votes }),
}));
afterEach(cleanup);

const attachmentOption: AssistantAttachmentOption = {
  key: 'group:one',
  entityType: 'group',
  label: 'One',
  searchText: 'one',
  attachment: { entityType: 'group', entityId: 'one', title: 'One' },
};

it('avoids empty resets while clearing real attachments on conversation changes and explicit clears', () => {
  let renders = 0;
  const hook = renderHook(
    ({ key }) => {
      renders++;
      return useMessageAttachments(key, false);
    },
    { initialProps: { key: 'thread-1' } }
  );
  const emptySelection = hook.result.current.selectedAttachments;
  expect(renders).toBe(1);
  act(() => hook.result.current.clearAttachments());
  expect(renders).toBe(1);
  expect(hook.result.current.selectedAttachments).toBe(emptySelection);
  hook.rerender({ key: 'thread-2' });
  expect(renders).toBe(2);
  expect(hook.result.current.selectedAttachments).toBe(emptySelection);

  act(() => hook.result.current.addAttachment(attachmentOption));
  expect(hook.result.current.selectedAttachments).toEqual([attachmentOption.attachment]);
  hook.rerender({ key: 'thread-3' });
  expect(hook.result.current.selectedAttachments).toEqual([]);
  act(() => hook.result.current.addAttachment(attachmentOption));
  act(() => hook.result.current.clearAttachments());
  expect(hook.result.current.selectedAttachments).toEqual([]);
});
