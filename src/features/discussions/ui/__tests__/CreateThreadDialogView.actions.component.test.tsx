/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateThreadDialogView } from '../CreateThreadDialogView';

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));

afterEach(cleanup);

function props(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    description: '',
    isSubmitting: false,
    isUploading: false,
    selectedFile: null,
    title: 'Discussion title',
    onDescriptionChange: vi.fn(),
    onFileChange: vi.fn(),
    onRemoveFile: vi.fn(),
    onSubmit: vi.fn(),
    onTitleChange: vi.fn(),
    ...overrides,
  } as any;
}

describe('CreateThreadDialogView action contracts', () => {
  it('dispatches create-thread file, cancel, and submit actions through stable intents', () => {
    const viewProps = props();
    render(<CreateThreadDialogView {...viewProps} />);

    const choose = document.querySelector(
      '[data-action-id="discussions.create.attachment.choose"]'
    ) as HTMLButtonElement;
    expect(choose).toBeTruthy();
    choose.focus();
    expect(document.activeElement).toBe(choose);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'agenda.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(viewProps.onFileChange).toHaveBeenCalledWith(file);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const submit = screen.getByRole('button', { name: 'Create Thread' });
    expect(cancel.dataset.actionId).toBe('discussions.create.cancel');
    expect(submit.dataset.actionId).toBe('discussions.create.submit');
    fireEvent.click(cancel);
    fireEvent.click(submit);
    expect(viewProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(viewProps.onSubmit).toHaveBeenCalledOnce();
  });

  it('removes an attachment through its stable intent and disables async actions', () => {
    const viewProps = props({
      selectedFile: new File(['content'], 'agenda.pdf', { type: 'application/pdf' }),
    });
    const view = render(<CreateThreadDialogView {...viewProps} />);

    let remove = document.querySelector(
      '[data-action-id="discussions.create.attachment.remove"]'
    ) as HTMLButtonElement;
    fireEvent.click(remove);
    expect(viewProps.onRemoveFile).toHaveBeenCalledOnce();

    view.rerender(<CreateThreadDialogView {...viewProps} isUploading />);
    remove = document.querySelector(
      '[data-action-id="discussions.create.attachment.remove"]'
    ) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    expect(
      (document.querySelector('[data-action-id="discussions.create.submit"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('formats kilobyte and megabyte attachments and clears an empty file choice', () => {
    const viewProps = props({
      selectedFile: new File([new Uint8Array(2048)], 'kilobytes.csv'),
    });
    const view = render(<CreateThreadDialogView {...viewProps} />);
    expect(screen.getByText('2.0 KB')).toBeTruthy();

    view.rerender(
      <CreateThreadDialogView
        {...viewProps}
        selectedFile={new File([new Uint8Array(2 * 1024 * 1024)], 'megabytes.csv')}
      />
    );
    expect(screen.getByText('2.0 MB')).toBeTruthy();
  });

  it('shows creating state independently from upload state', () => {
    render(<CreateThreadDialogView {...props({ isSubmitting: true })} />);

    expect(
      (screen.getByRole('button', { name: 'Creating...' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
