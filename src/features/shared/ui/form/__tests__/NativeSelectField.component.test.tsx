/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NativeSelectField } from '../NativeSelectField';

const shell = vi.hoisted(() => ({ invalid: false }));
vi.mock('../FormFieldShell', () => ({
  FormFieldShell: ({
    children,
  }: {
    children: (state: Record<string, unknown>) => React.ReactNode;
  }) => children({ id: 'field', describedBy: 'description', invalid: shell.invalid }),
}));
vi.mock('@/features/shared/ui/ui/native-select', () => ({
  NativeSelect: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

afterEach(cleanup);

describe('NativeSelectField', () => {
  it('omits invalid state for a valid field', () => {
    render(
      <NativeSelectField>
        <option>One</option>
      </NativeSelectField>
    );
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBeNull();
  });

  it('marks an invalid field', () => {
    shell.invalid = true;
    render(<NativeSelectField />);
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
    shell.invalid = false;
  });
});
