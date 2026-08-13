/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileDropzone } from '../FileDropzone';

afterEach(cleanup);

function renderDropzone(overrides: Partial<React.ComponentProps<typeof FileDropzone>> = {}) {
  const onFilesSelected = vi.fn();
  const onFilesRejected = vi.fn();
  const view = render(
    <FileDropzone
      idleLabel="Idle"
      activeLabel="Active"
      browseLabel="Browse"
      onFilesSelected={onFilesSelected}
      onFilesRejected={onFilesRejected}
      {...overrides}
    />
  );
  return { ...view, onFilesRejected, onFilesSelected };
}

describe('FileDropzone remaining branches A09', () => {
  it('accepts files when no accept filter is configured and ignores an empty drop', () => {
    const { onFilesSelected } = renderDropzone({ accept: '   ' });
    const zone = screen.getByTestId('file-dropzone');
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(['x'], 'anything.bin', { type: 'application/octet-stream' })],
      },
    });
    expect(onFilesSelected).toHaveBeenCalledOnce();
  });

  it('covers wildcard, exact mime, extension, and mixed rejection matching', () => {
    const image = new File(['x'], 'photo.bin', { type: 'image/png' });
    const csv = new File(['x'], 'report.CSV', { type: 'application/unknown' });
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const { onFilesRejected, onFilesSelected } = renderDropzone({
      accept: ' image/*, text/plain, .csv,  ',
      maxFiles: 4,
      maxSize: 2,
    });
    Object.defineProperty(text, 'size', { value: 3 });

    fireEvent.drop(screen.getByTestId('file-dropzone'), {
      dataTransfer: { files: [image, csv, text] },
    });
    expect(onFilesSelected).toHaveBeenCalledWith([image, csv]);
    expect(onFilesRejected).toHaveBeenCalledWith([
      expect.objectContaining({ code: 'file-size', file: text }),
    ]);
  });

  it('tracks nested drag enter/leave and sets copy only while enabled', () => {
    renderDropzone();
    const zone = screen.getByTestId('file-dropzone');
    fireEvent.dragEnter(zone);
    fireEvent.dragEnter(zone);
    fireEvent.dragLeave(zone);
    expect(screen.getByText('Active')).toBeTruthy();
    fireEvent.dragLeave(zone);
    expect(screen.getByText('Idle')).toBeTruthy();

    const transfer = { dropEffect: 'none', files: [] };
    fireEvent.dragOver(zone, { dataTransfer: transfer });
    expect(transfer.dropEffect).toBe('copy');
  });

  it('suppresses disabled interactions and renders both busy-label fallbacks', () => {
    const file = new File(['x'], 'x.png', { type: 'image/png' });
    const disabled = renderDropzone({ disabled: true, hint: 'Hint' });
    const zone = screen.getByTestId('file-dropzone');
    fireEvent.dragEnter(zone);
    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: 'none', files: [file] } });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(disabled.onFilesSelected).not.toHaveBeenCalled();
    disabled.unmount();

    const fallback = renderDropzone({ busy: true });
    expect(screen.getByText('Browse')).toBeTruthy();
    fallback.unmount();
    renderDropzone({ busy: true, busyLabel: 'Uploading' });
    expect(screen.getByText('Uploading')).toBeTruthy();
  });

  it('works without an optional rejection callback and accepts input selections', () => {
    const onFilesSelected = vi.fn();
    const { container } = render(
      <FileDropzone
        accept="image/png"
        idleLabel="Idle"
        activeLabel="Active"
        browseLabel="Browse"
        onFilesSelected={onFilesSelected}
      />
    );
    const input = container.querySelector('input[type="file"]')!;
    const rejected = new File(['x'], 'x.txt', { type: 'text/plain' });
    const accepted = new File(['x'], 'x.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [rejected] } });
    fireEvent.change(input, { target: { files: [accepted] } });
    expect(onFilesSelected).toHaveBeenCalledWith([accepted]);
  });
});
