/* @vitest-environment jsdom */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderComponentFlow } from '@/test/render-component-flow';

const mocks = vi.hoisted(() => ({
  castVote: vi.fn(),
  handleTransfer: vi.fn(),
  participations: [] as any[],
  toastSuccess: vi.fn(),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

vi.mock('@/features/votes/hooks/useChangeRequestVoting', () => ({
  useChangeRequestVoting: () => ({
    currentChangeRequest: null,
    voteResults: null,
    hasVoted: false,
    castVote: mocks.castVote,
    isLoading: false,
  }),
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'manager-1' } }) }));
vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({ participations: mocks.participations, isLoading: false }),
}));
vi.mock('@/features/agendas/hooks/useAgendaItemMutations', () => ({
  useAgendaItemMutations: () => ({ handleTransfer: mocks.handleTransfer, transferLoading: false }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => value,
}));
vi.mock('@/features/shared/ui/typeahead/TypeaheadSearch', () => ({
  TypeaheadSearch: ({
    items,
    onChange,
  }: {
    items: { id: string; label: string }[];
    onChange: (item: any) => void;
  }) => (
    <div>
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => onChange(item)}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

import { AmendmentVotingQueue } from '@/features/votes/ui/AmendmentVotingQueue';
import { TransferAgendaItemDialog } from '@/features/agendas/ui/TransferAgendaItemDialog';

const requests = [
  {
    id: 'request-a',
    title: 'First proposal',
    description: 'First',
    proposedChange: 'A',
    votingOrder: 0,
    status: 'open',
    createdAt: 1,
  },
  {
    id: 'request-b',
    title: 'Second proposal',
    description: 'Second',
    proposedChange: 'B',
    votingOrder: 1,
    status: 'open',
    createdAt: 2,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.handleTransfer.mockResolvedValue(undefined);
  mocks.participations = [];
});

afterEach(cleanup);

describe('agenda ordering component flow', () => {
  it('reorders an agenda voting sequence through the organizer controls', () => {
    renderComponentFlow(
      <AmendmentVotingQueue
        amendmentId="amendment-1"
        eventId="event-1"
        agendaItemId="agenda-1"
        changeRequests={requests}
        isOrganizer
        onAdvanceToNext={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getAllByRole('heading', { level: 4 }).map(node => node.textContent)).toEqual([
      'First proposal',
      'Second proposal',
    ]);

    const moveUp = document.querySelectorAll(
      '[data-action-id="votes.amendment-queue.order.move-up"]'
    );
    fireEvent.click(moveUp[1] as HTMLElement);

    expect(screen.getAllByRole('heading', { level: 4 }).map(node => node.textContent)).toEqual([
      'Second proposal',
      'First proposal',
    ]);
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
  });

  it('transfers an agenda item to an authorized event and closes the flow', async () => {
    mocks.participations = [
      { event: { id: 'event-1', title: 'Current event' } },
      { event: { id: 'event-2', title: 'Destination event', group: { name: 'Council' } } },
    ];
    const onTransferComplete = vi.fn();

    renderComponentFlow(
      <TransferAgendaItemDialog
        agendaItemId="agenda-1"
        agendaItemTitle="Budget"
        currentEventId="event-1"
        currentEventTitle="Current event"
        open
        onOpenChange={vi.fn()}
        onTransferComplete={onTransferComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Destination event' }));
    fireEvent.click(document.querySelector('[data-action-id="agendas.transfer.confirm"]')!);

    await waitFor(() =>
      expect(mocks.handleTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          agendaItemTitle: 'Budget',
          sourceEventTitle: 'Current event',
          targetEventId: 'event-2',
          targetEventTitle: 'Destination event',
        })
      )
    );
    expect(onTransferComplete).toHaveBeenCalledOnce();
  });

  it('prevents transfer to the current, duplicate, or unauthorized destination', () => {
    mocks.participations = [
      { event: null },
      { event: { id: 'event-1', title: 'Current event' } },
      { event: { id: 'event-1', title: 'Duplicate current event' } },
    ];

    renderComponentFlow(
      <TransferAgendaItemDialog
        agendaItemId="agenda-1"
        agendaItemTitle="Budget"
        currentEventId="event-1"
        currentEventTitle="Current event"
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('features.events.agenda.noEventsWithPermission')).toBeTruthy();
    expect(
      (document.querySelector('[data-action-id="agendas.transfer.confirm"]') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(mocks.handleTransfer).not.toHaveBeenCalled();
  });
});
