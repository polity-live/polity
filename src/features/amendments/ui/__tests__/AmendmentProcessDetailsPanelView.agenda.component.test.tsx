/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentProcessDetailsPanelView } from '../AmendmentProcessDetailsPanelView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));

afterEach(cleanup);

describe('AmendmentProcessDetailsPanelView agenda variant', () => {
  it('keeps process content while hiding identity fields already shown in the agenda header', () => {
    const onOpenChange = vi.fn();
    render(
      <AmendmentProcessDetailsPanelView
        amendment={{
          id: 'amendment-1',
          title: 'A1',
          reason: 'Repeated reason',
          preamble: 'Fixture preamble',
          group: { id: 'group-1', name: 'K1' },
        }}
        open
        onOpenChange={onOpenChange}
        variant="agenda"
        labels={{
          amendmentDetails: 'Amendment context',
          viewAmendment: 'View amendment',
          title: 'Title',
          reason: 'Reason',
          preamble: 'Preamble',
          pathVisualization: 'Process flow',
        }}
      />
    );

    expect(screen.getByText('Amendment context')).toBeTruthy();
    expect(screen.getByText('Fixture preamble')).toBeTruthy();
    expect(screen.queryByText('A1')).toBeNull();
    expect(screen.queryByText('Repeated reason')).toBeNull();
    expect(screen.queryByText('K1')).toBeNull();
    expect(screen.queryByText('View amendment')).toBeNull();
    const trigger = document.querySelector(
      '[data-action-id="amendments.process-details.toggle.panel"]'
    );
    fireEvent.click(trigger!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
