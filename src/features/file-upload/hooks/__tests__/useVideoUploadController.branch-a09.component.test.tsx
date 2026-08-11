/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  uploadFile: vi.fn(),
}));

vi.mock('../use-upload-file.ts', () => ({
  useUploadFile: () => ({ uploadFile: state.uploadFile, isUploading: false, progress: 20 }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: state.toastError, success: state.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { MAX_VIDEO_UPLOAD_SIZE, useVideoUploadController } from '../useVideoUploadController';

beforeEach(() => vi.clearAllMocks());

describe('video upload controller remaining branches A09', () => {
  it('guards empty, non-video, oversized, and empty-result selections', async () => {
    const onVideoChange = vi.fn();
    const { result } = renderHook(() => useVideoUploadController({ onVideoChange }));
    await act(() => result.current.onFilesSelected([]));
    await act(() =>
      result.current.onFilesSelected([new File(['x'], 'x.txt', { type: 'text/plain' })])
    );
    const large = new File(['x'], 'x.mp4', { type: 'video/mp4' });
    Object.defineProperty(large, 'size', { value: MAX_VIDEO_UPLOAD_SIZE + 1 });
    await act(() => result.current.onFilesSelected([large]));
    state.uploadFile.mockResolvedValueOnce(undefined);
    await act(() =>
      result.current.onFilesSelected([new File(['x'], 'x.mp4', { type: 'video/mp4' })])
    );
    expect(onVideoChange).not.toHaveBeenCalled();
  });

  it('uploads, reports errors, validates rejections, changes URLs, removes, and syncs props', async () => {
    const onVideoChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentVideo }: { currentVideo?: string }) =>
        useVideoUploadController({ currentVideo, onVideoChange }),
      { initialProps: { currentVideo: 'old' as string | undefined } }
    );
    state.uploadFile.mockResolvedValueOnce({ url: 'uploaded' });
    await act(() =>
      result.current.onFilesSelected([new File(['x'], 'x.mp4', { type: 'video/mp4' })])
    );
    expect(onVideoChange).toHaveBeenCalledWith('uploaded');
    state.uploadFile.mockRejectedValueOnce(new Error('failed'));
    await act(() =>
      result.current.onFilesSelected([new File(['x'], 'x.mp4', { type: 'video/mp4' })])
    );
    act(() => result.current.onFilesRejected([{ code: 'file-type' }, { code: 'file-size' }]));
    act(() => result.current.onFilesRejected([{ code: 'too-many-files' }]));
    act(() => result.current.onUrlChange('manual'));
    expect(result.current.videoUrl).toBe('manual');
    act(() => result.current.onRemoveVideo());
    expect(result.current.videoUrl).toBe('');
    rerender({ currentVideo: undefined });
    expect(result.current.previewUrl).toBe('');
  });
});
