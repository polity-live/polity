/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invalidCard: false, cardProps: [] as any[] }));
vi.mock('@/features/search/logic/buildTimelineCardProps', () => ({
  buildTimelineCardProps: (props: any) => {
    mocks.cardProps.push(props);
    return mocks.invalidCard
      ? { cardType: null, cardProps: null }
      : { cardType: 'event', cardProps: props };
  },
}));
vi.mock('@/features/timeline/ui/LazyCardComponents', () => ({
  DynamicTimelineCard: ({ cardProps }: any) => (
    <button data-testid="event-card" onClick={cardProps.onSelect}>
      {cardProps.title}
    </button>
  ),
}));
vi.mock('@/features/groups/ui/ProcessAgendaPreviewDialog', () => ({
  ProcessAgendaPreviewDialog: ({ onOpenChange }: any) => (
    <>
      <button data-testid="agenda-dialog" onClick={() => onOpenChange(false)}>
        agenda
      </button>
      <button data-testid="agenda-dialog-open" onClick={() => onOpenChange(true)}>
        keep agenda
      </button>
    </>
  ),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));

import {
  OpenAssignmentsPanelView,
  openAssignmentsPanelViewInternals,
} from '../OpenAssignmentsPanelView';

afterEach(cleanup);
beforeEach(() => {
  mocks.invalidCard = false;
  mocks.cardProps = [];
  vi.clearAllMocks();
});

const t = (key: string, options?: Record<string, any>) => options?.defaultValue ?? key;
const base = (overrides: Record<string, unknown> = {}) =>
  ({
    groupId: 'g',
    groupName: 'Group',
    assignments: [{ id: 'a' }],
    availableEvents: [],
    isLoading: false,
    isScheduling: false,
    t,
    i18n: { language: 'en' },
    selectedEventIds: {},
    setSelectedEventIds: vi.fn(),
    eventDialogAssignmentId: null,
    setEventDialogAssignmentId: vi.fn(),
    eventDialogEventId: '',
    setEventDialogEventId: vi.fn(),
    eventDialogSearchQuery: '',
    setEventDialogSearchQuery: vi.fn(),
    eventDialogCorrelationId: null,
    setEventDialogCorrelationId: vi.fn(),
    agendaPreviewAssignmentId: null,
    setAgendaPreviewAssignmentId: vi.fn(),
    filteredAssignmentsWithProgress: [],
    assignmentFilters: null,
    activeEventAssignment: null,
    activeAgendaPreviewAssignment: null,
    filteredEventDialogEvents: [],
    openEventDialog: vi.fn(),
    closeEventDialog: vi.fn(),
    handleCreateAssignmentElection: vi.fn(),
    isAmendmentProcessAssignment: vi.fn(),
    assignmentColumns: [],
    onScheduleRoleRenewal: vi.fn(),
    onScheduleDelegateElection: vi.fn(),
    onScheduleProcessTask: vi.fn(),
    ...overrides,
  }) as any;

describe('OpenAssignmentsPanelView remaining branches', () => {
  it('renders the empty assignment state', () => {
    render(<OpenAssignmentsPanelView {...base({ assignments: [] })} />);
    expect(document.body.textContent).toContain('emptyDescription');
  });

  it('builds event cards for all date and group shapes and rejects invalid cards', () => {
    const renderCard = (event: any, onSelect?: () => void) => {
      const result = openAssignmentsPanelViewInternals.buildEventCard(event, onSelect);
      if (result) render(<>{result}</>);
      return result;
    };
    renderCard({ id: 'one', title: null, start_date: null, end_date: null, group_id: null });
    renderCard(
      { id: 'two', title: 'Two', start_date: 10, end_date: 20, group_id: 'group' },
      vi.fn()
    );
    renderCard({ id: 'three', title: 'Three', group: { id: null, name: null } });
    renderCard({ id: 'four', title: 'Four', group: { id: 'g', name: 'Named' } });
    renderCard({ id: 'five', title: 'Five' });
    mocks.invalidCard = true;
    expect(renderCard({ id: 'invalid', title: 'Invalid' })).toBeNull();
    expect(mocks.cardProps).toHaveLength(6);
  });

  it('covers role dialog fallbacks, search, selection, empty results, and disabled creation', () => {
    const setSearch = vi.fn();
    const setEvent = vi.fn();
    const active = { id: 'role', kind: 'role_renewal', description: 'Renew role' };
    const props = base({
      groupName: null,
      isScheduling: true,
      activeEventAssignment: active,
      eventDialogSearchQuery: 'chair',
      setEventDialogSearchQuery: setSearch,
      setEventDialogEventId: setEvent,
      filteredEventDialogEvents: [{ id: 'event', title: null }],
    });
    const { rerender } = render(<OpenAssignmentsPanelView {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new query' } });
    fireEvent.click(screen.getByTestId('event-card'));
    expect(setSearch).toHaveBeenCalledWith('new query');
    expect(setEvent).toHaveBeenCalledWith('event');
    expect(screen.getByRole('button', { name: /create$/ }).hasAttribute('disabled')).toBe(true);

    rerender(
      <OpenAssignmentsPanelView
        {...base({ groupName: null, activeEventAssignment: active, filteredEventDialogEvents: [] })}
      />
    );
    expect(document.body.textContent).toContain('roleRenewalDialog.emptySearch');
  });

  it('covers delegate target presence, selection state, delegate search, and agenda closing', () => {
    const setAgenda = vi.fn();
    const active = {
      id: 'delegate',
      kind: 'delegate_election',
      remainingSeatCount: 2,
      targetEvent: {
        id: 'target',
        title: 'Target',
        start_date: 10,
        delegate_election_mode: 'list',
      },
    };
    const { rerender } = render(
      <OpenAssignmentsPanelView
        {...base({
          groupName: null,
          activeEventAssignment: active,
          eventDialogEventId: 'chosen',
          filteredEventDialogEvents: [
            { id: 'chosen', title: 'Chosen' },
            { id: 'other', title: 'Other' },
          ],
          activeAgendaPreviewAssignment: { amendment: { id: 'amendment', title: 'A' } },
          setAgendaPreviewAssignmentId: setAgenda,
        })}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'delegates' } });
    fireEvent.click(screen.getAllByTestId('event-card')[1]);
    fireEvent.click(screen.getByTestId('agenda-dialog-open'));
    fireEvent.click(screen.getByTestId('agenda-dialog'));
    expect(setAgenda).toHaveBeenCalledWith(null);

    rerender(
      <OpenAssignmentsPanelView
        {...base({
          activeEventAssignment: { ...active, targetEvent: null },
          filteredEventDialogEvents: [],
        })}
      />
    );
    expect(document.body.textContent).toContain('delegateDialog.emptySearch');
  });
});
