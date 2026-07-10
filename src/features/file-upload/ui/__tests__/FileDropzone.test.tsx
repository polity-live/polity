/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileDropzone } from '../FileDropzone';

afterEach(cleanup);

function renderDropzone(overrides: Partial<ComponentProps<typeof FileDropzone>> = {}) {
  const onFilesSelected = vi.fn();
  const onFilesRejected = vi.fn();
  const result = render(
    <FileDropzone
      accept=".csv,.tsv,text/csv,text/tab-separated-values"
      maxFiles={1}
      maxSize={50 * 1024 * 1024}
      idleLabel="Drag a file here"
      activeLabel="Drop it here"
      browseLabel="Choose file"
      onFilesSelected={onFilesSelected}
      onFilesRejected={onFilesRejected}
      {...overrides}
    />
  );
  return { ...result, onFilesSelected, onFilesRejected };
}

describe('FileDropzone', () => {
  it('accepts one CSV through drag and drop', () => {
    const { onFilesSelected } = renderDropzone();
    const file = new File(['year,value\n2025,42'], 'data.csv', { type: 'text/csv' });
    const dropzone = screen.getByTestId('file-dropzone');

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
    expect(screen.getByText('Drop it here')).toBeTruthy();
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('validates type, size and file count for both input paths', () => {
    const { container, onFilesRejected, onFilesSelected } = renderDropzone();
    const textFile = new File(['not csv'], 'notes.txt', { type: 'text/plain' });
    const largeFile = new File(['x'], 'large.csv', { type: 'text/csv' });
    Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 + 1 });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [textFile] } });
    expect(onFilesRejected).toHaveBeenLastCalledWith([
      expect.objectContaining({ code: 'file-type', file: textFile }),
    ]);

    fireEvent.change(input, { target: { files: [largeFile] } });
    expect(onFilesRejected).toHaveBeenLastCalledWith([
      expect.objectContaining({ code: 'file-size', file: largeFile }),
    ]);

    fireEvent.drop(screen.getByTestId('file-dropzone'), {
      dataTransfer: { files: [textFile, largeFile] },
    });
    expect(onFilesRejected).toHaveBeenLastCalledWith([{ code: 'too-many-files' }]);
    expect(onFilesSelected).not.toHaveBeenCalled();
  });
});
