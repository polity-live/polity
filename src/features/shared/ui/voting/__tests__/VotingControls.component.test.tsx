/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SelectedVoteBadge,
  VoteChoiceButtons,
  VotingPhaseBadge,
  VotingResultBadge,
  VotingResultCompact,
  VotingUnavailableMessage,
} from '../VotingControls';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/status', () => ({
  StatusBadge: ({ children, tone, status, ...props }: any) => (
    <div data-tone={tone} data-status={status} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/features/shared/ui/ui/tooltip', () => ({
  TooltipHint: ({ children, content }: any) => <span data-tooltip={content}>{children}</span>,
}));

afterEach(() => {
  cleanup();
});

describe('VotingPhaseBadge', () => {
  it('keeps the final vote pulse while using dark-mode-safe success tokens', () => {
    render(<VotingPhaseBadge phase="final" labels={{ final: 'Final Vote' }} />);

    const badge = screen.getByText('Final Vote');

    expect(badge.className).toContain('animate-pulse');
    expect(badge.className).toContain('border-[var(--badge-success-border)]');
    expect(badge.className).toContain('bg-[var(--badge-success-bg)]');
    expect(badge.className).toContain('text-[var(--badge-success-fg)]');
    expect(badge.className).not.toContain('text-white');
  });

  it('uses translated defaults and custom labels for every non-final phase', () => {
    const internal = render(<VotingPhaseBadge phase="internal" />);
    expect(screen.getByText('features.events.voting.phases.internal')).toBeTruthy();
    internal.unmount();

    const indication = render(
      <VotingPhaseBadge phase="indication" labels={{ indication: 'Opinion' }} />
    );
    expect(screen.getByText('Opinion').getAttribute('data-tone')).toBe('neutral');
    indication.unmount();

    render(<VotingPhaseBadge phase="closed" labels={{ closed: 'Closed' }} />);
    const closed = screen.getByText('Closed');
    expect(closed.getAttribute('data-tone')).toBe('success');
    expect(closed.className).toContain('badge-success-border');
  });
});

describe('shared voting controls', () => {
  const labels = { accept: 'Accept', reject: 'Reject', abstain: 'Abstain' };

  it('submits every vote choice with default button options', () => {
    const onVote = vi.fn();
    render(<VoteChoiceButtons labels={labels} onVote={onVote} />);

    for (const label of Object.values(labels)) fireEvent.click(screen.getByText(label));
    expect(onVote.mock.calls).toEqual([['accept'], ['reject'], ['abstain']]);
    expect(screen.getByText('Accept').closest('button')?.disabled).toBe(false);
  });

  it('disables choices for explicit disablement or loading and renders loading state', () => {
    const disabled = render(
      <VoteChoiceButtons
        labels={labels}
        onVote={vi.fn()}
        disabled
        isLoading={false}
        size="sm"
        className="choices"
      />
    );
    expect(screen.getByText('Accept').closest('button')?.disabled).toBe(true);
    disabled.unmount();

    render(
      <VoteChoiceButtons labels={labels} onVote={vi.fn()} disabled={false} isLoading size="lg" />
    );
    expect(screen.getByText('Reject').closest('button')?.disabled).toBe(true);
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(3);
  });

  it.each(['accept', 'reject', 'abstain'] as const)('renders the selected %s vote', vote => {
    render(
      <SelectedVoteBadge
        vote={vote}
        labels={{ prefix: 'Selected', ...labels }}
        className="selected"
      />
    );
    expect(screen.getByText(new RegExp(`Selected: ${labels[vote]}`))).toBeTruthy();
  });

  it('renders unavailable, detailed, and compact result variants', () => {
    const unavailable = render(
      <VotingUnavailableMessage className="unavailable">Not available</VotingUnavailableMessage>
    );
    expect(screen.getByText('Not available').className).toContain('unavailable');
    unavailable.unmount();

    const Icon = (props: { className?: string }) => <i data-testid="result-icon" {...props} />;
    const detailed = render(
      <VotingResultBadge
        label="Elected"
        Icon={Icon}
        winnerName="Ada"
        percentage={0}
        className="detailed"
        tone="success"
      />
    );
    expect(screen.getByTestId('result-icon')).toBeTruthy();
    expect(screen.getByText('Ada').parentElement?.getAttribute('data-tooltip')).toBe('Ada');
    expect(screen.getByText('0%')).toBeTruthy();
    detailed.unmount();

    const minimal = render(<VotingResultBadge label="Tied" Icon={Icon} showIcon={false} />);
    expect(screen.queryByTestId('result-icon')).toBeNull();
    expect(screen.getByText('Tied').parentElement?.getAttribute('data-tone')).toBe('neutral');
    minimal.unmount();

    const compactText = render(<VotingResultCompact label="Passed" />);
    expect(screen.getByText('Passed').parentElement?.getAttribute('title')).toBe('Passed');
    compactText.unmount();

    render(<VotingResultCompact label={<strong>Node label</strong>} tone="success" />);
    expect(
      screen.getByText('Node label').parentElement?.parentElement?.getAttribute('title')
    ).toBeNull();
  });
});
