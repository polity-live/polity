/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertDialog } from '@/features/shared/ui/ui/alert-dialog';
import { Sheet } from '@/features/shared/ui/ui/sheet';

import {
  ConfirmDialog,
  DangerConfirmDialog,
  DialogShell,
  EntityDialog,
  FormDialog,
  ScrollableAlertDialogContent,
  ScrollableSheetContent,
  SelectionDialog,
} from '../DialogShell';

afterEach(cleanup);

describe('DialogShell', () => {
  it('renders title, description, body, and footer when open', () => {
    render(
      <DialogShell
        open
        onOpenChange={() => undefined}
        title="Invite members"
        description="Choose people to invite"
        footer={<button type="button">Send invite</button>}
      >
        <p>Dialog body</p>
      </DialogShell>
    );

    expect(screen.getByText('Invite members')).toBeTruthy();
    expect(screen.getByText('Choose people to invite')).toBeTruthy();
    expect(screen.getByText('Dialog body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeTruthy();
  });

  it('keeps EntityDialog as a compatibility alias', () => {
    render(
      <EntityDialog
        open
        onOpenChange={() => undefined}
        title="Legacy dialog"
        description="Legacy description"
      >
        <p>Legacy body</p>
      </EntityDialog>
    );

    expect(screen.getByText('Legacy dialog')).toBeTruthy();
    expect(screen.getByText('Legacy description')).toBeTruthy();
    expect(screen.getByText('Legacy body')).toBeTruthy();
  });

  it('supports a trigger, non-scrollable content, and omitted optional regions', () => {
    render(
      <DialogShell
        open
        onOpenChange={vi.fn()}
        scrollable={false}
        size="sm"
        title="Plain dialog"
        trigger={<button type="button">Open plain</button>}
      >
        Plain body
      </DialogShell>
    );
    expect(screen.getByText('Open plain')).toBeTruthy();
    expect(screen.queryByText('Choose people to invite')).toBeNull();
  });

  it('wraps forms and forwards submit behavior', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <FormDialog
        open
        onOpenChange={vi.fn()}
        title="Form dialog"
        formId="profile-form"
        onSubmit={onSubmit}
        bodyClassName="form-body"
      >
        <button type="submit">Save</button>
      </FormDialog>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('renders default, explicit, and danger confirmation variants', () => {
    const onConfirm = vi.fn();
    const view = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Confirm default"
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        trigger={<button type="button">Open confirm</button>}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalled();

    view.rerender(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Disabled confirm"
        description="Cannot confirm"
        cancelLabel="Back"
        confirmLabel="Disabled"
        confirmVariant="outline"
        disabled
        onConfirm={vi.fn()}
      />
    );
    expect((screen.getByRole('button', { name: 'Disabled' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    view.rerender(
      <DangerConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete"
        cancelLabel="Keep"
        confirmLabel="Delete now"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Delete now' })).toBeTruthy();
  });

  it('renders selection option states and delegates enabled selection', () => {
    const onSelect = vi.fn();
    render(
      <SelectionDialog
        open
        onOpenChange={vi.fn()}
        title="Select option"
        selectedValue="selected"
        onSelect={onSelect}
        options={[
          { description: 'Selected description', label: 'Selected', value: 'selected' },
          { disabled: true, label: 'Disabled', value: 'disabled' },
          { label: 'Available', value: 'available' },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Available/ }));
    expect(onSelect).toHaveBeenCalledWith('available');
    expect((screen.getByRole('button', { name: /Disabled/ }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('renders the alert and sheet scroll wrappers', () => {
    render(
      <>
        <AlertDialog open>
          <ScrollableAlertDialogContent>Alert scroll</ScrollableAlertDialogContent>
        </AlertDialog>
        <Sheet open>
          <ScrollableSheetContent>Sheet scroll</ScrollableSheetContent>
        </Sheet>
      </>
    );
    expect(screen.getByText('Alert scroll')).toBeTruthy();
    expect(screen.getByText('Sheet scroll')).toBeTruthy();
  });
});
