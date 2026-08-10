/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventWiki } from '../EventWiki';

const mocks = vi.hoisted(() => ({
  page: {} as Record<string, any>,
  recoveryDraft: null as Record<string, any> | null,
  contentProps: null as Record<string, any> | null,
  fixture: vi.fn((value: unknown) => value),
  formatLocation: vi.fn(() => 'Berlin'),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'de' }),
  translate: (key: string) => key,
}));
vi.mock('../hooks/useEventWikiPage', () => ({ useEventWikiPage: () => mocks.page }));
vi.mock('@/features/create/logic/createFinalization', () => ({
  useCreateRecoveryDraft: () => mocks.recoveryDraft,
}));
vi.mock('@/features/create/ui/CreateRecoveryState', () => ({
  CreateRecoveryState: () => <div>recovery</div>,
}));
vi.mock('@/features/shared/ui/feedback', () => ({ PageSkeleton: () => <div>loading</div> }));
vi.mock('@/features/auth/ui/AccessDenied', () => ({ AccessDenied: () => <div>denied</div> }));
vi.mock('@/features/meet/MeetingPage', () => ({ MeetingPage: () => <div>meeting</div> }));
vi.mock('@/features/shared/logic/locationHelpers', () => ({
  formatNamedLocation: mocks.formatLocation,
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: mocks.fixture,
}));
vi.mock('../EventWikiContentView', () => ({
  EventWikiContentView: (props: Record<string, any>) => {
    mocks.contentProps = props;
    return <div>wiki content</div>;
  },
}));

function page(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1' },
    canAccess: true,
    isSubscribed: false,
    subscriberCount: 1,
    toggleSubscribe: vi.fn(),
    isLoading: false,
    participation: { isParticipant: false, hasRequested: false, isInvited: false },
    event: null,
    agendaStats: { electionsCount: 2, amendmentsCount: 3, openChangeRequestsCount: 4 },
    elections: [],
    electionsDialogOpen: false,
    setElectionsDialogOpen: vi.fn(),
    confirmDialogOpen: false,
    setConfirmDialogOpen: vi.fn(),
    selectedElection: null,
    isSubmitting: false,
    candidacyPasswordError: null,
    getUserCandidacy: vi.fn(),
    handleElectionClick: vi.fn(),
    handleConfirmCandidacy: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.page = page();
  mocks.recoveryDraft = null;
  mocks.contentProps = null;
  mocks.fixture.mockImplementation(value => value);
});

afterEach(cleanup);

describe('EventWiki coverage', () => {
  it('prioritizes recovery, loading, and not-found states', () => {
    mocks.recoveryDraft = { id: 'draft-1' };
    const view = render(<EventWiki eventId="event-1" />);
    expect(screen.getByText('recovery')).toBeTruthy();

    mocks.recoveryDraft = null;
    mocks.page = page({ isLoading: true });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(screen.getByText('loading')).toBeTruthy();

    mocks.page = page();
    view.rerender(<EventWiki eventId="event-1" />);
    expect(screen.getByText('generated.inline.0426_event_not_found_4ef6dec4')).toBeTruthy();
  });

  it('renders access denial and both meeting discriminators', () => {
    mocks.page = page({ event: { event_type: 'workshop' }, canAccess: false });
    const view = render(<EventWiki eventId="event-1" />);
    expect(screen.getByText('denied')).toBeTruthy();

    mocks.page = page({ event: { event_type: 'meeting' } });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(screen.getByText('meeting')).toBeTruthy();

    mocks.page = page({ event: { event_type: 'workshop', meeting_type: 'plenary' } });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(screen.getByText('meeting')).toBeTruthy();
  });

  it('builds normal content and disables invite-only participation', () => {
    const event = {
      description: 'Description',
      event_type: 'on_invite',
      location_name: 'Town Hall',
      tutorial_run_id: 'tutorial-1',
    };
    mocks.page = page({ event, elections: [{ id: 'election-1' }] });
    render(<EventWiki eventId="event-1" />);

    expect(screen.getByText('wiki content')).toBeTruthy();
    expect(mocks.contentProps).toMatchObject({
      event,
      eventDescription: 'Description',
      formattedLocation: 'Berlin',
      isAssemblyEventType: false,
      shouldDisableParticipationRequest: true,
      participationDisabledReason:
        'generated.inline.0468_this_event_is_by_invitation_only_904d226e',
      virtualizeParticipationDirectory: true,
    });
    expect(mocks.fixture).toHaveBeenCalledTimes(3);
  });

  it('handles delegate and general assemblies and already-started participation', () => {
    mocks.page = page({
      event: { description: null, event_type: 'delegate_assembly' },
    });
    const view = render(<EventWiki eventId="event-1" />);
    expect(mocks.contentProps).toMatchObject({
      eventDescription: undefined,
      isAssemblyEventType: true,
      shouldDisableParticipationRequest: true,
      participationDisabledReason:
        'Only members of the associated group can participate in this general assembly',
    });

    mocks.page = page({
      event: { event_type: 'general_assembly' },
      participation: { isParticipant: true, hasRequested: false, isInvited: false },
    });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(mocks.contentProps).toMatchObject({
      isAssemblyEventType: true,
      shouldDisableParticipationRequest: false,
      participationDisabledReason: undefined,
    });
  });

  it('keeps ordinary, requested, and invited participation enabled', () => {
    mocks.page = page({ event: { event_type: 'workshop' } });
    const view = render(<EventWiki eventId="event-1" />);
    expect(mocks.contentProps?.shouldDisableParticipationRequest).toBe(false);

    mocks.page = page({
      event: { event_type: 'delegate_assembly' },
      participation: { isParticipant: false, hasRequested: true, isInvited: false },
    });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(mocks.contentProps?.shouldDisableParticipationRequest).toBe(false);

    mocks.page = page({
      event: { event_type: 'on_invite' },
      participation: { isParticipant: false, hasRequested: false, isInvited: true },
    });
    view.rerender(<EventWiki eventId="event-1" />);
    expect(mocks.contentProps?.shouldDisableParticipationRequest).toBe(false);
  });
});
