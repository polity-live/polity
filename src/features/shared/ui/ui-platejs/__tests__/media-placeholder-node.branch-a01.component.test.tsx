/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  pickerOptions: null as null | {
    accept: string[];
    multiple: boolean;
    onFilesSuccessfullySelected: (args: { plainFiles: File[] }) => void;
  },
  upload: {
    isUploading: false,
    progress: undefined as number | undefined,
    uploadedFile: null as null | { key: string; url: string; name: string },
    uploadingFile: null as File | null,
  },
  placeholder: {
    addUploadingFile: vi.fn(),
    getUploadingFile: vi.fn(),
    removeUploadingFile: vi.fn(),
  },
  openFilePicker: vi.fn(),
  uploadFile: vi.fn(),
  updateUploadHistory: vi.fn(),
}));

vi.mock('@platejs/media/react', () => ({
  PlaceholderPlugin: { key: 'placeholder' },
  PlaceholderProvider: ({ children }: { children: ReactNode }) => children,
  updateUploadHistory: state.updateUploadHistory,
}));

vi.mock('platejs', () => ({
  KEYS: { audio: 'audio', file: 'file', img: 'img', video: 'video' },
}));

vi.mock('platejs/react', () => ({
  PlateElement: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useEditorPlugin: () => ({ api: { placeholder: state.placeholder } }),
  withHOC: (_provider: unknown, Component: unknown) => Component,
}));

vi.mock('use-file-picker', () => ({
  useFilePicker: (options: typeof state.pickerOptions) => {
    state.pickerOptions = options;
    return { openFilePicker: state.openFilePicker };
  },
}));

vi.mock('@/features/file-upload/hooks/use-upload-file.ts', () => ({
  useUploadFile: () => ({ ...(state.upload as object), uploadFile: state.uploadFile }),
}));

vi.mock('../ImageProgressView', () => ({
  ImageProgressView: ({
    file,
    imageRef,
    objectUrl,
    progress,
    setObjectUrl,
  }: {
    file: File;
    imageRef?: RefObject<HTMLImageElement | null>;
    objectUrl: string | null;
    progress: number;
    setObjectUrl: (value: string | null) => void;
  }) => (
    <div data-testid="image-progress" data-progress={progress} data-url={objectUrl ?? ''}>
      <img ref={imageRef} alt={file.name} height={240} width={320} />
      <button type="button" onClick={() => setObjectUrl(null)}>
        reset-url
      </button>
    </div>
  ),
}));

import { ImageProgress, PlaceholderElement } from '../media-placeholder-node';

type PlaceholderProps = ComponentProps<typeof PlaceholderElement>;

const createEditor = () => {
  const insertMedia = vi.fn();
  return {
    api: { findPath: vi.fn(() => [0]) },
    getTransforms: vi.fn(() => ({ insert: { media: insertMedia } })),
    insertMedia,
    tf: { insertNodes: vi.fn(), removeNodes: vi.fn() },
  };
};

function renderPlaceholder(mediaType: string, editor = createEditor()) {
  const element = { id: `placeholder-${mediaType}`, mediaType, children: [{ text: '' }] };
  const view = render(
    <PlaceholderElement {...({ editor, element, attributes: {} } as unknown as PlaceholderProps)}>
      child
    </PlaceholderElement>
  );
  return { ...view, editor, element };
}

describe('media placeholder', () => {
  beforeEach(() => {
    state.pickerOptions = null;
    state.upload.isUploading = false;
    state.upload.progress = undefined;
    state.upload.uploadedFile = null;
    state.upload.uploadingFile = null;
    state.placeholder.getUploadingFile.mockReset().mockReturnValue(null);
    state.placeholder.addUploadingFile.mockReset();
    state.placeholder.removeUploadingFile.mockReset();
    state.openFilePicker.mockReset();
    state.uploadFile.mockReset();
    state.updateUploadHistory.mockReset();
  });

  afterEach(cleanup);

  it.each([
    ['audio', 'Add an audio file', 'audio/*'],
    ['file', 'Add a file', '*'],
    ['img', 'Add an image', 'image/*'],
    ['video', 'Add a video', 'video/*'],
  ])('opens the %s picker by pointer and keyboard', (mediaType, label, accept) => {
    renderPlaceholder(mediaType);
    const button = screen.getByRole('button', { name: label });

    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: 'Escape' });

    expect(state.openFilePicker).toHaveBeenCalledTimes(3);
    expect(state.pickerOptions).toMatchObject({ accept: [accept], multiple: true });
  });

  it('uploads the first selected file and inserts all remaining files', () => {
    const { editor, element } = renderPlaceholder('file');
    const first = new File(['first'], 'first.txt');
    const second = new File(['second'], 'second.txt');

    state.pickerOptions?.onFilesSuccessfullySelected({ plainFiles: [first, second] });

    expect(state.uploadFile).toHaveBeenCalledWith(first);
    expect(state.placeholder.addUploadingFile).toHaveBeenCalledWith(element.id, first);
    expect(editor.insertMedia).toHaveBeenCalledWith([second]);
    expect(editor.getTransforms).toHaveBeenCalled();

    state.pickerOptions?.onFilesSuccessfullySelected({ plainFiles: [first] });
    expect(editor.insertMedia).toHaveBeenCalledTimes(1);
  });

  it('resumes a queued upload and avoids reinserting it on rerender', () => {
    const queued = new File(['queued'], 'queued.pdf');
    state.placeholder.getUploadingFile.mockReturnValue(queued);
    const { rerender, editor, element } = renderPlaceholder('file');
    expect(state.uploadFile).toHaveBeenCalledWith(queued);

    rerender(
      <PlaceholderElement
        {...({
          editor,
          element: { ...element, id: 'replacement-id' },
          attributes: {},
        } as unknown as PlaceholderProps)}
      >
        child
      </PlaceholderElement>
    );
    expect(state.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('shows non-image upload progress and blocks pointer and keyboard activation', () => {
    state.upload.isUploading = true;
    state.upload.progress = 42;
    state.upload.uploadingFile = new File([new Uint8Array(1024)], 'document.pdf');
    renderPlaceholder('file');

    const button = screen.getByRole('button', { name: 'Add a file' });
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.textContent).toContain('document.pdf');
    expect(button.textContent).toContain('1 KB');
    expect(button.textContent).toContain('42%');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(state.openFilePicker).not.toHaveBeenCalled();
  });

  it('formats zero, missing-progress, and out-of-range byte units defensively', () => {
    state.upload.isUploading = true;
    state.upload.progress = undefined;
    state.upload.uploadingFile = new File([], 'empty.bin');
    renderPlaceholder('file');
    const empty = screen.getByRole('button', { name: 'Add a file' });
    expect(empty.textContent).toContain('0 Byte');
    expect(empty.textContent).toContain('0%');
    cleanup();

    state.upload.uploadingFile = {
      name: 'huge.bin',
      size: 1024 ** 6,
    } as File;
    renderPlaceholder('file');
    expect(screen.getByRole('button', { name: 'Add a file' }).textContent).toContain('1 Bytes');
  });

  it('renders image progress, creates and revokes its object URL, and uses default progress', async () => {
    const file = new File(['image'], 'image.png');
    const createObjectURL = vi.fn(() => 'blob:image');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    const { unmount } = render(<ImageProgress file={file} />);
    await waitFor(() =>
      expect(screen.getByTestId('image-progress').getAttribute('data-url')).toBe('blob:image')
    );
    expect(screen.getByTestId('image-progress').getAttribute('data-progress')).toBe('0');
    fireEvent.click(screen.getByText('reset-url'));
    expect(screen.getByTestId('image-progress').getAttribute('data-url')).toBe('');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image');
  });

  it('replaces uploaded image and file placeholders with type-specific metadata', async () => {
    state.upload.isUploading = true;
    state.upload.progress = 75;
    state.upload.uploadingFile = new File(['image'], 'image.png');
    state.upload.uploadedFile = {
      key: 'image-key',
      url: 'https://files/image.png',
      name: 'image.png',
    };
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:image',
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const image = renderPlaceholder('img');

    await waitFor(() => expect(image.editor.tf.insertNodes).toHaveBeenCalled());
    expect(image.editor.tf.insertNodes).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'img',
        url: 'https://files/image.png',
        placeholderId: 'placeholder-img',
        initialHeight: 240,
        initialWidth: 320,
      }),
      { at: [0] }
    );
    expect(state.placeholder.removeUploadingFile).toHaveBeenCalledWith('placeholder-img');
    image.rerender(
      <PlaceholderElement
        {...({
          editor: image.editor,
          element: { ...image.element, mediaType: 'video' },
          attributes: {},
        } as unknown as PlaceholderProps)}
      >
        child
      </PlaceholderElement>
    );
    expect(image.editor.tf.insertNodes).toHaveBeenCalledTimes(1);
    cleanup();

    state.upload.isUploading = false;
    state.upload.uploadingFile = null;
    state.upload.uploadedFile = {
      key: 'image-without-dimensions',
      url: 'https://files/no-dimensions.png',
      name: 'no-dimensions.png',
    };
    const noDimensions = renderPlaceholder('img');
    await waitFor(() => expect(noDimensions.editor.tf.insertNodes).toHaveBeenCalled());
    expect(noDimensions.editor.tf.insertNodes).toHaveBeenCalledWith(
      expect.not.objectContaining({
        initialHeight: expect.anything(),
        initialWidth: expect.anything(),
      }),
      { at: [0] }
    );
    cleanup();

    state.upload.isUploading = false;
    state.upload.uploadingFile = null;
    state.upload.uploadedFile = {
      key: 'file-key',
      url: 'https://files/report.pdf',
      name: 'report.pdf',
    };
    const file = renderPlaceholder('file');
    await waitFor(() => expect(file.editor.tf.insertNodes).toHaveBeenCalled());
    expect(file.editor.tf.insertNodes).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'file', name: 'report.pdf' }),
      { at: [0] }
    );
  });

  it('warns for a missing path and tolerates unavailable upload history', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    state.upload.uploadedFile = { key: 'missing-path', url: 'https://files/audio', name: 'a.mp3' };
    const missingPathEditor = createEditor();
    missingPathEditor.api.findPath.mockReturnValue(undefined as never);
    renderPlaceholder('audio', missingPathEditor);
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Could not find path for placeholder element')
    );
    cleanup();

    state.upload.uploadedFile = { key: 'history-error', url: 'https://files/video', name: 'v.mp4' };
    state.updateUploadHistory.mockImplementation(() => {
      throw new Error('missing plugin');
    });
    renderPlaceholder('video');
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Upload history plugin not configured:', expect.any(Error))
    );
    warn.mockRestore();
  });
});
