/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openFilePicker: vi.fn(),
  uploadingFile: null as null | { name: string; size: number },
}));

vi.mock('@platejs/media/react', () => ({
  PlaceholderPlugin: { key: 'placeholder' },
  PlaceholderProvider: ({ children }: { children: ReactNode }) => children,
  updateUploadHistory: vi.fn(),
}));

vi.mock('platejs', () => ({
  KEYS: { audio: 'audio', file: 'file', img: 'img', video: 'video' },
}));

vi.mock('platejs/react', () => ({
  PlateElement: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useEditorPlugin: () => ({
    api: {
      placeholder: {
        addUploadingFile: vi.fn(),
        getUploadingFile: vi.fn(),
        removeUploadingFile: vi.fn(),
      },
    },
  }),
  withHOC: (_provider: unknown, Component: unknown) => Component,
}));

vi.mock('use-file-picker', () => ({
  useFilePicker: () => ({ openFilePicker: mocks.openFilePicker }),
}));

vi.mock('@/features/file-upload/hooks/use-upload-file.ts', () => ({
  useUploadFile: () => ({
    isUploading: Boolean(mocks.uploadingFile),
    progress: 0,
    uploadedFile: null,
    uploadFile: vi.fn(),
    uploadingFile: mocks.uploadingFile,
  }),
}));

import { PlaceholderElement } from '../media-placeholder-node';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('media placeholder accessibility', () => {
  it('opens the picker with pointer, Enter, and Space but ignores other keys', () => {
    const editor = {
      api: { findPath: vi.fn() },
      getTransforms: () => ({ insert: { media: vi.fn() } }),
      tf: { insertNodes: vi.fn(), removeNodes: vi.fn() },
    };
    const props = {
      editor,
      element: { id: 'placeholder-1', mediaType: 'img', children: [{ text: '' }] },
    } as any;
    render(<PlaceholderElement {...props}>child</PlaceholderElement>);

    const placeholder = screen.getByRole('button', { name: 'Add an image' });
    fireEvent.click(placeholder);
    fireEvent.keyDown(placeholder, { key: 'Enter' });
    fireEvent.keyDown(placeholder, { key: ' ' });
    fireEvent.keyDown(placeholder, { key: 'Escape' });

    expect(mocks.openFilePicker).toHaveBeenCalledTimes(3);
  });

  it('removes the placeholder from the tab order while a file is uploading', () => {
    mocks.uploadingFile = { name: 'document.pdf', size: 1024 };
    const editor = {
      api: { findPath: vi.fn() },
      getTransforms: () => ({ insert: { media: vi.fn() } }),
      tf: { insertNodes: vi.fn(), removeNodes: vi.fn() },
    };
    const props = {
      editor,
      element: { id: 'placeholder-1', mediaType: 'file', children: [{ text: '' }] },
    } as any;
    render(<PlaceholderElement {...props}>child</PlaceholderElement>);

    expect(screen.getByRole('button', { name: 'Add a file' }).getAttribute('tabindex')).toBe('-1');
    mocks.uploadingFile = null;
  });
});
