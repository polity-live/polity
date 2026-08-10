/* @vitest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actionBarCloseFinalVote: vi.fn(),
  actionBarStartFinalVote: vi.fn(),
  addSpeaker: vi.fn(),
  can: vi.fn(() => false),
  closeExpiredFinalVotesForEvent: vi.fn(),
  capturedProps: null as Record<string, unknown> | null,
  event: null as Record<string, unknown> | null,
  agendaItems: [] as Record<string, unknown>[],
  agendaNavCurrentItem: null as Record<string, unknown> | null,
  agendaNavStartableItem: null as Record<string, unknown> | null,
  agendaNavStartFirstPendingItem: vi.fn(),
  activeParticipants: [] as Record<string, unknown>[],
  authUser: { id: 'user-1', email: 'user@example.test' } as Record<string, unknown> | null,
  crVoting: null as Record<string, any> | null,
  currentUser: { id: 'user-1', gender: 'female' } as Record<string, unknown> | null,
  delegateParticipants: [] as Record<string, unknown>[],
  documentPreviewModel: null as Record<string, unknown> | null,
  election: null as Record<string, unknown> | null,
  electionCandidates: [] as Record<string, unknown>[],
  forwardingContext: null as Record<string, any> | null,
  gatedToastError: vi.fn(),
  gatedToastMessage: vi.fn(),
  gatedToastSuccess: vi.fn(),
  initializeChangeRequestVoting: vi.fn(),
  isDelegateAssembly: false,
  navigate: vi.fn(),
  removeSpeaker: vi.fn(),
  reorderAgendaItems: vi.fn(),
  sonnerDismiss: vi.fn(),
  sonnerWarning: vi.fn(),
  trackServerFinalization: vi.fn(),
  updateAgendaVote: vi.fn(),
  updateSpeaker: vi.fn(),
  verifyVotingPassword: vi.fn(),
  upsertElectionOfflineTally: vi.fn(),
  upsertVoteOfflineTally: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/events/hooks/useEventData', () => ({
  useEventData: () => ({ event: mocks.event, isLoading: false }),
}));
vi.mock('../../hooks/useAgendaItems', () => ({
  useAgendaItems: () => ({ agendaItems: mocks.agendaItems, isLoading: false }),
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock('@/zero/rbac', () => ({ usePermissions: () => ({ can: mocks.can }) }));
vi.mock('@/zero/agendas/useAgendaActions', () => ({
  useAgendaActions: () => ({
    addSpeaker: mocks.addSpeaker,
    initializeChangeRequestVoting: mocks.initializeChangeRequestVoting,
    removeSpeaker: mocks.removeSpeaker,
    reorderAgendaItems: mocks.reorderAgendaItems,
    updateSpeaker: mocks.updateSpeaker,
  }),
}));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: mocks.currentUser }),
}));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    dismiss: mocks.sonnerDismiss,
    error: vi.fn(),
    success: vi.fn(),
    warning: mocks.sonnerWarning,
  },
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    error: mocks.gatedToastError,
    message: mocks.gatedToastMessage,
    success: mocks.gatedToastSuccess,
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ language: 'en', t: (key: string) => key }),
}));
vi.mock('@/zero/amendments', () => ({
  useAgendaItemForwardingContext: () =>
    mocks.forwardingContext ?? { currentStepRun: null, nextStepRun: null, processRun: null },
}));
vi.mock('@/zero/voting-password/useVotingPasswordActions', () => ({
  useVotingPasswordActions: () => ({ verifyVotingPassword: mocks.verifyVotingPassword }),
}));
vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ upsertOfflineTally: mocks.upsertElectionOfflineTally }),
}));
vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: () => ({
    candidates: mocks.electionCandidates,
    election: mocks.election,
  }),
}));
vi.mock('@/zero/votes/useVoteActions', () => ({
  useVoteActions: () => ({
    closeExpiredFinalVotesForEvent: mocks.closeExpiredFinalVotesForEvent,
    updateVote: mocks.updateAgendaVote,
    upsertOfflineTally: mocks.upsertVoteOfflineTally,
  }),
}));
vi.mock('../../hooks/useAgendaActionBar', () => ({
  useAgendaActionBar: () => ({
    handleCloseFinalVote: mocks.actionBarCloseFinalVote,
    handleStartFinalVote: mocks.actionBarStartFinalVote,
  }),
}));
vi.mock('../../hooks/useAgendaNavigation', () => ({
  useAgendaNavigation: () => ({
    currentAgendaItem: mocks.agendaNavCurrentItem,
    startableAgendaItem: mocks.agendaNavStartableItem,
    startFirstPendingItem: mocks.agendaNavStartFirstPendingItem,
  }),
}));
vi.mock('../../hooks/useAgendaItemCRVoting', () => ({
  getVoteResult: vi.fn(),
  useAgendaItemCRVoting: () =>
    mocks.crVoting ?? {
      castCRVote: vi.fn(),
      closeVoting: vi.fn(),
      closingVoteItem: null,
      crTimeline: [],
      currentItem: null,
      hasUserVoted: vi.fn(() => false),
      startFinalPhase: vi.fn(),
    },
}));
vi.mock('@/zero/events', () => ({
  useEventById: () => ({ event: null }),
  useEventParticipantsByParticipatedEventIds: () => ({ participants: mocks.activeParticipants }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  trackServerFinalization: mocks.trackServerFinalization,
  waitForClientApply: (value: unknown) => Promise.resolve(value),
}));
vi.mock('@/features/events/hooks/useDelegateAssemblyParticipantsComposition', () => ({
  useDelegateAssemblyParticipantsComposition: () => ({
    isDelegateAssembly: mocks.isDelegateAssembly,
    participantsWithProvenance: mocks.delegateParticipants,
  }),
}));
vi.mock('../../logic/changeRequestDocumentPreview', () => ({
  buildVoteDialogDocumentPreviewModel: () => mocks.documentPreviewModel,
}));
vi.mock('../EventAgendaView', () => ({
  EventAgendaView: (props: Record<string, unknown>) => {
    mocks.capturedProps = props;
    return null;
  },
}));

import { EventAgenda } from '../EventAgenda';

beforeEach(() => {
  vi.useFakeTimers();
  mocks.capturedProps = null;
  mocks.event = {
    id: 'event-1',
    title: 'Assembly',
    status: 'draft',
    attendance_type: 'online',
    participants: [],
    offline_participants: [],
  };
  mocks.agendaItems = [];
  mocks.agendaNavCurrentItem = null;
  mocks.agendaNavStartableItem = null;
  mocks.activeParticipants = [];
  mocks.authUser = { id: 'user-1', email: 'user@example.test' };
  mocks.crVoting = null;
  mocks.currentUser = { id: 'user-1', gender: 'female' };
  mocks.delegateParticipants = [];
  mocks.documentPreviewModel = null;
  mocks.election = null;
  mocks.electionCandidates = [];
  mocks.forwardingContext = null;
  mocks.isDelegateAssembly = false;
  mocks.can.mockReset();
  mocks.can.mockReturnValue(false);
  for (const mock of [
    mocks.actionBarCloseFinalVote,
    mocks.actionBarStartFinalVote,
    mocks.addSpeaker,
    mocks.agendaNavStartFirstPendingItem,
    mocks.closeExpiredFinalVotesForEvent,
    mocks.initializeChangeRequestVoting,
    mocks.gatedToastError,
    mocks.gatedToastMessage,
    mocks.gatedToastSuccess,
    mocks.navigate,
    mocks.removeSpeaker,
    mocks.reorderAgendaItems,
    mocks.sonnerDismiss,
    mocks.sonnerWarning,
    mocks.trackServerFinalization,
    mocks.updateAgendaVote,
    mocks.updateSpeaker,
    mocks.upsertElectionOfflineTally,
    mocks.upsertVoteOfflineTally,
    mocks.verifyVotingPassword,
  ]) {
    mock.mockReset();
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function props() {
  expect(mocks.capturedProps).not.toBeNull();
  return mocks.capturedProps as Record<string, any>;
}

describe('EventAgenda controller contract', () => {
  it('publishes safe defaults while the event is unavailable', () => {
    mocks.event = null;
    render(<EventAgenda eventId="event-1" />);

    expect(props().event).toBeNull();
    expect(props().attendanceMode).toBe('offline');
    expect(props().eligibleFinalVoterCount).toBe(0);
    expect(props().streamAgendaItem).toBeNull();
  });

  it('publishes a deterministic empty agenda model and maintains the vote timer', () => {
    render(<EventAgenda eventId="event-1" />);

    expect(props().event).toBe(mocks.event);
    expect(props().confirmedAgendaItems).toEqual([]);
    expect(props().scheduledButUnconfirmedAgendaItems).toEqual([]);
    expect(props().formatTime(null)).toBe('--:--');
    expect(props().formatTime(new Date('2026-01-01T12:30:00Z'))).toMatch(/\d{2}:\d{2}/);
    expect(mocks.closeExpiredFinalVotesForEvent).toHaveBeenCalledWith({ event_id: 'event-1' });

    act(() => vi.advanceTimersByTime(5_000));
    expect(mocks.closeExpiredFinalVotesForEvent).toHaveBeenCalledTimes(2);
  });

  it('applies search, type and forwarding-status filters through the view setters', () => {
    mocks.agendaItems = [
      {
        id: 'agenda-1',
        order_index: 2,
        status: 'pending',
        title: 'Budget report',
        type: 'amendment',
        forwarding_status: 'forward_confirmed',
      },
      {
        id: 'agenda-2',
        order_index: 1,
        status: 'pending',
        title: 'Election',
        type: 'election',
        forwarding_status: 'previous_decision_outstanding',
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    act(() => props().setSearchQuery('budget'));
    expect(props().filteredAgendaItems).toHaveLength(1);
    act(() => props().setSearchQuery(''));
    act(() => props().setTypeFilter('election'));
    expect(props().filteredAgendaItems[0]?.id).toBe('agenda-2');
    act(() => props().setTypeFilter('all'));
    act(() => props().setStatusFilter('pending'));
    expect(props().filteredAgendaItems).toHaveLength(2);
    expect(props().confirmedAgendaItems[0]?.id).toBe('agenda-1');
    expect(props().scheduledButUnconfirmedAgendaItems[0]?.id).toBe('agenda-2');

    act(() => props().setSearchQuery('top-1'));
    expect(props().filteredAgendaItems[0]?.id).toBe('agenda-2');
    act(() => props().setSearchQuery(''));
    act(() => props().setTypeFilter('vote'));
    expect(props().filteredAgendaItems.map((item: { id: string }) => item.id)).toEqual([
      'agenda-1',
    ]);
  });

  it('uses delegate provenance and nullable roster and ordering fields', () => {
    mocks.isDelegateAssembly = true;
    mocks.delegateParticipants = [
      {
        id: 'delegate-1',
        status: 'active',
        user_id: 'user-1',
        user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
      },
    ];
    mocks.activeParticipants = [{ id: 'inactive-1', status: null, user_id: 'other-user' }];
    mocks.election = {
      id: 'action-election',
      title: null,
      status: 'indicative',
      candidates: null,
    };
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-delegate-election',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-delegate-election',
        order_index: null,
        status: 'in-progress',
        title: null,
        type: 'election',
        election: [
          {
            id: 'delegate-election',
            title: null,
            status: 'indicative',
            candidates: null,
            electors: [],
            indicative_participations: [],
          },
        ],
      },
      {
        id: 'agenda-null-order',
        order_index: null,
        status: 'pending',
        title: 'Unordered item',
        type: 'discussion',
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    expect(props().orderedAgendaItems).toHaveLength(2);
    act(() => props().setNamedResultsTarget('election'));
    expect(props().namedResultsDialogConfig?.title).toBe(
      'features.events.agenda.namedResults.electionFallbackTitle'
    );
  });

  it('rejects drag sources and targets that are not in the current agenda', () => {
    mocks.can.mockReturnValue(true);
    mocks.agendaItems = [
      { id: 'agenda-1', order_index: 1, status: 'pending', title: 'One', type: 'discussion' },
      { id: 'agenda-2', order_index: 2, status: 'pending', title: 'Two', type: 'discussion' },
    ];
    render(<EventAgenda eventId="event-1" />);
    const dragEvent = { dataTransfer: { effectAllowed: '', setData: vi.fn() } };

    act(() => props().handleAgendaDragStart(dragEvent, 'missing-source'));
    act(() => props().handleAgendaDrop('agenda-1'));
    act(() => props().handleAgendaDragStart(dragEvent, 'agenda-1'));
    act(() => props().handleAgendaDrop('missing-target'));

    expect(mocks.reorderAgendaItems).not.toHaveBeenCalled();
    expect(props().draggedAgendaItemId).toBeNull();
  });

  it('executes published guard actions without side effects', async () => {
    render(<EventAgenda eventId="event-1" />);

    expect(props().isAgendaItemDraggable('planned')).toBe(false);
    const dragEvent = {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    };
    act(() => props().handleAgendaDragStart(dragEvent, 'missing'));
    act(() => props().handleAgendaDrop('missing'));
    act(() => props().handleAgendaDragEnd());
    act(() => props().resetAgendaDragState());
    props().handleToolbarStartVote();
    props().handleJumpToNextStartableSequenceItem();
    props().handleToolbarStartFinalVote();
    props().handleToolbarCloseVote();
    await props().handleCastCRVoteFromDialog('choice-1');
    act(() => props().handleOpenOfflineTallyDialog());
    expect(props().offlineTallyDialogOpen).toBe(true);
    act(() => props().handleOfflineTallyDialogOpenChange(false));
    expect(props().offlineTallyDialogOpen).toBe(false);
    await props().handleSubmitOfflineTally({ password: 'pw', counts: {} });
    await props().handleAddToSpeakerList();
    await props().handleMarkSpeakerCompleted('speaker-1');
    await props().handleRemoveFromSpeakerList();

    expect(mocks.actionBarStartFinalVote).toHaveBeenCalledOnce();
    expect(mocks.actionBarCloseFinalVote).toHaveBeenCalledOnce();
    expect(mocks.addSpeaker).not.toHaveBeenCalled();
    expect(mocks.updateSpeaker).not.toHaveBeenCalled();
  });

  it('reorders agenda items and completes the speaker-list workflow', async () => {
    mocks.can.mockReturnValue(true);
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-1',
      gender_quota_enabled: false,
      start_date: Date.now() - 1_000,
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-1',
        order_index: 1,
        status: 'in-progress',
        title: 'Live debate',
        type: 'discussion',
        speaker_list: [
          {
            id: 'speaker-1',
            order_index: 1,
            time: 3,
            completed: false,
            user: {
              id: 'user-1',
              first_name: 'Ada',
              last_name: 'Lovelace',
              email: 'ada@example.test',
              avatar: null,
              gender: 'female',
            },
          },
          {
            id: 'speaker-2',
            order_index: 2,
            time: 4,
            completed: false,
            user: null,
          },
        ],
      },
      {
        id: 'agenda-2',
        order_index: 2,
        status: 'pending',
        title: 'Next item',
        type: 'amendment',
        speaker_list: [],
      },
    ];
    mocks.addSpeaker.mockResolvedValue(undefined);
    mocks.updateSpeaker.mockResolvedValue(undefined);
    mocks.removeSpeaker.mockResolvedValue(undefined);
    render(<EventAgenda eventId="event-1" />);
    act(() => vi.advanceTimersByTime(100));

    expect(props().isEventStarted).toBe(true);
    expect(props().isAgendaItemDraggable('planned')).toBe(true);
    expect(props().isAgendaItemDraggable('pending')).toBe(true);
    expect(props().isAgendaItemDraggable('completed')).toBe(false);
    expect(props().isUserInSpeakerList).toBe(true);
    expect(props().formatTime(Date.now())).not.toBe('--:--');

    const dragEvent = {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    };
    act(() => props().handleAgendaDragStart(dragEvent, 'agenda-1'));
    expect(dragEvent.dataTransfer.effectAllowed).toBe('move');
    act(() => props().handleAgendaDrop('agenda-2', 'below'));
    expect(mocks.reorderAgendaItems).toHaveBeenCalledOnce();

    act(() => props().handleAgendaDragStart(dragEvent, 'agenda-2'));
    act(() => props().handleAgendaDrop('agenda-1', 'above'));
    expect(mocks.reorderAgendaItems).toHaveBeenCalledTimes(2);

    await act(async () => props().handleAddToSpeakerList());
    await act(async () => props().handleMarkSpeakerCompleted('speaker-1'));
    await act(async () => props().handleRemoveFromSpeakerList());

    expect(mocks.addSpeaker).toHaveBeenCalledOnce();
    expect(mocks.updateSpeaker).toHaveBeenCalledTimes(2);
    expect(mocks.removeSpeaker).toHaveBeenCalledWith('speaker-1');
  });

  it('offers start and dismiss actions for an overdue startable item', () => {
    mocks.can.mockReturnValue(true);
    mocks.agendaNavStartableItem = { id: 'agenda-overdue' };
    mocks.agendaItems = [
      {
        id: 'agenda-overdue',
        calculated_start_time: Date.now() - 1_000,
        order_index: null,
        status: 'pending',
        title: '',
        type: 'discussion',
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    expect(props().overdueStartCandidate?.id).toBe('agenda-overdue');
    expect(mocks.sonnerWarning).toHaveBeenCalledOnce();
    const options = mocks.sonnerWarning.mock.calls[0]?.[1];
    act(() => options.action.onClick());
    expect(mocks.agendaNavStartFirstPendingItem).toHaveBeenCalledOnce();
    expect(mocks.sonnerDismiss).toHaveBeenCalled();
    act(() => options.cancel.onClick());
    act(() => options.onAutoClose());
    act(() => options.onDismiss());
  });

  it('ignores missing, unscheduled and future startable items', () => {
    mocks.can.mockReturnValue(true);
    mocks.agendaNavStartableItem = { id: 'missing' };
    const rendered = render(<EventAgenda eventId="event-1" />);
    expect(props().overdueStartCandidate).toBeNull();

    mocks.agendaNavStartableItem = { id: 'unscheduled' };
    mocks.agendaItems = [
      {
        id: 'unscheduled',
        calculated_start_time: null,
        order_index: 1,
        status: 'pending',
        title: 'No schedule',
        type: 'discussion',
      },
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().overdueStartCandidate).toBeNull();

    mocks.agendaNavStartableItem = { id: 'future' };
    mocks.agendaItems = [
      {
        id: 'future',
        calculated_start_time: Date.now() + 60_000,
        order_index: 1,
        status: 'pending',
        title: 'Future item',
        type: 'discussion',
      },
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().overdueStartCandidate).toBeNull();
    expect(mocks.sonnerWarning).not.toHaveBeenCalled();

    mocks.agendaNavStartableItem = { id: 'late-with-title' };
    mocks.agendaItems = [
      {
        id: 'late-with-title',
        calculated_start_time: Date.now() - 1,
        order_index: 1,
        status: 'pending',
        title: 'Late titled item',
        type: 'discussion',
      },
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(mocks.sonnerWarning).toHaveBeenCalledWith(
      'features.events.agenda.startReminderTitle',
      expect.objectContaining({
        description: 'features.events.agenda.startReminderDescription (Late titled item)',
      })
    );
  });

  it('uses navigation fallbacks when the event pointer is stale or completed', () => {
    mocks.agendaNavCurrentItem = { id: 'agenda-nav' };
    mocks.agendaNavStartableItem = { id: 'agenda-startable' };
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'missing-event-item',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-nav',
        order_index: 1,
        status: 'pending',
        title: 'Navigation item',
        type: 'discussion',
      },
      {
        id: 'agenda-startable',
        order_index: 2,
        status: 'pending',
        title: 'Startable item',
        type: 'discussion',
      },
    ];
    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(props().liveAgendaItem?.id).toBe('agenda-nav');

    mocks.agendaNavCurrentItem = { id: 'missing-nav-item' };
    mocks.event = { ...mocks.event, current_agenda_item_id: 'agenda-nav' };
    mocks.agendaItems[0] = {
      ...mocks.agendaItems[0],
      status: 'completed',
      completed_at: Date.now(),
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().spotlightAgendaItem?.id).toBe('agenda-startable');
  });

  it('blocks a same-gender speaker when alternating gender quota is enabled', async () => {
    mocks.can.mockReturnValue(true);
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-quota',
      gender_quota_enabled: true,
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-quota',
        order_index: 1,
        status: 'in-progress',
        title: 'Quota debate',
        type: 'discussion',
        speaker_list: [
          {
            id: 'speaker-female',
            order_index: 0,
            time: 0,
            completed: false,
            user: { id: 'other-user', first_name: '', last_name: '', gender: 'female' },
          },
        ],
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    await act(async () => props().handleAddToSpeakerList());
    expect(mocks.addSpeaker).not.toHaveBeenCalled();
    expect(mocks.gatedToastError).toHaveBeenCalled();
  });

  it('contains speaker mutation failures and handles an exhausted list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.can.mockReturnValue(true);
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-errors',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-errors',
        order_index: 1,
        status: 'in-progress',
        title: 'Mutation errors',
        type: 'discussion',
        speaker_list: [
          {
            id: 'speaker-only',
            order_index: 1,
            completed: false,
            user: { id: 'user-1' },
          },
        ],
      },
    ];
    mocks.addSpeaker.mockRejectedValueOnce(new Error('add failed'));
    mocks.updateSpeaker.mockRejectedValueOnce(new Error('update failed'));
    mocks.removeSpeaker.mockRejectedValueOnce(new Error('remove failed'));
    render(<EventAgenda eventId="event-1" />);

    await act(async () => props().handleAddToSpeakerList());
    await act(async () => props().handleMarkSpeakerCompleted('speaker-only'));
    await act(async () => props().handleRemoveFromSpeakerList());

    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('uses auth and profile guards and adds the first speaker without a profile', async () => {
    mocks.can.mockReturnValue(true);
    mocks.authUser = null;
    mocks.currentUser = null;
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-empty-speakers',
      gender_quota_enabled: true,
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-empty-speakers',
        order_index: 1,
        status: 'in-progress',
        title: 'Open list',
        type: 'discussion',
        speaker_list: [],
      },
    ];
    mocks.addSpeaker.mockResolvedValue(undefined);
    const rendered = render(<EventAgenda eventId="event-1" />);

    await act(async () => props().handleAddToSpeakerList());
    await act(async () => props().handleRemoveFromSpeakerList());
    expect(mocks.addSpeaker).not.toHaveBeenCalled();

    mocks.authUser = { id: 'user-1', email: null };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    await act(async () => props().handleAddToSpeakerList());
    mocks.updateSpeaker.mockResolvedValueOnce(undefined);
    await act(async () => props().handleMarkSpeakerCompleted('not-in-list'));

    expect(mocks.addSpeaker).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_item_id: 'agenda-empty-speakers', order_index: 1 })
    );
  });

  it('derives named election results and persists final offline election tallies', async () => {
    mocks.can.mockReturnValue(true);
    mocks.activeParticipants = [
      {
        id: 'participant-1',
        status: 'active',
        user_id: 'user-1',
        user: { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' },
      },
    ];
    const candidates = [
      {
        id: 'candidate-1',
        name: 'Candidate One',
        order_index: 1,
        status: 'active',
        user: { id: 'candidate-user-1', first_name: 'Grace', last_name: 'Hopper' },
      },
      { id: 'candidate-2', name: 'Candidate Two', order_index: 2, status: 'active' },
    ];
    const election = {
      id: 'election-1',
      title: 'Board election',
      status: 'final',
      max_votes: 2,
      candidates,
      electors: [{ id: 'elector-1', user_id: 'user-1' }],
      indicative_participations: [],
      final_participations: [
        {
          elector_id: 'elector-1',
          selections: [{ candidate_id: 'candidate-1' }, { candidate: { id: 'candidate-2' } }],
        },
      ],
      offline_tallies: [{ phase: 'final', candidate_id: 'candidate-1', count: 1 }],
    };
    mocks.election = { ...election, title: null, candidates: [] };
    mocks.electionCandidates = candidates;
    mocks.event = {
      ...mocks.event,
      attendance_mode: 'hybrid',
      current_agenda_item_id: 'agenda-election',
      offline_participants: [
        {
          id: 'offline-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ],
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-election',
        order_index: 1,
        status: 'in-progress',
        title: 'Election TOP',
        type: 'election',
        election: [election],
        votes: [],
        speaker_list: [],
        voting_phase: 'final',
      },
    ];
    mocks.verifyVotingPassword.mockResolvedValue(undefined);
    mocks.upsertElectionOfflineTally.mockResolvedValue(undefined);
    render(<EventAgenda eventId="event-1" />);

    expect(props().toolbarElection.candidates).toEqual(candidates);
    expect(props().userHasElectionVoted).toBe(true);
    expect(props().userSelectedCandidateIds).toEqual(['candidate-1', 'candidate-2']);
    expect(props().showOfflineTallyButton).toBe(true);
    expect(props().toolbarOfflineTallyMode).toBe('edit');

    act(() => props().setNamedResultsTarget('election'));
    expect(props().namedResultsDialogConfig?.model).not.toBeNull();

    await act(async () =>
      props().handleSubmitOfflineTally({
        password: 'secret',
        counts: { 'candidate-1': 2, 'candidate-2': 1 },
      })
    );
    expect(mocks.verifyVotingPassword).toHaveBeenCalledWith('secret');
    expect(mocks.upsertElectionOfflineTally).toHaveBeenCalledTimes(2);
  });

  it('derives election participation defaults in final and indicative phases', () => {
    const makeAgenda = (election: Record<string, unknown>) => ({
      id: 'agenda-election-defaults',
      order_index: 1,
      status: 'in-progress',
      title: null,
      type: 'election',
      election: [election],
      speaker_list: [],
    });
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-election-defaults',
      status: 'active',
    };
    mocks.agendaItems = [
      makeAgenda({
        id: 'election-defaults',
        title: null,
        status: 'final',
        candidates: [],
        electors: [],
      }),
    ];
    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(props().userHasElectionVoted).toBe(false);
    expect(props().userSelectedCandidateIds).toEqual([]);

    mocks.agendaItems = [
      makeAgenda({
        id: 'election-defaults',
        title: null,
        status: 'final',
        candidates: [],
        electors: [{ id: 'elector-1', user_id: 'user-1' }],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userHasElectionVoted).toBe(false);
    expect(props().userSelectedCandidateIds).toEqual([]);

    mocks.agendaItems = [
      makeAgenda({
        id: 'election-defaults',
        title: null,
        status: 'indicative',
        candidates: [],
        electors: [],
        indicative_participations: [
          { user_id: 'other-user', selections: [] },
          { user_id: 'user-1' },
        ],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userHasElectionVoted).toBe(true);
    expect(props().userSelectedCandidateIds).toEqual([]);

    mocks.agendaItems = [
      makeAgenda({
        id: 'election-defaults',
        title: null,
        status: 'indicative',
        candidates: [],
        electors: [],
        indicative_participations: [
          {
            user_id: 'user-1',
            selections: [{ candidate_id: null, candidate: null }, { candidate_id: 'candidate-1' }],
          },
        ],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userSelectedCandidateIds).toEqual(['candidate-1']);
  });

  it('derives final vote participation and persists offline vote tallies', async () => {
    mocks.can.mockReturnValue(true);
    const vote = {
      id: 'vote-1',
      title: null,
      purpose: 'closing',
      status: 'final',
      choices: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: null },
      ],
      voters: [{ id: 'voter-1', user_id: 'user-1' }],
      indicative_participations: [],
      final_participations: [
        {
          voter_id: 'voter-1',
          decisions: [{ choice_id: 'yes' }, { choice: { id: 'no' } }],
        },
      ],
      offline_tallies: [{ phase: 'final', choice_id: 'yes', count: 1 }],
    };
    mocks.event = {
      ...mocks.event,
      attendance_mode: 'hybrid',
      current_agenda_item_id: 'agenda-vote',
      offline_participants: [
        {
          id: 'offline-1',
          attendance_status: 'confirmed',
          participation_channel: 'offline',
        },
      ],
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-vote',
        order_index: 1,
        status: 'in-progress',
        title: 'Resolution',
        type: 'vote',
        election: [],
        votes: [vote],
        speaker_list: [],
        voting_phase: 'final',
      },
    ];
    mocks.verifyVotingPassword.mockResolvedValue(undefined);
    mocks.upsertVoteOfflineTally.mockResolvedValue(undefined);
    render(<EventAgenda eventId="event-1" />);

    expect(props().userHasVoteVoted).toBe(true);
    expect(props().userSelectedChoiceIds).toEqual(['yes', 'no']);
    expect(props().toolbarOfflineTallyEntity.kind).toBe('vote');

    act(() => props().setNamedResultsTarget('vote'));
    expect(props().namedResultsDialogConfig?.model).not.toBeNull();
    await act(async () =>
      props().handleSubmitOfflineTally({
        password: 'secret',
        counts: { no: 2, yes: 2 },
      })
    );
    expect(mocks.upsertVoteOfflineTally).toHaveBeenCalledTimes(2);

    mocks.verifyVotingPassword.mockRejectedValueOnce(new Error('Invalid voting password.'));
    await act(async () =>
      props().handleSubmitOfflineTally({ password: 'wrong', counts: { no: 1, yes: 1 } })
    );
    expect(props().offlineTallyPasswordError).toBe('Invalid voting password.');

    mocks.verifyVotingPassword.mockRejectedValueOnce(
      new Error('Offline election totals exceed the current cap')
    );
    await act(async () =>
      props().handleSubmitOfflineTally({ password: 'wrong', counts: { no: 1, yes: 1 } })
    );
    expect(props().offlineTallySubmitError).toContain('exceed');
    const errorToastOptions = mocks.gatedToastError.mock.calls.at(-1)?.[1];
    act(() => errorToastOptions.action.onClick());
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/event/$id/participants',
      params: { id: 'event-1' },
    });

    mocks.verifyVotingPassword.mockRejectedValueOnce('unknown failure');
    await act(async () =>
      props().handleSubmitOfflineTally({ password: 'wrong', counts: { no: 1, yes: 1 } })
    );
  });

  it('derives vote participation and offline tally defaults in both phases', async () => {
    mocks.can.mockReturnValue(true);
    const makeAgenda = (vote: Record<string, unknown>) => ({
      id: 'agenda-vote-defaults',
      order_index: 1,
      status: 'in-progress',
      title: null,
      type: 'vote',
      votes: [vote],
      speaker_list: [],
    });
    mocks.event = {
      ...mocks.event,
      attendance_mode: 'hybrid',
      current_agenda_item_id: 'agenda-vote-defaults',
      offline_participants: [
        { id: 'offline-1', attendance_status: 'confirmed', participation_channel: 'offline' },
      ],
      status: 'active',
    };
    mocks.agendaItems = [
      makeAgenda({
        id: 'vote-defaults',
        title: null,
        status: 'final',
        choices: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
        voters: [],
        offline_tallies: [{ phase: 'final', choice_id: 'yes', count: null }],
      }),
    ];
    mocks.verifyVotingPassword.mockResolvedValue(undefined);
    mocks.upsertVoteOfflineTally.mockResolvedValue(undefined);
    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(props().userHasVoteVoted).toBe(false);
    expect(props().userSelectedChoiceIds).toEqual([]);
    act(() => props().handleOfflineTallyDialogOpenChange(true));
    await act(async () =>
      props().handleSubmitOfflineTally({ password: 'secret', counts: { yes: 1 } })
    );
    expect(mocks.upsertVoteOfflineTally).toHaveBeenCalledTimes(2);

    mocks.agendaItems = [
      makeAgenda({
        id: 'vote-defaults',
        title: null,
        status: 'final',
        choices: [{ id: 'yes', label: 'Yes' }],
        voters: [{ id: 'voter-1', user_id: 'user-1' }],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userHasVoteVoted).toBe(false);
    expect(props().userSelectedChoiceIds).toEqual([]);

    mocks.agendaItems = [
      makeAgenda({
        id: 'vote-defaults',
        title: null,
        status: 'indicative',
        choices: [{ id: 'yes', label: 'Yes' }],
        voters: [],
        indicative_participations: [
          { user_id: 'other-user', decisions: [] },
          { user_id: 'user-1' },
        ],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userHasVoteVoted).toBe(true);
    expect(props().userSelectedChoiceIds).toEqual([]);
    act(() => props().setNamedResultsTarget('vote'));
    expect(props().namedResultsDialogConfig?.title).toBe(
      'features.events.agenda.namedResults.voteFallbackTitle'
    );

    mocks.agendaItems = [
      makeAgenda({
        id: 'vote-defaults',
        title: null,
        status: 'indicative',
        choices: [{ id: 'yes', label: 'Yes' }],
        voters: [],
        indicative_participations: [
          {
            user_id: 'user-1',
            decisions: [{ choice_id: null, choice: null }, { choice_id: 'yes' }],
          },
        ],
      }),
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().userSelectedChoiceIds).toEqual(['yes']);
  });

  it('controls an amendment change-request vote sequence through the toolbar', async () => {
    mocks.can.mockReturnValue(true);
    const castCRVote = vi.fn().mockResolvedValue(undefined);
    const closeVoting = vi.fn().mockResolvedValue(undefined);
    const startFinalPhase = vi.fn().mockResolvedValue(undefined);
    const crItem = {
      id: 'timeline-cr-1',
      agenda_item_id: 'agenda-amendment',
      change_request_id: 'change-request-1',
      _voteStepKind: 'change_request',
      is_closing_vote: false,
      status: 'voting',
      change_request: { title: 'Improve section', process_branch_id: 'branch-1' },
      vote: {
        id: 'cr-vote-1',
        status: 'indicative',
        choices: [
          { id: 'accept', label: 'Accept' },
          { id: 'reject', label: '' },
        ],
      },
    };
    const closingItem = {
      id: 'timeline-closing',
      agenda_item_id: 'agenda-amendment',
      is_closing_vote: true,
      status: 'pending',
      vote: { id: 'closing-vote-1', status: 'indicative', choices: [{ id: 'yes', label: 'Yes' }] },
    };
    mocks.crVoting = {
      castCRVote,
      closeVoting,
      closingVoteItem: closingItem,
      crTimeline: [crItem, closingItem],
      currentItem: crItem,
      hasUserVoted: vi.fn(() => true),
      startFinalPhase,
    };
    mocks.documentPreviewModel = { suggestionIds: ['suggestion-1'], suggestionResolutions: {} };
    mocks.forwardingContext = {
      currentStepRun: { branch_id: 'branch-1' },
      nextStepRun: { id: 'next-step' },
      processRun: { active_branch_id: 'branch-1' },
    };
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-amendment',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-amendment',
        amendment_id: 'amendment-1',
        amendment: {
          title: 'Resolution title',
          editing_mode: 'suggesting',
          current_process_run: {
            branches: [
              {
                id: 'branch-1',
                title: null,
                order_index: 1,
                editing_mode: null,
                document_version: { content: [{ type: 'p', children: [{ text: 'Draft' }] }] },
                discussions: [{}],
              },
            ],
          },
        },
        forwarding_status: 'forward_confirmed',
        order_index: 1,
        status: 'in-progress',
        title: 'Resolution',
        type: 'amendment',
        election: [],
        votes: [
          {
            id: 'agenda-closing-vote',
            purpose: 'closing',
            status: 'indicative',
            choices: [{ id: 'yes', label: 'Yes' }],
          },
        ],
        speaker_list: [],
      },
    ];
    mocks.updateAgendaVote.mockResolvedValue(undefined);
    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(props().isCRToolbarActive).toBe(true);
    expect(props().hasUserVotedOnSelectedCR).toBe(true);
    expect(props().selectedCRTitle).toBe('Improve section');
    expect(props().selectedCRChoices).toEqual([
      { id: 'accept', label: 'Accept' },
      { id: 'reject', label: 'features.agendas.fallbacks.choice' },
    ]);
    expect(props().streamAmendmentDiscussions).toHaveLength(1);
    expect(props().voteDialogDocumentPreviewContent).not.toBeNull();

    await act(async () => props().handleCastCRVoteFromDialog('accept', { phase: 'indicative' }));
    props().handleToolbarStartVote();
    await act(async () => Promise.resolve());
    props().handleToolbarCloseVote();
    await act(async () => Promise.resolve());
    (crItem as { _voteStepKind?: string })._voteStepKind = undefined;
    props().handleToolbarCloseVote();
    await act(async () => Promise.resolve());

    expect(castCRVote).toHaveBeenCalledWith(crItem, 'accept', { phase: 'indicative' });
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith({ id: 'cr-vote-1', status: 'final' });
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith({ id: 'cr-vote-1', status: 'closed' });
    expect(closeVoting).toHaveBeenCalledWith('timeline-cr-1');

    act(() => props().setSelectedCRToolbarItemId('timeline-closing'));
    expect(props().isSelectedClosingVote).toBe(true);
    expect(props().selectedCRTitle).toBe('features.agendas.crTimeline.acceptAmendment');
    props().handleToolbarStartFinalVote();
    await act(async () => Promise.resolve());
    expect(startFinalPhase).not.toHaveBeenCalled();
    expect(props().activeCRToolbarItem?.id).toBe('timeline-cr-1');

    const finalCRItem = {
      ...crItem,
      change_request: { title: null, process_branch_id: 'missing-branch' },
      vote: { ...crItem.vote, status: 'final' },
    };
    mocks.crVoting = {
      ...mocks.crVoting,
      crTimeline: [finalCRItem, closingItem],
      currentItem: finalCRItem,
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    act(() => props().setSelectedCRToolbarItemId('timeline-cr-1'));
    expect(props().selectedCRTitle).toBe('features.agendas.crTimeline.changeRequest 1');
    expect(props().selectedCRDialogPhase).toBe('final');

    const closedCRItem = { ...finalCRItem, vote: { ...finalCRItem.vote, status: 'closed' } };
    mocks.crVoting = {
      ...mocks.crVoting,
      crTimeline: [closedCRItem, closingItem],
      currentItem: closedCRItem,
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().selectedCRDialogPhase).toBe('closed');
  });

  it('synthesizes variant, placeholder and closing steps from agenda votes', async () => {
    mocks.can.mockReturnValue(true);
    const variantVote = {
      id: 'variant-vote',
      purpose: 'merge_variant',
      status: 'indicative',
      title: null,
      choices: [{ id: 'variant-a', label: 'Variant A' }],
    };
    const closingVote = {
      id: 'closing-vote',
      purpose: 'closing',
      status: 'indicative',
      title: null,
      choices: [{ id: 'yes', label: 'Yes' }],
    };
    mocks.crVoting = {
      castCRVote: vi.fn(),
      closeVoting: vi.fn(),
      closingVoteItem: null,
      crTimeline: [],
      currentItem: null,
      hasUserVoted: vi.fn(() => false),
      startFinalPhase: vi.fn(),
    };
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-variant',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-variant',
        amendment_id: 'amendment-1',
        amendment: { title: null, current_process_run: { branches: [] } },
        forwarding_status: 'forward_confirmed',
        order_index: 1,
        status: 'in-progress',
        title: 'Variant resolution',
        type: 'amendment',
        election: [],
        votes: [variantVote, closingVote],
        speaker_list: [],
      },
    ];
    mocks.updateAgendaVote.mockResolvedValue(undefined);
    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(props().streamVoteSequenceItems).toHaveLength(3);
    const placeholder = props().streamVoteSequenceItems.find(
      (item: Record<string, unknown>) => item._voteStepKind === 'change_request_votes_placeholder'
    );
    expect(placeholder).toBeDefined();

    act(() => props().setSelectedCRToolbarItemId(placeholder.id));
    props().handleToolbarStartVote();
    await act(async () => Promise.resolve());
    expect(props().activeCRToolbarItem?.is_closing_vote).toBe(true);

    act(() => props().setSelectedCRToolbarItemId(props().streamVoteSequenceItems[0].id));
    props().handleToolbarCloseVote();
    expect(mocks.updateAgendaVote).toHaveBeenCalledWith({ id: 'variant-vote', status: 'closed' });

    closingVote.status = 'final';
    mocks.agendaItems = [{ ...mocks.agendaItems[0], votes: [variantVote, { ...closingVote }] }];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(
      props().streamVoteSequenceItems.find(
        (item: Record<string, unknown>) => item._voteStepKind === 'change_request_votes_placeholder'
      )?.status
    ).toBe('completed');
  });

  it('synthesizes a closing vote without a preceding variant step', () => {
    mocks.can.mockReturnValue(true);
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-closing-only',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-closing-only',
        amendment_id: 'amendment-1',
        amendment: { title: 'Closing only' },
        forwarding_status: 'forward_confirmed',
        order_index: 1,
        status: 'in-progress',
        title: 'Closing only',
        type: 'amendment',
        votes: [
          {
            id: 'closing-only-vote',
            purpose: 'closing',
            status: 'indicative',
            choices: [{ id: 'yes', label: 'Yes' }],
          },
        ],
        speaker_list: [],
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    expect(props().streamVoteSequenceItems).toHaveLength(1);
    expect(props().streamVoteSequenceItems[0]._voteStepKind).toBe('closing');
  });

  it('initializes a closing sequence when only a variant vote exists', async () => {
    mocks.can.mockReturnValue(true);
    const variantVote = {
      id: 'variant-only-vote',
      purpose: 'merge_variant',
      status: 'indicative',
      choices: [{ id: 'variant-a', label: 'Variant A' }],
    };
    mocks.crVoting = {
      castCRVote: vi.fn(),
      closeVoting: vi.fn(),
      closingVoteItem: null,
      crTimeline: [],
      currentItem: null,
      hasUserVoted: vi.fn(() => false),
      startFinalPhase: vi.fn(),
    };
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-variant-only',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-variant-only',
        amendment_id: 'amendment-1',
        amendment: { title: null, current_process_run: { branches: [] } },
        forwarding_status: 'forward_confirmed',
        order_index: 1,
        status: 'in-progress',
        title: null,
        type: 'amendment',
        votes: [variantVote],
        speaker_list: [],
      },
    ];
    mocks.initializeChangeRequestVoting.mockResolvedValue(undefined);
    const rendered = render(<EventAgenda eventId="event-1" />);
    const changeRequestPlaceholder = props().streamVoteSequenceItems.find(
      (item: Record<string, unknown>) => item._voteStepKind === 'change_request_votes_placeholder'
    );
    const closingPlaceholder = props().streamVoteSequenceItems.find(
      (item: Record<string, unknown>) => item._voteStepKind === 'closing_placeholder'
    );
    const variantSequenceId = props().streamVoteSequenceItems.find(
      (item: Record<string, unknown>) => item._voteStepKind === 'merge_variant'
    ).id;

    expect(closingPlaceholder).toBeDefined();
    act(() => props().setSelectedCRToolbarItemId(changeRequestPlaceholder.id));
    props().handleToolbarCloseVote();
    mocks.initializeChangeRequestVoting.mockRejectedValueOnce(new Error('initialize failed'));
    await act(async () => props().handleStartSequenceFinalVote(changeRequestPlaceholder.id));
    await act(async () => props().handleStartSequenceFinalVote(changeRequestPlaceholder.id));
    expect(mocks.initializeChangeRequestVoting).toHaveBeenCalledWith({
      amendment_id: 'amendment-1',
      agenda_item_id: 'agenda-variant-only',
      start_final_vote_if_no_change_requests: false,
    });
    expect(props().activeCRToolbarItem?.id).toBe(closingPlaceholder.id);
    expect(props().nextStartableSequenceItem?.id).toBe(variantSequenceId);
    act(() => props().handleJumpToNextStartableSequenceItem());
    expect(props().activeCRToolbarItem?.id).toBe(variantSequenceId);

    const timelineItem = {
      id: 'timeline-after-variant',
      agenda_item_id: 'agenda-variant-only',
      is_closing_vote: false,
      status: 'pending',
      vote: { id: 'timeline-vote', status: 'indicative', choices: [] },
    };
    mocks.crVoting = { ...mocks.crVoting, crTimeline: [timelineItem] };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(
      props().streamVoteSequenceItems.some(
        (item: Record<string, unknown>) => item._voteStepKind === 'closing_placeholder'
      )
    ).toBe(true);

    await act(async () => props().handleStartSequenceFinalVote('missing-item'));
    await act(async () => props().handleStartSequenceFinalVote('timeline-after-variant'));
    expect(props().activeCRToolbarItem?.id).toBe(variantSequenceId);

    const startFinalPhase = vi.fn();
    mocks.crVoting = {
      ...mocks.crVoting,
      crTimeline: [timelineItem],
      startFinalPhase,
    };
    mocks.agendaItems = [
      {
        ...mocks.agendaItems[0],
        votes: [{ ...variantVote, status: 'closed' }],
      },
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    await act(async () => props().handleStartSequenceFinalVote('timeline-after-variant'));
    expect(startFinalPhase).toHaveBeenCalledWith('timeline-after-variant');

    startFinalPhase.mockRejectedValueOnce(new Error('final phase failed'));
    await act(async () => props().handleStartSequenceFinalVote('timeline-after-variant'));
    startFinalPhase.mockRejectedValueOnce('unknown failure');
    await act(async () => props().handleStartSequenceFinalVote('timeline-after-variant'));

    mocks.crVoting = {
      ...mocks.crVoting,
      crTimeline: [{ ...timelineItem, vote: { ...timelineItem.vote, status: 'closed' } }],
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    await act(async () => props().handleStartSequenceFinalVote('timeline-after-variant'));

    act(() => props().setSelectedCRToolbarItemId('timeline-after-variant'));
    mocks.event = { ...mocks.event, current_agenda_item_id: 'plain-item' };
    mocks.crVoting = null;
    mocks.agendaItems = [
      {
        id: 'plain-item',
        order_index: 1,
        status: 'in-progress',
        title: 'Plain discussion',
        type: 'discussion',
        speaker_list: [],
      },
    ];
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(props().activeCRToolbarItem).toBeNull();
  });

  it('repairs a confirmed amendment agenda item when its vote sequence is missing', () => {
    mocks.can.mockReturnValue(true);
    mocks.initializeChangeRequestVoting.mockReturnValue({ client: Promise.resolve() });
    mocks.event = {
      ...mocks.event,
      current_agenda_item_id: 'agenda-repair',
      status: 'active',
    };
    mocks.agendaItems = [
      {
        id: 'agenda-repair',
        amendment_id: 'amendment-1',
        amendment: {},
        forwarding_status: 'forward_confirmed',
        order_index: 1,
        status: 'in-progress',
        title: 'Repair vote sequence',
        type: 'amendment',
        election: [],
        votes: [],
        speaker_list: [],
      },
    ];

    const rendered = render(<EventAgenda eventId="event-1" />);

    expect(mocks.initializeChangeRequestVoting).toHaveBeenCalledWith(
      {
        amendment_id: 'amendment-1',
        agenda_item_id: 'agenda-repair',
        start_final_vote_if_no_change_requests: false,
      },
      { silent: true }
    );
    const finalizationOptions = mocks.trackServerFinalization.mock.calls[0]?.[1];

    mocks.forwardingContext = {
      currentStepRun: { decision_status: null },
      nextStepRun: null,
      processRun: null,
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(mocks.initializeChangeRequestVoting).toHaveBeenCalledTimes(1);

    mocks.forwardingContext = {
      currentStepRun: { decision_status: 'rejected' },
      nextStepRun: null,
      processRun: null,
    };
    rendered.rerender(<EventAgenda eventId="event-1" />);
    expect(mocks.initializeChangeRequestVoting).toHaveBeenCalledTimes(1);
    act(() => finalizationOptions.onError());
  });

  it('marks tutorial elections as searchable tutorial content', () => {
    mocks.event = {
      ...mocks.event,
      tutorial_run_id: 'tutorial-run-1',
    };
    mocks.agendaItems = [
      {
        id: 'tutorial-election',
        order_index: 1,
        status: 'pending',
        title: 'Tutorial election',
        type: 'election',
      },
    ];
    render(<EventAgenda eventId="event-1" />);

    expect(props().filteredAgendaItems).toHaveLength(1);
  });
});
