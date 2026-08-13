/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ imageProps: undefined as any, videoProps: undefined as any }));

vi.mock('../ImageUpload', () => ({
  ImageUpload: (props: any) => {
    state.imageProps = props;
    return null;
  },
}));
vi.mock('../VideoUpload', () => ({
  VideoUpload: (props: any) => {
    state.videoProps = props;
    return null;
  },
}));

import { readEditorCssVar } from '../ImageEditorTheme';
import { MediaUpload } from '../MediaUpload';
import { VideoUploadView } from '../VideoUploadView';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('uses editor CSS fallback without a browser window', () => {
  const browserWindow = window;
  vi.stubGlobal('window', undefined);
  expect(readEditorCssVar('--missing', 'fallback')).toBe('fallback');
  vi.stubGlobal('window', browserWindow);
});

it('keeps media independent unless exclusivity and a non-empty URL require clearing', () => {
  const onImageChange = vi.fn();
  const onVideoChange = vi.fn();
  const view = render(
    <MediaUpload
      entityType="todo"
      entityId="one"
      onImageChange={onImageChange}
      onVideoChange={onVideoChange}
    />
  );
  state.imageProps.onImageChange('image');
  view.rerender(
    <MediaUpload
      entityType="todo"
      entityId="one"
      currentVideo="video"
      onImageChange={onImageChange}
      onVideoChange={onVideoChange}
    />
  );
  state.videoProps.onVideoChange('video');
  expect(onVideoChange).not.toHaveBeenCalledWith('');
  expect(onImageChange).not.toHaveBeenCalledWith('');
  view.rerender(
    <MediaUpload
      entityType="todo"
      entityId="one"
      currentImage="image"
      exclusiveMedia
      onImageChange={onImageChange}
      onVideoChange={onVideoChange}
    />
  );
  state.imageProps.onImageChange('');
  view.rerender(
    <MediaUpload
      entityType="todo"
      entityId="one"
      currentVideo="video"
      exclusiveMedia
      onImageChange={onImageChange}
      onVideoChange={onVideoChange}
    />
  );
  state.videoProps.onVideoChange('');
});

it('seeks metadata only without a thumbnail and handles URL/remove events', () => {
  const props = {
    label: 'Video',
    description: 'Description',
    previewUrl: 'video.mp4',
    videoUrl: 'video.mp4',
    urlInputId: 'url',
    isUploading: false,
    progress: 0,
    maxSize: 10,
    copy: {
      dropVideoHere: 'drop',
      dragVideoHere: 'drag',
      orClickToBrowse: 'browse',
      uploading: 'uploading',
      uploadVideo: 'upload',
      orProvideUrl: 'url',
      unsupportedVideo: 'unsupported',
    },
    onFilesSelected: vi.fn(),
    onFilesRejected: vi.fn(),
    onUrlChange: vi.fn(),
    onRemoveVideo: vi.fn(),
  };
  const view = render(<VideoUploadView {...props} />);
  const video = view.container.querySelector('video')!;
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBe(0.1);
  fireEvent.change(view.container.querySelector('[data-testid="video-upload-url-input"]')!, {
    target: { value: 'new' },
  });
  fireEvent.click(view.container.querySelector('[data-action-id="file-upload.video.remove"]')!);
  expect(props.onUrlChange).toHaveBeenCalledWith('new');
  expect(props.onRemoveVideo).toHaveBeenCalled();
  view.rerender(<VideoUploadView {...props} currentThumbnail="thumb.jpg" />);
  const withThumb = view.container.querySelector('video')!;
  withThumb.currentTime = 0;
  fireEvent.loadedMetadata(withThumb);
  expect(withThumb.currentTime).toBe(0);
});
