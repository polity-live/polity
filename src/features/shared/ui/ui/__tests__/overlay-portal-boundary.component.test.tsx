/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from '../dialog';
import { OverlayPortalBoundary } from '../overlay-portal-boundary';

afterEach(cleanup);

function ContainedDialog() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setContainer} data-testid="boundary" className="relative">
      <OverlayPortalBoundary container={container}>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Contained dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </OverlayPortalBoundary>
    </div>
  );
}

describe('OverlayPortalBoundary', () => {
  it('ports dialogs and their absolute overlay into the local container', () => {
    render(<ContainedDialog />);
    const boundary = screen.getByTestId('boundary');
    const dialog = screen.getByRole('dialog', { name: 'Contained dialog' });
    const overlay = boundary.querySelector('[data-slot="dialog-overlay"]');

    expect(dialog.parentElement).toBe(boundary);
    expect(dialog.className).toContain('absolute');
    expect(overlay?.className).toContain('absolute');
  });

  it('can render a non-modal centered dialog without an overlay', () => {
    render(
      <Dialog open modal={false}>
        <DialogContent showCloseButton={false} showOverlay={false}>
          <DialogTitle>Centered discussion</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog', { name: 'Centered discussion' });

    expect(dialog.className).toContain('top-[50%]');
    expect(dialog.className).toContain('left-[50%]');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();
  });
});
