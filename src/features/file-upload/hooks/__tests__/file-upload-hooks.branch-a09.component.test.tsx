/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
  toastError: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/lib/supabase/client.ts', () => ({
  createClient: () => ({ storage: { from: state.from } }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: state.toastError },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

import { getErrorMessage, showErrorToast, useUploadFile } from '../use-upload-file';
import { useImageUploadController } from '../useImageUploadController';

beforeEach(() => {
  vi.clearAllMocks();
  state.upload.mockResolvedValue({ data: { path: 'stored/file.png' }, error: null });
  state.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/file.png' } });
  state.remove.mockResolvedValue({ error: null });
  state.from.mockReturnValue({
    upload: state.upload,
    getPublicUrl: state.getPublicUrl,
    remove: state.remove,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('generic upload hook branches A09', () => {
  it('uploads successfully, reports simulated and final progress, and resets transient state', async () => {
    vi.useFakeTimers();
    let resolveUpload!: (value: unknown) => void;
    state.upload.mockReturnValue(
      new Promise(resolve => {
        resolveUpload = resolve;
      })
    );
    const onUploadComplete = vi.fn();
    const onUploadProgress = vi.fn();
    const file = new File(['image'], 'a b.png', { type: 'image/png' });
    const { result } = renderHook(() =>
      useUploadFile({ onUploadComplete, onUploadProgress, onUploadError: vi.fn() })
    );

    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.uploadFile(file);
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
      resolveUpload({ data: { path: 'stored/file.png' }, error: null });
      await promise;
    });

    expect(state.upload).toHaveBeenCalledWith(expect.stringContaining('a_b.png'), file, {
      contentType: 'image/png',
    });
    expect(onUploadProgress).toHaveBeenCalledWith(10);
    expect(onUploadProgress).toHaveBeenCalledWith(100);
    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'stored/file.png', url: 'https://cdn.test/file.png' })
    );
    expect(result.current).toMatchObject({ isUploading: false, progress: 0 });
    expect(result.current.uploadingFile).toBeUndefined();
  });

  it('supports default callbacks and reports upload errors with explicit and fallback messages', async () => {
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const defaults = renderHook(() => useUploadFile());
    await act(() => defaults.result.current.uploadFile(file));
    expect(defaults.result.current.uploadedFile?.name).toBe('x.png');

    const onUploadError = vi.fn();
    const failing = renderHook(() => useUploadFile({ onUploadError }));
    state.upload.mockResolvedValueOnce({ data: null, error: new Error('storage failed') });
    await act(async () => {
      await expect(failing.result.current.uploadFile(file)).rejects.toThrow('storage failed');
    });
    expect(state.toastError).toHaveBeenLastCalledWith('storage failed');
    expect(onUploadError).toHaveBeenCalledWith(expect.any(Error));

    state.upload.mockResolvedValueOnce({ data: null, error: new Error('') });
    await act(async () => {
      await expect(failing.result.current.uploadFile(file)).rejects.toThrow();
    });
    expect(state.toastError).toHaveBeenLastCalledWith(
      'generated.inline.0059_something_went_wrong_please_try_again_later_e1b57ba6'
    );
  });

  it('normalizes Zod, Error, and unknown errors and exposes the toast helper', () => {
    let zodError: unknown;
    try {
      z.object({ name: z.string() }).parse({ name: 1 });
    } catch (error) {
      zodError = error;
    }

    expect(getErrorMessage(zodError)).toContain('string');
    expect(getErrorMessage(new Error('explicit'))).toBe('explicit');
    expect(getErrorMessage('unknown')).toContain('Something went wrong');
    showErrorToast('unknown');
    expect(state.toastError).toHaveBeenCalledWith('Something went wrong, please try again later.');
  });
});

describe('image upload controller branches A09', () => {
  it('handles custom upload, editor upload, selection guards, and rejection copy', async () => {
    const onImageChange = vi.fn();
    const onFileUpload = vi.fn(async (file: File) => `custom://${file.name}`);
    const file = new File(['x'], 'image.png', { type: 'image/png' });
    const { result } = renderHook(() => useImageUploadController({ onImageChange, onFileUpload }));

    await act(() => result.current.onFilesSelected([]));
    await act(() => result.current.onFilesSelected([file]));
    await act(async () => {
      await expect(result.current.onSaveEditedImage(file)).resolves.toBe(true);
    });
    act(() => result.current.onFilesRejected([{ code: 'file-size' }]));
    act(() => result.current.onFilesRejected([{ code: 'file-type', file }]));
    act(() => result.current.onEditorOpenChange(true));
    result.current.onImageUrlChange('manual://image');

    expect(onImageChange).toHaveBeenCalledWith('custom://image.png');
    expect(onImageChange).toHaveBeenCalledWith('manual://image');
    expect(state.toastError).toHaveBeenCalledWith('common.actions.uploadImageTypesOnly');
    expect(result.current.isEditorOpen).toBe(true);
  });

  it('validates internal-upload identity and covers storage success and failure', async () => {
    const onImageChange = vi.fn();
    const file = new File(['x'], 'unsafe name.png', { type: 'image/png' });
    const missing = renderHook(() => useImageUploadController({ onImageChange }));
    await act(async () => {
      await expect(missing.result.current.onSaveEditedImage(file)).resolves.toBe(false);
    });
    expect(state.toastError).toHaveBeenCalledWith('common.actions.uploadImageFailed');

    const valid = renderHook(() =>
      useImageUploadController({ onImageChange, entityType: 'todo', entityId: 'todo-1' })
    );
    await act(async () => {
      await expect(valid.result.current.onSaveEditedImage(file)).resolves.toBe(true);
    });
    expect(state.upload).toHaveBeenCalledWith(
      expect.stringContaining('todo/todo-1/'),
      file,
      expect.objectContaining({ upsert: true })
    );

    state.upload.mockResolvedValueOnce({ data: null, error: new Error('upload failed') });
    await act(async () => {
      await expect(valid.result.current.onSaveEditedImage(file)).resolves.toBe(false);
    });
  });

  it('clears empty and unmanaged images without storage cleanup', async () => {
    const onImageChange = vi.fn();
    const empty = renderHook(() => useImageUploadController({ onImageChange }));
    act(() => empty.result.current.onRemoveImage());
    expect(onImageChange).toHaveBeenLastCalledWith('');

    const unmanaged = renderHook(() =>
      useImageUploadController({ currentImage: 'https://external.test/image.png', onImageChange })
    );
    act(() => unmanaged.result.current.onRemoveImage());
    expect(onImageChange).toHaveBeenLastCalledWith('');
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('ignores non-storage URLs while still invoking a custom removal hook', async () => {
    const onImageChange = vi.fn();
    const onImageRemove = vi.fn();
    for (const currentImage of [
      'not a url',
      'https://external.test/image.png',
      'https://cdn.test/storage/v1/object/public/uploads',
    ]) {
      const { result, unmount } = renderHook(() =>
        useImageUploadController({
          currentImage,
          cleanupOnRemove: true,
          onImageChange,
          onImageRemove,
        })
      );
      act(() => result.current.onRemoveImage());
      await waitFor(() => expect(onImageRemove).toHaveBeenCalledWith(currentImage));
      unmount();
    }
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('decodes and removes managed storage objects and reports removal errors', async () => {
    const onImageChange = vi.fn();
    const currentImage =
      'https://cdn.test/storage/v1/object/public/my%20bucket/folder/my%20image.png';
    const success = renderHook(() =>
      useImageUploadController({ currentImage, cleanupOnRemove: true, onImageChange })
    );
    act(() => success.result.current.onRemoveImage());
    await waitFor(() => expect(state.remove).toHaveBeenCalledWith(['folder/my image.png']));
    expect(state.from).toHaveBeenCalledWith('my bucket');
    expect(onImageChange).toHaveBeenLastCalledWith('');

    state.remove.mockResolvedValueOnce({ error: new Error('remove failed') });
    const failure = renderHook(() =>
      useImageUploadController({ currentImage, cleanupOnRemove: true, onImageChange })
    );
    act(() => failure.result.current.onRemoveImage());
    await waitFor(() =>
      expect(state.toastError).toHaveBeenCalledWith('common.actions.removeImageFailed')
    );
  });
});
