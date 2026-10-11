/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AmendmentProcessDetailsPanelView } from '../AmendmentProcessDetailsPanelView';
import { ElectionDetailsSectionView } from '@/features/agendas/ui/ElectionDetailsSectionView';
import userEvent from '@testing-library/user-event';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));

afterEach(cleanup);

describe('AmendmentProcessDetailsPanelView agenda variant', () => {
  it.each(['amendment', 'election'])(
    'keeps the %s details panel linked and keyboard operable while closed content is unmounted',
    async kind => {
      const onOpenChange = vi.fn();
      const labels = {
        amendmentDetails: 'Context',
        viewAmendment: 'View',
        title: 'Title',
        reason: 'Reason',
        preamble: 'Preamble',
        pathVisualization: 'Flow',
        roleDetails: 'Context',
        viewGroup: 'Group',
        role: 'Role',
        description: 'Description',
        term: 'Term',
      };
      const content = (open: boolean) =>
        kind === 'amendment' ? (
          <AmendmentProcessDetailsPanelView
            amendment={{ id: 'amendment', preamble: 'Details content' }}
            labels={labels}
            open={open}
            onOpenChange={onOpenChange}
            variant="agenda"
          />
        ) : (
          <ElectionDetailsSectionView
            election={{ role: { id: 'role', description: 'Details content' } }}
            labels={labels}
            open={open}
            onOpenChange={onOpenChange}
          />
        );
      const view = render(content(false));
      const trigger = screen.getByRole('button', { name: 'Context' });
      const panelId = trigger.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(document.getElementById(String(panelId))?.hidden).toBe(true);
      expect(screen.queryByText('Details content')).toBeNull();
      trigger.focus();
      await userEvent.setup().keyboard(' ');
      expect(onOpenChange).toHaveBeenCalledWith(true);
      view.rerender(content(true));
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(document.getElementById(String(panelId))?.hidden).toBe(false);
      expect(screen.getByText('Details content')).toBeTruthy();
      view.rerender(content(false));
      expect(screen.queryByText('Details content')).toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    }
  );
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
