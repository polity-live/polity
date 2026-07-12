/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { AgendaContentHeader, AgendaContextTabs, AgendaVotingWorkspace } from '../AgendaUiSystem';

afterEach(cleanup);

describe('AgendaUiSystem', () => {
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

    const speakerTab = screen.getByRole('tab', { name: 'Speaker list' });
    fireEvent.mouseDown(speakerTab, { button: 0 });
    expect(screen.getByText('Speaker queue')).toBeTruthy();
  });
});
