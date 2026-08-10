/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from '@/features/shared/ui/ui/dialog';

import {
  AgendaContentHeader,
  AgendaContextTabs,
  AgendaDialogContent,
  AgendaSection,
  AgendaSectionHeading,
  AgendaSurface,
  AgendaVotingWorkspace,
} from '../AgendaUiSystem';

afterEach(cleanup);

describe('AgendaUiSystem', () => {
  it('renders reusable agenda surfaces and composed sections', () => {
    const { rerender } = render(<AgendaSurface className="surface">Standalone</AgendaSurface>);
    expect(screen.getByText('Standalone').className).toContain('surface');

    rerender(
      <AgendaSection title="Section" className="section" contentClassName="content">
        Body
      </AgendaSection>
    );
    expect(screen.getByRole('heading', { name: 'Section' })).toBeTruthy();
    expect(screen.getByText('Body').className).toContain('content');
  });

  it('keeps the compact content header separate from the fixed agenda controls', () => {
    render(
      <AgendaContentHeader
        eyebrow="TOP-3"
        title="Budget"
        description="Discuss and decide the budget."
        badges={<span>Live</span>}
        action={<button type="button">Fullscreen</button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'Budget' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeTruthy();
    expect(screen.queryByLabelText('Agenda controls')).toBeNull();
  });

  it('omits optional heading and header regions when they are absent', () => {
    const { rerender } = render(<AgendaSectionHeading title="Agenda" />);
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy();
    expect(document.querySelector('.shrink-0')).toBeNull();

    rerender(<AgendaContentHeader title="Agenda" />);
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeTruthy();
    expect(document.querySelector('header .shrink-0')).toBeNull();
  });

  it('renders every optional section-heading region', () => {
    render(
      <AgendaSectionHeading
        title="Agenda"
        eyebrow="Current"
        description="Description"
        action={<button type="button">Act</button>}
      />
    );
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Act' })).toBeTruthy();
  });

  it('uses the same voting workspace contract in every agenda mode', () => {
    const { rerender } = render(
      <AgendaVotingWorkspace
        mode="overview"
        title="Voting"
        changeRequests={<div>Change request sequence</div>}
      />
    );

    expect(screen.getByText('Change request sequence')).toBeTruthy();
    expect(document.querySelector('[data-agenda-voting-workspace="overview"]')).toBeTruthy();

    rerender(
      <AgendaVotingWorkspace mode="fullscreen" title="Voting" vote={<div>Final vote</div>} />
    );

    expect(screen.getByText('Final vote')).toBeTruthy();
    expect(document.querySelector('[data-agenda-voting-workspace="fullscreen"]')).toBeTruthy();
  });

  it('renders an explicit or empty voting-workspace fallback', () => {
    const { container, rerender } = render(
      <AgendaVotingWorkspace mode="detail" title="Voting" emptyState={<div>No ballot</div>} />
    );
    expect(screen.getByText('No ballot')).toBeTruthy();

    rerender(<AgendaVotingWorkspace mode="detail" title="Voting" />);
    expect(container.querySelector('[data-agenda-voting-workspace]')?.textContent).toBe('Voting');
  });

  it('uses standard dialog sizing by default and accepts an explicit size', () => {
    const { rerender } = render(
      <Dialog open>
        <AgendaDialogContent>Body</AgendaDialogContent>
      </Dialog>
    );
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain(
      'sm:max-w-xl'
    );

    rerender(
      <Dialog open>
        <AgendaDialogContent size="wide">Body</AgendaDialogContent>
      </Dialog>
    );
    expect(document.querySelector('[data-slot="dialog-content"]')?.className).toContain(
      'sm:max-w-3xl'
    );
  });

  it('switches between details and speaker list without rendering both as active', () => {
    function TestTabs() {
      const [value, setValue] = useState<'details' | 'speakers'>('details');
      return (
        <AgendaContextTabs
          value={value}
          onValueChange={setValue}
          detailsLabel="Details"
          speakersLabel="Speaker list"
          details={<div>Amendment context</div>}
          speakers={<div>Speaker queue</div>}
        />
      );
    }

    render(<TestTabs />);
    expect(screen.getByText('Amendment context')).toBeTruthy();

    const detailsTab = screen.getByRole('tab', { name: 'Details' });
    const speakerTab = screen.getByRole('tab', { name: 'Speaker list' });
    expect(detailsTab.getAttribute('data-action-id')).toBe('agendas.context.details.select');
    expect(speakerTab.getAttribute('data-action-id')).toBe('agendas.context.speakers.select');
    speakerTab.focus();
    expect(document.activeElement).toBe(speakerTab);
    fireEvent.mouseDown(speakerTab, { button: 0 });
    expect(screen.getByText('Speaker queue')).toBeTruthy();
  });
});
