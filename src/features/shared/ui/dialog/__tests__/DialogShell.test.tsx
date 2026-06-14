/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DialogShell, EntityDialog } from '../DialogShell';

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
});
