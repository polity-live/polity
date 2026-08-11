/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_VIDEO_UPLOAD_SIZE } from '../../hooks/useVideoUploadController';
import { VideoUpload } from '../VideoUpload';

const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/features/file-upload/hooks/use-upload-file.ts', () => ({
  useUploadFile: () => ({ uploadFile: mocks.uploadFile, isUploading: false, progress: 0 }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.actions.dropVideoHere': 'Drop video here',
        'common.actions.dragVideoHere': 'Drag video here',
        'common.media.orClickToBrowse': 'or choose a file',
        'common.actions.uploading': 'Uploading',
        'common.actions.uploadVideo': 'Upload video',
        'common.labels.orProvideUrl': 'or provide a URL',
        'common.media.unsupportedVideo': 'Unsupported video',
        'common.actions.uploadVideoTypesOnly': 'Videos only',
        'common.actions.videoTooLarge': 'Video too large',
        'common.actions.videoUploadSuccess': 'Video uploaded',
        'common.actions.videoUploadFailed': 'Video upload failed',
      })[key] ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('VideoUpload dropzone', () => {
  it('uploads a dropped video and exposes the resulting URL', async () => {
    mocks.uploadFile.mockResolvedValue({ url: 'https://example.test/video.mp4' });
    const onVideoChange = vi.fn();
    render(<VideoUpload onVideoChange={onVideoChange} />);
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    fireEvent.drop(screen.getByTestId('video-upload-dropzone'), {
      dataTransfer: { files: [video] },
    });

    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledWith(video));
    expect(onVideoChange).toHaveBeenCalledWith('https://example.test/video.mp4');
  });

  it('rejects non-video and oversized files', () => {
    render(<VideoUpload onVideoChange={vi.fn()} />);
    const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
    const oversized = new File(['video'], 'large.mp4', { type: 'video/mp4' });
    Object.defineProperty(oversized, 'size', { value: MAX_VIDEO_UPLOAD_SIZE + 1 });

    fireEvent.drop(screen.getByTestId('video-upload-dropzone'), {
      dataTransfer: { files: [text] },
    });
    fireEvent.drop(screen.getByTestId('video-upload-dropzone'), {
      dataTransfer: { files: [oversized] },
    });

    expect(mocks.toastError).toHaveBeenCalledWith('Videos only');
    expect(mocks.toastError).toHaveBeenCalledWith('Video too large');
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('supports direct URLs and uses the themed preview background', () => {
    const onVideoChange = vi.fn();
    render(
      <VideoUpload currentVideo="https://example.test/current.mp4" onVideoChange={onVideoChange} />
    );

    const preview = document.querySelector('video');
    expect(preview?.className).toContain('bg-background');
    fireEvent.change(screen.getByTestId('video-upload-url-input'), {
      target: { value: 'https://example.test/next.webm' },
    });
    expect(onVideoChange).toHaveBeenCalledWith('https://example.test/next.webm');
    const remove = document.querySelector<HTMLElement>(
      '[data-action-id="file-upload.video.remove"]'
    )!;
    remove.focus();
    fireEvent.keyDown(remove, { key: 'Enter' });
    fireEvent.click(remove);
    expect(onVideoChange).toHaveBeenCalledWith('');
  });
});
