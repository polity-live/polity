/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageUpload } from '../ImageUpload';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/features/shared/ui/ui/sonner', () => ({ toast: { error: toastError } }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common.actions.dropImageHere': 'Drop image here',
        'common.actions.dragImageHere': 'Drag image here',
        'common.actions.orClickToBrowse': 'or choose a file',
        'common.actions.uploading': 'Uploading',
        'common.actions.uploadImage': 'Upload image',
        'common.labels.orProvideUrl': 'or provide a URL',
        'common.actions.edit': 'Edit',
        'common.actions.uploadImageTypesOnly': 'Images only',
      })[key] ?? key,
  }),
}));
vi.mock('../ImageEditorDialog', () => ({ ImageEditorDialog: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImageUpload dropzone', () => {
  it('keeps image drag and drop behavior when using the shared dropzone', async () => {
    const onFileUpload = vi.fn(async () => 'https://example.test/image.png');
    const onImageChange = vi.fn();
    render(<ImageUpload onImageChange={onImageChange} onFileUpload={onFileUpload} />);

    const image = new File(['image'], 'avatar.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('image-upload-dropzone'), {
      dataTransfer: { files: [image] },
    });

    await waitFor(() => expect(onFileUpload).toHaveBeenCalledWith(image));
    expect(onImageChange).toHaveBeenCalledWith('https://example.test/image.png');

    const text = new File(['text'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(screen.getByTestId('image-upload-dropzone'), {
      dataTransfer: { files: [text] },
    });
    expect(toastError).toHaveBeenCalledWith('Images only');
  });

  it('opens editing and removes an existing image through stable disabled-aware actions', () => {
    const onImageChange = vi.fn();
    const onImageRemove = vi.fn();
    const { container } = render(
      <ImageUpload
        currentImage="https://example.test/current.png"
        onImageChange={onImageChange}
        onImageRemove={onImageRemove}
      />
    );
    const edit = container.querySelector<HTMLElement>(
      '[data-action-id="file-upload.image.edit.open"]'
    )!;
    const remove = container.querySelector<HTMLElement>(
      '[data-action-id="file-upload.image.remove"]'
    )!;
    edit.focus();
    fireEvent.keyDown(edit, { key: 'Enter' });
    fireEvent.click(edit);
    fireEvent.click(remove);
    expect(onImageRemove).toHaveBeenCalledWith('https://example.test/current.png');
  });
});
