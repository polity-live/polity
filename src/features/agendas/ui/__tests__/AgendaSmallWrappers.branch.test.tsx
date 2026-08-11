/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  badgeController: vi.fn((..._args: unknown[]) => ({
    status: 'status',
    tone: 'info',
    label: 'label',
  })),
  countdownController: vi.fn((..._args: unknown[]) => ({ isExpired: false })),
  endedController: vi.fn((..._args: unknown[]) => ({ shouldRender: true })),
  badgeView: vi.fn((_props: unknown) => <div data-testid="badge-view" />),
  entityBadgeView: vi.fn((_props: unknown) => <div data-testid="entity-badge-view" />),
  countdownView: vi.fn((_props: unknown) => <div data-testid="countdown-view" />),
  endedView: vi.fn((_props: unknown) => <div data-testid="ended-view" />),
  choiceField: vi.fn((_props: unknown) => <div data-testid="choice-field" />),
  crState: {} as any,
  crView: vi.fn((_props: unknown) => <div data-testid="cr-view" />),
  navigationState: {} as any,
  navigationView: vi.fn((_props: unknown) => <div data-testid="navigation-view" />),
  streamController: vi.fn((_props: unknown) => null as any),
  streamView: vi.fn((_props: unknown) => <div data-testid="stream-view" />),
  editController: vi.fn((props: unknown) => ({ controllerProps: props })),
  editView: vi.fn((_props: unknown) => <div data-testid="edit-view" />),
}));

vi.mock('@/features/agendas/hooks/useAgendaBadgesController', () => ({
  useAgendaStatusBadgeController: (...args: unknown[]) => mocks.badgeController(...args),
  useAgendaTypeBadgeController: (...args: unknown[]) => mocks.badgeController(...args),
  useAgendaElectionModeBadgeController: (...args: unknown[]) => mocks.badgeController(...args),
  useAgendaEntityBadgeController: (...args: unknown[]) => mocks.badgeController(...args),
  useAgendaCountdownPillController: (...args: unknown[]) => mocks.countdownController(...args),
  useAgendaEndedPillController: (...args: unknown[]) => mocks.endedController(...args),
}));
vi.mock('@/features/agendas/ui/AgendaBadgesView', () => ({
  AgendaSemanticBadgeView: (props: unknown) => mocks.badgeView(props),
  AgendaEntityBadgeView: (props: unknown) => mocks.entityBadgeView(props),
  AgendaCountdownPillView: (props: unknown) => mocks.countdownView(props),
  AgendaEndedPillView: (props: unknown) => mocks.endedView(props),
}));
vi.mock('@/features/shared/ui/form', () => ({
  ChoiceCardField: (props: unknown) => mocks.choiceField(props),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/agendas/hooks/useAgendaItemCRVoting', () => ({
  useAgendaItemCRVoting: () => mocks.crState,
}));
vi.mock('@/features/agendas/ui/AgendaCRVoteTimelineView', () => ({
  AgendaCRVoteTimelineView: (props: unknown) => mocks.crView(props),
}));
vi.mock('@/features/agendas/hooks/useAgendaNavigation', () => ({
  useAgendaNavigation: () => mocks.navigationState,
}));
vi.mock('@/features/agendas/ui/AgendaNavigationControlsView', () => ({
  AgendaNavigationControlsView: (props: unknown) => mocks.navigationView(props),
}));
vi.mock('@/features/agendas/ui/useEventStreamSectionController', () => ({
  useEventStreamSectionController: (props: unknown) => mocks.streamController(props),
}));
vi.mock('@/features/agendas/ui/EventStreamSectionView', () => ({
  EventStreamSectionView: (props: unknown) => mocks.streamView(props),
}));
vi.mock('@/features/agendas/ui/useEditElectionVoteDialogController', () => ({
  useEditElectionVoteDialogController: (props: unknown) => mocks.editController(props),
}));
vi.mock('@/features/agendas/ui/EditElectionVoteDialogView', () => ({
  EditElectionVoteDialogView: (props: unknown) => mocks.editView(props),
}));

import {
  AgendaCountdownPill,
  AgendaElectionModeBadge,
  AgendaEndedPill,
  AgendaEntityBadge,
  AgendaStatusBadge,
  AgendaTypeBadge,
} from '../AgendaBadges';
import { AgendaCRVoteTimeline } from '../AgendaCRVoteTimeline';
import { AgendaNavigationControls } from '../AgendaNavigationControls';
import { BallotVisibilityInput } from '../BallotVisibilityInput';
import { EditElectionVoteDialog } from '../EditElectionVoteDialog';
import { EventStreamSection } from '../EventStreamSection';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.crState = {
    crTimeline: [{ id: 'cr-1' }],
    currentItem: { id: 'cr-1' },
    completedItems: [],
    progress: 0.456,
    isLoading: false,
    hasUserVoted: vi.fn(),
    getUserSelectedChoiceIds: vi.fn(),
    allCRsProcessed: false,
    isTimelineComplete: false,
    castCRVote: vi.fn(),
    startIndicativePhase: vi.fn(),
    startFinalPhase: vi.fn(),
    closeVoting: vi.fn(),
  };
  mocks.navigationState = {
    currentAgendaItem: null,
    currentIndex: -1,
    totalItems: 0,
    canNavigate: true,
    isLoading: false,
    moveToNextItem: vi.fn(),
    moveToPreviousItem: vi.fn(),
    completeCurrentItem: vi.fn(),
    hasNextItem: false,
    hasPreviousItem: false,
  };
  mocks.streamController.mockReturnValue(null);
});

afterEach(cleanup);

describe('small agenda wrappers', () => {
  it('forwards all badge controller contracts and the default countdown tone', () => {
    render(
      <>
        <AgendaStatusBadge status="active" />
        <AgendaTypeBadge type="discussion" />
        <AgendaElectionModeBadge electionMode="single" seatCount={2} />
        <AgendaEntityBadge label="Motion" href="/motion" variant="amendment" />
        <AgendaCountdownPill label="Ends" endsAt="2026-08-09" />
        <AgendaCountdownPill label="Starts" endsAt="2026-08-10" tone="start" />
        <AgendaEndedPill endedAt="2026-08-08" />
      </>
    );

    expect(mocks.countdownView).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tone: 'end' })
    );
    expect(mocks.countdownView).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tone: 'start' })
    );
    expect(mocks.badgeController).toHaveBeenCalledTimes(4);
    expect(mocks.endedView).toHaveBeenCalled();
  });

  it('uses translated ballot labels when optional labels are omitted', () => {
    render(<BallotVisibilityInput value="secret" onChange={vi.fn()} />);
    expect(mocks.choiceField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'features.agendas.ballotVisibility.label',
        description: 'generated.inline.0005_geheime_abstimmungen_bleiben_aggregiert_namen_d12f972e',
      })
    );
  });

  it('preserves explicit ballot labels', () => {
    render(
      <BallotVisibilityInput
        value="named"
        onChange={vi.fn()}
        label="Visibility"
        hint="Choose carefully"
      />
    );
    expect(mocks.choiceField).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Visibility', description: 'Choose carefully' })
    );
  });

  it.each([
    ['loading', true, [{ id: 'cr-1' }]],
    ['empty', false, []],
  ])('hides the CR timeline while %s', (_label, isLoading, crTimeline) => {
    mocks.crState = { ...mocks.crState, isLoading, crTimeline };
    const { container } = render(<AgendaCRVoteTimeline agendaItemId="agenda-1" />);
    expect(container.innerHTML).toBe('');
  });

  it('forwards default and explicit CR timeline permissions', () => {
    const { rerender } = render(<AgendaCRVoteTimeline agendaItemId="agenda-1" />);
    expect(mocks.crView).toHaveBeenLastCalledWith(
      expect.objectContaining({ canManage: false, canVote: false, progressPercent: 46 })
    );

    rerender(<AgendaCRVoteTimeline agendaItemId="agenda-1" canManage canVote />);
    expect(mocks.crView).toHaveBeenLastCalledWith(
      expect.objectContaining({ canManage: true, canVote: true })
    );
  });

  it('hides navigation controls without manage permission', () => {
    mocks.navigationState.canNavigate = false;
    const { container } = render(<AgendaNavigationControls eventId="event-1" />);
    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['empty agenda', 0, -1, 0],
    ['active agenda', 4, 1, 50],
  ])('calculates navigation progress for an %s', (_label, totalItems, currentIndex, expected) => {
    mocks.navigationState = { ...mocks.navigationState, totalItems, currentIndex };
    render(<AgendaNavigationControls eventId="event-1" />);
    expect(mocks.navigationView).toHaveBeenCalledWith(
      expect.objectContaining({ progressPercentage: expected })
    );
  });

  it('hides the event stream when its controller has no view model', () => {
    const { container } = render(
      <EventStreamSection
        eventId="event-1"
        currentAgendaItem={null}
        speakerList={[]}
        isUserCandidate={false}
        addingSpeaker={false}
        removingSpeaker={null}
        votingLoading={null}
        onRemoveFromSpeakerList={vi.fn()}
        calculateSpeakerTime={() => new Date()}
        formatTime={() => ''}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the event stream view model', () => {
    mocks.streamController.mockReturnValue({ marker: 'stream' });
    render(
      <EventStreamSection
        eventId="event-1"
        currentAgendaItem={null}
        speakerList={[]}
        isUserCandidate={false}
        addingSpeaker={false}
        removingSpeaker={null}
        votingLoading={null}
        onRemoveFromSpeakerList={vi.fn()}
        calculateSpeakerTime={() => new Date()}
        formatTime={() => ''}
      />
    );
    expect(mocks.streamView).toHaveBeenCalledWith({ marker: 'stream' });
  });

  it('defaults edit-dialog choices and preserves explicit choices', () => {
    const base = { open: true, onOpenChange: vi.fn() };
    const { rerender } = render(<EditElectionVoteDialog {...base} />);
    expect(mocks.editController).toHaveBeenLastCalledWith(expect.objectContaining({ choices: [] }));

    const choices = [{ id: 'choice-1', label: 'Yes', order_index: 1 }];
    rerender(<EditElectionVoteDialog {...base} choices={choices} />);
    expect(mocks.editController).toHaveBeenLastCalledWith(expect.objectContaining({ choices }));
  });
});
