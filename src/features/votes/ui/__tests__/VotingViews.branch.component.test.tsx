/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VotingPhaseIndicator } from '../VotingPhaseIndicator';
import { VotingPhaseIndicatorView } from '../VotingPhaseIndicatorView';
import { VotingSessionManagerView } from '../VotingSessionManagerView';
import { VoteControlsView } from '../VoteControlsView';
import { useVotingSessionManagerController } from '../useVotingSessionManagerController';

const mocks = vi.hoisted(() => ({ eventVoting: {} as any }));

vi.mock('../../hooks/useEventVoting', () => ({ useEventVoting: () => mocks.eventVoting }));
vi.mock('../../hooks/useVotingTimer', () => ({
  useSyncedVotingTimer: (_startedAt: unknown, duration: number) => ({
    formattedTime: duration ? '0:20' : '0:00',
    timeRemaining: duration ? 20 : 0,
    isExpired: duration === 0,
  }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children, variant, className }: any) => (
    <span data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, surface }: any) => <div data-surface={surface}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange }: any) => (
    <div data-open={String(open)} onDoubleClick={() => onOpenChange(!open)}>
      {children}
    </div>
  ),
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: any) => <>{children}</>,
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children }: any) => <label>{children}</label>,
  FormControlSelect: ({ children, onValueChange }: any) => (
    <div data-testid="majority" onClick={() => onValueChange('absolute')}>
      {children}
    </div>
  ),
  FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
  FormControlSelectItem: ({ children }: any) => <span>{children}</span>,
  FormControlSelectTrigger: ({ children }: any) => <div>{children}</div>,
  FormControlSelectValue: () => <span>value</span>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ alt, src }: any) => <img alt={alt} src={src} />,
}));

afterEach(cleanup);

const t = (key: string, fallback?: string) => fallback ?? key;
const Icon = (props: any) => <i {...props} />;

function phaseProps(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'voting',
    duration: 60,
    startedAt: 1,
    result: null,
    acceptCount: 2,
    rejectCount: 1,
    abstainCount: 1,
    totalEligible: 8,
    onExpire: vi.fn(),
    className: 'custom',
    t,
    formattedTime: '0:20',
    timeRemaining: 20,
    isExpired: false,
    totalVoted: 4,
    voteProgress: 50,
    config: { color: 'phase-color' },
    PhaseIcon: Icon,
    ...overrides,
  };
}

function managerProps(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'event-1',
    agendaItemId: 'agenda-1',
    votingType: 'amendment',
    targetEntityId: 'target-1',
    t,
    currentSession: null,
    votedCount: 1,
    totalVoters: 2,
    canManageVoting: true,
    voteResults: { accept: 1, reject: 0, abstain: 0 },
    isLoading: false,
    timeRemaining: null,
    startIntroductionPhase: vi.fn(),
    startVotingPhase: vi.fn(),
    closeVoting: vi.fn(),
    majorityType: 'simple',
    setMajorityType: vi.fn(),
    timeLimit: 300,
    setTimeLimit: vi.fn(),
    expanded: true,
    setExpanded: vi.fn(),
    handleStartIntroduction: vi.fn(),
    handleStartVoting: vi.fn(),
    handleCloseVoting: vi.fn(),
    votingProgress: 50,
    ...overrides,
  };
}

describe('VotingPhaseIndicator branches', () => {
  it('renders all result variants and ordinary phase messages', () => {
    const { rerender } = render(
      <VotingPhaseIndicatorView {...phaseProps({ phase: 'closed', result: 'passed' })} />
    );
    expect(screen.getByText('features.events.voting.passed')).toBeTruthy();
    for (const result of ['rejected', 'tie'] as const) {
      rerender(<VotingPhaseIndicatorView {...phaseProps({ phase: 'closed', result })} />);
      expect(screen.getByText(`features.events.voting.${result}`)).toBeTruthy();
    }
    rerender(<VotingPhaseIndicatorView {...phaseProps({ phase: 'internal', result: null })} />);
    expect(screen.getByText('Internal vote')).toBeTruthy();
    rerender(<VotingPhaseIndicatorView {...phaseProps({ phase: 'introduction', result: null })} />);
    expect(screen.getByText('features.events.voting.setup.startVoting')).toBeTruthy();
    rerender(<VotingPhaseIndicatorView {...phaseProps({ phase: 'setup', result: null })} />);
    expect(screen.getByText('features.events.voting.setup.title')).toBeTruthy();
  });

  it('covers timer and progress boundaries', () => {
    const { rerender } = render(<VotingPhaseIndicatorView {...phaseProps()} />);
    expect(screen.getByText('0:20')).toBeTruthy();
    expect(screen.getByTestId('progress').dataset.value).toBe('50');
    rerender(<VotingPhaseIndicatorView {...phaseProps({ duration: 0, totalEligible: 0 })} />);
    expect(screen.queryByText('0:20')).toBeNull();
    expect(screen.queryByTestId('progress')).toBeNull();
    rerender(<VotingPhaseIndicatorView {...phaseProps({ timeRemaining: 45, isExpired: false })} />);
    expect(screen.getByText('0:20').className).toContain('bg-muted');
    rerender(<VotingPhaseIndicatorView {...phaseProps({ timeRemaining: 45, isExpired: true })} />);
    expect(screen.getByText('0:20')).toBeTruthy();
  });

  it('maps wrapper defaults, all phases, and zero/positive progress', () => {
    const { rerender } = render(<VotingPhaseIndicator phase="setup" />);
    for (const phase of [
      'introduction',
      'voting',
      'closed',
      'internal',
      'indication',
      'final',
    ] as const) {
      rerender(
        <VotingPhaseIndicator
          phase={phase}
          duration={60}
          startedAt={1}
          totalEligible={4}
          acceptCount={1}
        />
      );
    }
    expect(document.body.textContent).toBeTruthy();
  });
});

describe('VotingSessionManager branches', () => {
  it('renders and operates setup in expanded, collapsed, loading, and empty-electorate states', () => {
    const props = managerProps();
    const { rerender, container } = render(<VotingSessionManagerView {...props} />);
    fireEvent.click(
      container.querySelector('[data-action-id="votes.session.introduction.start"]')!
    );
    expect(props.handleStartIntroduction).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId('majority'));
    expect(props.setMajorityType).toHaveBeenCalledWith('absolute');
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(props.setTimeLimit).toHaveBeenNthCalledWith(1, 120);
    expect(props.setTimeLimit).toHaveBeenNthCalledWith(2, 300);
    fireEvent.doubleClick(container.firstElementChild!);
    expect(props.setExpanded).toHaveBeenCalledWith(false);

    rerender(
      <VotingSessionManagerView
        {...managerProps({ expanded: false, isLoading: true, totalVoters: 0 })}
      />
    );
    expect(
      (
        container.querySelector(
          '[data-action-id="votes.session.introduction.start"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    rerender(<VotingSessionManagerView {...managerProps({ canManageVoting: false })} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders introduction, voting, and completed sessions with every manager/result branch', () => {
    const intro = managerProps({
      currentSession: { id: 's', phase: 'introduction', majorityType: 'simple' },
    });
    const { rerender, container } = render(<VotingSessionManagerView {...intro} />);
    fireEvent.click(container.querySelector('[data-action-id="votes.session.voting.start"]')!);
    expect(intro.handleStartVoting).toHaveBeenCalledOnce();

    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: { id: 's', phase: 'introduction', majorityType: 'simple' },
          isLoading: true,
          expanded: false,
        })}
      />
    );
    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: { id: 's', phase: 'voting', majorityType: 'absolute', result: 'passed' },
          timeRemaining: 30,
        })}
      />
    );
    fireEvent.click(container.querySelector('[data-action-id="votes.session.voting.close"]')!);
    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: { id: 's', phase: 'voting', majorityType: 'absolute' },
          timeRemaining: 30,
          isLoading: true,
        })}
      />
    );
    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: {
            id: 's',
            phase: 'voting',
            majorityType: 'absolute',
            result: 'rejected',
          },
          timeRemaining: 90,
          isLoading: true,
          canManageVoting: false,
        })}
      />
    );
    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: { id: 's', phase: 'voting', majorityType: 'absolute' },
          timeRemaining: null,
        })}
      />
    );
    for (const result of ['passed', 'rejected', 'tie'] as const) {
      rerender(
        <VotingSessionManagerView
          {...managerProps({
            currentSession: { id: 's', phase: 'completed', majorityType: 'simple', result },
          })}
        />
      );
      expect(screen.getByText(`features.events.voting.${result}`)).toBeTruthy();
    }
    rerender(
      <VotingSessionManagerView
        {...managerProps({
          currentSession: { id: 's', phase: 'completed', majorityType: 'simple', result: null },
        })}
      />
    );
  });

  it('covers controller progress and guarded session actions', async () => {
    const startIntroductionPhase = vi.fn();
    const startVotingPhase = vi.fn();
    const closeVoting = vi.fn();
    mocks.eventVoting = {
      currentSession: null,
      votedCount: 0,
      totalVoters: 0,
      canManageVoting: true,
      voteResults: {},
      isLoading: false,
      timeRemaining: null,
      startIntroductionPhase,
      startVotingPhase,
      closeVoting,
    };
    const { result, rerender } = renderHook(() =>
      useVotingSessionManagerController({
        eventId: 'e',
        agendaItemId: 'a',
        agendaItemTitle: 'Title',
        votingType: 'amendment',
        targetEntityId: 'target',
      })
    );
    await act(() => result.current.handleStartIntroduction());
    await act(() => result.current.handleStartVoting());
    await act(() => result.current.handleCloseVoting());
    expect(result.current.votingProgress).toBe(0);

    mocks.eventVoting = {
      ...mocks.eventVoting,
      currentSession: { id: 'session-1' },
      votedCount: 1,
      totalVoters: 2,
    };
    rerender();
    act(() => result.current.setTimeLimit(120));
    await act(() => result.current.handleStartVoting());
    await act(() => result.current.handleCloseVoting());
    expect(startVotingPhase).toHaveBeenCalledWith('session-1', 120);
    expect(closeVoting).toHaveBeenCalledWith('session-1');
    expect(result.current.votingProgress).toBe(50);
  });
});

describe('VoteControlsView branches', () => {
  const props = (overrides: Record<string, unknown> = {}) => ({
    changeRequestId: 'cr',
    currentUserId: 'u',
    votes: [],
    collaborators: [],
    status: 'pending',
    amendmentId: 'a',
    suggestionData: {},
    onVoteComplete: vi.fn(),
    t,
    isVoting: false,
    setIsVoting: vi.fn(),
    createChangeRequest: vi.fn(),
    voteOnChangeRequest: vi.fn(),
    isUUID: true,
    actualChangeRequestId: 'cr',
    setActualChangeRequestId: vi.fn(),
    currentUserVote: { vote: 'accept' },
    hasVoted: false,
    acceptVotes: 0,
    rejectVotes: 0,
    abstainVotes: 0,
    totalVotes: 0,
    totalCollaborators: 0,
    votedUserIds: new Set(),
    notVotedYet: [],
    handleVote: vi.fn(),
    ...overrides,
  });

  it('hides terminal requests and binds all vote buttons', () => {
    const { rerender, container } = render(<VoteControlsView {...props({ status: 'accepted' })} />);
    expect(container.innerHTML).toBe('');
    rerender(<VoteControlsView {...props({ status: 'rejected' })} />);
    expect(container.innerHTML).toBe('');
    const active = props({ isVoting: true });
    rerender(<VoteControlsView {...active} />);
    for (const choice of ['accept', 'reject', 'abstain']) {
      const button = container.querySelector(
        `[data-action-id="votes.change-request.vote.${choice}"]`
      )!;
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    const enabled = props();
    rerender(<VoteControlsView {...enabled} />);
    for (const choice of ['accept', 'reject', 'abstain']) {
      fireEvent.click(
        container.querySelector(`[data-action-id="votes.change-request.vote.${choice}"]`)!
      );
    }
    expect(enabled.handleVote.mock.calls.map(call => call[0])).toEqual([
      'accept',
      'reject',
      'abstain',
    ]);
  });

  it('renders vote/waiting identities, fallbacks, variants, and percentage widths', () => {
    const active = props({
      hasVoted: true,
      totalCollaborators: 4,
      acceptVotes: 2,
      rejectVotes: 1,
      abstainVotes: 1,
      totalVotes: 4,
      votes: [
        { id: '1', vote: 'accept', voter: { user: { name: 'Ada', avatar: '/ada.png' } } },
        { id: '2', vote: 'reject', voter: { user: { name: '', avatar: '' } } },
        { id: '3', vote: 'abstain', voter: null },
      ],
      notVotedYet: [
        { id: 'c1', user: { name: 'Grace', avatar: '/grace.png' } },
        { id: 'c-avatar', user: { name: '', avatar: '/anonymous.png' } },
        { id: 'c2', user: { name: '', avatar: '' } },
        { id: 'c3', user: null },
      ],
    });
    const { container } = render(<VoteControlsView {...active} />);
    expect(screen.getAllByText(/accept/).length).toBeGreaterThan(0);
    expect(container.querySelector('img[alt="Ada"]')).toBeTruthy();
    expect(screen.getAllByText('features.amendments.voteControls.unspecified')).toHaveLength(5);
    const widths = [...container.querySelectorAll<HTMLElement>('[style]')].map(
      item => item.style.width
    );
    expect(widths).toEqual(expect.arrayContaining(['50%', '25%']));
  });
});
