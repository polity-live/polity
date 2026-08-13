/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ValidatedFieldView } from '../ValidatedFieldView';

vi.mock('@/features/shared/ui/form/FormFieldShell', () => ({
  FormFieldShell: ({ children, error }: any) =>
    children({ id: 'field-id', describedBy: 'field-description', invalid: Boolean(error) }),
}));

afterEach(() => cleanup());

describe('ValidatedFieldView', () => {
  it('handles a valid multiline value and forwards blur', () => {
    const onValueChange = vi.fn();
    const markTouched = vi.fn();
    const onBlur = vi.fn();
    render(
      <ValidatedFieldView
        {...baseProps}
        multiline
        normalizedValue="Long text"
        error="Warning"
        isValid
        onValueChange={onValueChange}
        markTouched={markTouched}
        onBlur={onBlur}
        className="textarea-custom"
      />
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Changed text' } });
    fireEvent.blur(textarea);

    expect(onValueChange).toHaveBeenCalledWith('Changed text');
    expect(markTouched).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalledOnce();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('data-valid')).toBe('true');
    expect(textarea.className).toContain('textarea-custom');
  });

  it('handles an invalid plain input without an optional blur callback', () => {
    const onValueChange = vi.fn();
    const markTouched = vi.fn();
    render(
      <ValidatedFieldView
        {...baseProps}
        multiline={false}
        normalizedValue="Short text"
        error={null}
        isValid={false}
        onValueChange={onValueChange}
        markTouched={markTouched}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.blur(input);

    expect(onValueChange).toHaveBeenCalledWith('Changed');
    expect(markTouched).toHaveBeenCalledTimes(2);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('data-valid')).toBeNull();
  });

  it('covers the complementary validity states for both control types', () => {
    const textarea = render(
      <ValidatedFieldView
        {...baseProps}
        multiline
        normalizedValue=""
        error={null}
        isValid={false}
      />
    );
    expect(screen.getByRole('textbox').getAttribute('data-valid')).toBeNull();
    textarea.unmount();

    render(
      <ValidatedFieldView
        {...baseProps}
        multiline={false}
        normalizedValue="Valid"
        error="Error"
        isValid
        onBlur={vi.fn()}
      />
    );
    expect(screen.getByRole('textbox').getAttribute('data-valid')).toBe('true');
  });
});

const baseProps = {
  value: '',
  onValueChange: vi.fn(),
  normalizedValue: '',
  error: null,
  isValid: false,
  markTouched: vi.fn(),
};
