/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ScrollableDialogContent } from '../DialogShell';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

afterEach(cleanup);

describe('management dialogs', () => {
  it('keeps a structured header, scrollable content, and sticky footer', () => {
    render(
      <Dialog open>
        <ScrollableDialogContent management>
          <DialogHeader>
            <DialogTitle>Manage members</DialogTitle>
            <DialogDescription>Choose the relevant settings.</DialogDescription>
          </DialogHeader>
          <div>Dialog body</div>
          <DialogFooter>Dialog actions</DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    );

    const content = screen.getByRole('dialog');
    expect(content.getAttribute('data-management-dialog')).toBe('true');
    expect(content.className).toContain('overflow-y-auto');
    expect(content.className).toContain('[&>[data-slot=dialog-footer]]:sticky');
    expect(screen.getByText('Dialog body')).toBeTruthy();
  });
});
