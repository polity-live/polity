/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

import { ChangeRoleDialog } from '../ui/ChangeRoleDialog';

afterEach(cleanup);

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    sort_order: 0,
    action_rights: [{ id: 'manage', resource: 'groups', action: 'manage' }],
  },
  {
    id: 'member',
    name: 'Member',
    sort_order: 1,
    action_rights: [{ id: 'read', resource: 'groups', action: 'read' }],
  },
] as any[];

describe('role assignment component flow', () => {
  it('assigns a selected role through the controller and dialog view', () => {
    const onConfirm = vi.fn();
    render(
      <ChangeRoleDialog
        isOpen
        onOpenChange={vi.fn()}
        memberName="Ada"
        currentRoles={[]}
        roles={roles}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByLabelText('Member'));
    fireEvent.click(screen.getByRole('button', { name: /save_roles/i }));
    expect(onConfirm).toHaveBeenCalledWith(['member']);
  });

  it('updates the effective-rights summary when the selected role changes', () => {
    render(
      <ChangeRoleDialog
        isOpen
        onOpenChange={vi.fn()}
        memberName="Ada"
        currentRoles={[]}
        roles={roles}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/0.*rights_from/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Admin'));
    expect(document.body.textContent).toContain('groups / manage');
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(1);
  });

  it('keeps the sole current admin selected when the dialog is reopened after cancel', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const view = render(
      <ChangeRoleDialog
        isOpen
        onOpenChange={onOpenChange}
        memberName="Sole Admin"
        currentRoles={[roles[0]]}
        roles={roles}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByLabelText('Admin').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    view.rerender(
      <ChangeRoleDialog
        isOpen
        onOpenChange={onOpenChange}
        memberName="Sole Admin"
        currentRoles={[roles[0]]}
        roles={roles}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByLabelText('Admin').getAttribute('aria-checked')).toBe('true');
  });
});
