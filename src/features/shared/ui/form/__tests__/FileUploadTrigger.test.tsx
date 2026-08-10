/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileUploadTrigger } from '../FileUploadTrigger';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FileUploadTrigger', () => {
  it('opens the hidden input and forwards a selected file through both callbacks', () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const onChange = vi.fn();
    const onFilesSelected = vi.fn();
    const refCallback = vi.fn();
    const { container } = render(
      <FileUploadTrigger
        inputRef={refCallback}
        inputProps={{ accept: 'image/*', onChange }}
        onFilesSelected={onFilesSelected}
        inputClassName="custom-input"
      >
        Upload image
      </FileUploadTrigger>
    );
    const input = container.querySelector('input[type="file"]')! as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(inputClick).toHaveBeenCalledOnce();
    expect(refCallback).toHaveBeenCalledWith(input);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onFilesSelected).toHaveBeenCalledWith([file], expect.anything());
    expect(input.tabIndex).toBe(-1);
    expect(input.className).toContain('custom-input');
  });

  it('supports object refs, custom tab order, and opting out of reset', () => {
    const inputRef = createRef<HTMLInputElement>();
    const { container } = render(
      <FileUploadTrigger inputRef={inputRef} resetOnSelect={false} inputProps={{ tabIndex: 2 }}>
        Upload
      </FileUploadTrigger>
    );
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { files: [] } });

    expect(inputRef.current).toBe(input);
    expect(input.tabIndex).toBe(2);
  });

  it('does not open when the click is prevented or either disabled flag is set', () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const prevented = render(
      <FileUploadTrigger onClick={event => event.preventDefault()}>Prevented</FileUploadTrigger>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Prevented' }));
    expect(inputClick).not.toHaveBeenCalled();
    prevented.unmount();

    const inputDisabled = render(
      <FileUploadTrigger disabled={false} inputProps={{ disabled: true }}>
        Input disabled
      </FileUploadTrigger>
    );
    expect(screen.getByRole('button', { name: 'Input disabled' })).toHaveProperty('disabled', true);
    inputDisabled.unmount();

    render(<FileUploadTrigger disabled>Button disabled</FileUploadTrigger>);
    expect(screen.getByRole('button', { name: 'Button disabled' })).toHaveProperty(
      'disabled',
      true
    );
  });
});
