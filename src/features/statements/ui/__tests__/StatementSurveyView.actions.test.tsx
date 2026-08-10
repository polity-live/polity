/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatementSurveyView } from '../StatementSurveyView';

afterEach(cleanup);

const options = [
  { optionId: 'option-1', label: 'Approve', percent: 60 },
  { optionId: 'option-2', label: 'Reject', percent: 40 },
];

describe('StatementSurveyView action contracts', () => {
  it('votes, changes, and retracts a survey vote through keyboard-accessible actions', () => {
    const onVote = vi.fn();
    const onRetract = vi.fn();
    const props = {
      isExpired: false,
      onRetract,
      onVote,
      options,
      question: 'Decision',
      retractLabel: 'Retract vote',
      timeLabel: '1 hour left',
      totalVotesLabel: '10 votes',
    };
    const view = render(<StatementSurveyView {...props} />);

    const initialVote = screen.getByRole('button', { name: 'Approve' });
    expect(initialVote.dataset.actionId).toBe('statements.survey.option.vote');
    initialVote.focus();
    expect(document.activeElement).toBe(initialVote);
    fireEvent.click(initialVote);
    expect(onVote).toHaveBeenCalledWith('option-1');

    view.rerender(
      <StatementSurveyView {...props} userVote={{ id: 'vote-1', option_id: 'option-1' }} />
    );

    const changeVote = screen.getByRole('button', { name: /Reject40%/ });
    expect(changeVote.dataset.actionId).toBe('statements.survey.option.change');
    changeVote.focus();
    fireEvent.keyDown(changeVote, { key: 'Enter' });
    fireEvent.click(changeVote);
    expect(onVote).toHaveBeenLastCalledWith('option-2', 'vote-1');

    const retractVote = screen.getByRole('button', { name: 'Retract vote' });
    expect(retractVote.dataset.actionId).toBe('statements.survey.vote.retract');
    fireEvent.click(retractVote);
    expect(onRetract).toHaveBeenCalledWith('vote-1');
  });

  it('does not expose change or retract actions after the survey expires', () => {
    render(
      <StatementSurveyView
        isExpired
        onRetract={vi.fn()}
        onVote={vi.fn()}
        options={options}
        question="Decision"
        retractLabel="Retract vote"
        timeLabel="Expired"
        totalVotesLabel="10 votes"
        userVote={{ id: 'vote-1', option_id: 'option-1' }}
      />
    );

    expect(document.querySelector('[data-action-id="statements.survey.option.change"]')).toBeNull();
    expect(document.querySelector('[data-action-id="statements.survey.vote.retract"]')).toBeNull();
  });
});
