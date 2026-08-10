/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { DialogFooter, DialogHeader } from '../dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '../form';

function FormExample({ error, message }: { error?: boolean; message?: string }) {
  const methods = useForm({ defaultValues: { name: '' } });
  useEffect(() => {
    if (error) methods.setError('name', { message: 'Required' });
    else methods.clearErrors('name');
  }, [error, methods]);

  return (
    <Form {...methods}>
      <FormField
        control={methods.control}
        name="name"
        render={() => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <input />
            </FormControl>
            <FormDescription>Description</FormDescription>
            <FormMessage>{message}</FormMessage>
          </FormItem>
        )}
      />
    </Form>
  );
}

function InvalidFormFieldProbe() {
  useFormField();
  return null;
}

describe('A01 form and dialog primitives', () => {
  it('throws when the form field hook has no provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<InvalidFormFieldProbe />)).toThrow(
      'useFormField should be used within <FormField>'
    );
    consoleError.mockRestore();
  });

  it('renders description and child messages without an error', () => {
    render(<FormExample message="Hint" />);
    expect(screen.getByText('Hint')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('renders field errors and suppresses an empty message', async () => {
    const { rerender } = render(<FormExample error />);
    await waitFor(() => expect(screen.getByText('Required')).toBeTruthy());
    rerender(<FormExample />);
    await waitFor(() => expect(screen.queryByText('Required')).toBeNull());
  });

  it('covers separator and sticky dialog section classes', () => {
    render(
      <>
        <DialogHeader separator surface="background" />
        <DialogFooter sticky />
      </>
    );
    expect(document.querySelector('[data-slot="dialog-header"]')?.className).toContain('border-b');
    expect(document.querySelector('[data-slot="dialog-footer"]')?.className).toContain('sticky');
  });
});
