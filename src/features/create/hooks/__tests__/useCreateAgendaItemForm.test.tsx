/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateAgendaItemForm } from '../useCreateAgendaItemForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

let searchParams: Record<string, unknown> = {};
let events: {
  id: string;
  title: string;
  group_id: string | null;
  description?: string | null;
}[] = [];
let participations: { event_id: string; status: string | null }[] = [];
let activeGroupIds = new Set<string>();
let sourceAllocations: unknown[] = [];
let sourceGroupRoles: {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  scope?: string | null;
  assignment_mode?: string | null;
  elections?: unknown[];
}[] = [];
let userRoles: { id: string; title?: string | null }[] = [];
let eventAgendaItems: { order_index?: number | null }[] = [];
const hoistedMocks = vi.hoisted(() => ({
  mutateMock: vi.fn(() => ({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  })),
  serverConfirmedMock: vi.fn(async (mutation: unknown) => mutation),
}));
const { mutateMock, serverConfirmedMock } = hoistedMocks;

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => searchParams,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { __query?: string } | undefined) => {
    if (query?.__query === 'delegateAllocationsBySourceGroup') {
      return [sourceAllocations, { type: 'complete' }];
    }

    if (query?.__query === 'rolesFull') {
      return [sourceGroupRoles, { type: 'complete' }];
    }

    return [[], { type: 'complete' }];
  },
  useZero: () => ({ mutate: hoistedMocks.mutateMock }),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    events: {
      delegateAllocationsBySourceGroup: (args: { groupId: string }) => ({
        __query: 'delegateAllocationsBySourceGroup',
        ...args,
      }),
    },
    groups: {
      rolesFull: (args: { groupId: string }) => ({
        __query: 'rolesFull',
        ...args,
      }),
    },
  },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: Record<string, unknown>) => {
    if (typeof values?.roleTitle === 'string') {
      return values.roleTitle;
    }

    return values ? `${key}:${JSON.stringify(values)}` : key;
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useAllEvents: () => ({ events }),
  useAllAmendments: () => ({ amendments: [] }),
  useEventAgenda: () => ({ agendaItems: eventAgendaItems }),
  useRolesWithGroups: () => ({ roles: userRoles }),
  useUserEventParticipations: () => ({ participations }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useCurrentUserActiveGroupIds: () => ({ activeGroupIds }),
  useGroupById: () => ({ group: null }),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: vi.fn(),
  serverConfirmed: hoistedMocks.serverConfirmedMock,
}));

vi.mock('@/zero/mutators', () => ({
  mutators: {
    agendas: {
      createAgendaItem: (payload: unknown) => ({
        type: 'agendas.createAgendaItem',
        payload,
      }),
      createFull: (payload: unknown) => ({
        type: 'agendas.createFull',
        payload,
      }),
    },
    elections: {
      createElection: (payload: unknown) => ({
        type: 'elections.createElection',
        payload,
      }),
    },
    groups: {
      createRole: (payload: unknown) => ({
        type: 'groups.createRole',
        payload,
      }),
    },
    votes: {
      createVote: (payload: unknown) => ({
        type: 'votes.createVote',
        payload,
      }),
      createVoteChoice: (payload: unknown) => ({
        type: 'votes.createVoteChoice',
        payload,
      }),
    },
  },
}));

function findField<TKind extends CreateFormFieldDescriptor['kind']>(
  fields: CreateFormFieldDescriptor[],
  key: string,
  kind: TKind
): Extract<CreateFormFieldDescriptor, { kind: TKind }> {
  const field = fields.find(candidate => candidate.key === key && candidate.kind === kind);
  if (!field) {
    throw new Error(`Field ${key} not found`);
  }
  return field as Extract<CreateFormFieldDescriptor, { kind: TKind }>;
}

describe('useCreateAgendaItemForm', () => {
  beforeEach(() => {
    searchParams = {};
    activeGroupIds = new Set(['group-1']);
    participations = [{ event_id: 'event-participant', status: 'confirmed' }];
    events = [
      { id: 'event-member', title: 'Member group event', group_id: 'group-1' },
      { id: 'event-participant', title: 'Participating event', group_id: 'group-2' },
      { id: 'event-unrelated', title: 'Unrelated event', group_id: 'group-2' },
    ];
    sourceAllocations = [];
    sourceGroupRoles = [];
    userRoles = [];
    eventAgendaItems = [];
    mutateMock.mockClear();
    serverConfirmedMock.mockClear();
  });

  it('orders title and description before event choice and filters selectable events', () => {
    const { result } = renderHook(() => useCreateAgendaItemForm());
    const fields = result.current.steps[0].fields ?? [];

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.validation.titleRequired'
    );
    expect(fields.slice(0, 3).map(field => field.key)).toEqual(['title', 'description', 'event']);

    const titleField = findField(fields, 'title', 'text');
    act(() => {
      titleField.onValueChange('Budget review');
    });
    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.agendaItem.validation.eventRequired'
    );

    const eventField = findField(fields, 'event', 'typeahead');
    const eventIds = (
      eventField.props as unknown as { items: readonly { id: string }[] }
    ).items.map(item => item.id);

    expect(eventIds.sort()).toEqual(['event-member', 'event-participant']);
  });

  it('reports a missing list-election seat count', () => {
    searchParams = {
      type: 'election',
      eventId: 'event-member',
      electionMode: 'list',
    };
    const { result } = renderHook(() => useCreateAgendaItemForm());
    const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');

    act(() => {
      titleField.onValueChange('Board election');
    });

    const seatCountField = findField(result.current.steps[2].fields ?? [], 'seat-count', 'text');
    act(() => {
      seatCountField.onValueChange('');
    });

    expect(result.current.steps[2].isValid()).toBe(false);
    expect(result.current.steps[2].getInvalidReason?.()).toBe(
      'pages.create.agendaItem.validation.seatCountRequired'
    );
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.agendaItem.validation.seatCountRequired'
    );
  });

  it('resolves role-renewal assignments and submits a standard role election', async () => {
    searchParams = {
      type: 'election',
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'role:chairperson',
    };
    sourceGroupRoles = [
      {
        id: 'chairperson',
        title: 'Chairperson',
        name: 'Chairperson',
        description: 'Leads the group.',
        scope: 'group',
        assignment_mode: 'elected',
        elections: [],
      },
    ];
    userRoles = [{ id: 'chairperson', title: 'Chairperson' }];

    const { result } = renderHook(() => useCreateAgendaItemForm());

    await waitFor(() => {
      const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');
      expect(String(titleField.value)).toContain('Chairperson');
    });

    const typeField = findField(
      result.current.steps[1].sections?.[0]?.fields ?? [],
      'type-selector',
      'customComponent'
    );
    expect((typeField.props as { delegateAssignment?: boolean }).delegateAssignment).toBe(true);

    const additionalLinkFields = result.current.steps[3].fields ?? [];
    expect(additionalLinkFields.some(field => field.key === 'role')).toBe(false);
    expect(additionalLinkFields.some(field => field.key === 'role-renewal-role')).toBe(true);

    await act(async () => {
      await result.current.onSubmit?.();
    });

    const createFullMutation = mutateMock.mock.calls.find(
      ([mutation]) => (mutation as { type?: string }).type === 'agendas.createFull'
    )?.[0] as {
      payload?: {
        agenda_items?: { order_index?: number; event_id?: string; type?: string }[];
        elections?: { role_id?: string; election_mode?: string; seat_count?: number }[];
      };
    };

    expect(createFullMutation.payload?.agenda_items?.[0]).toMatchObject({
      event_id: 'event-member',
      type: 'election',
      order_index: 1,
    });
    expect(createFullMutation.payload?.elections?.[0]).toMatchObject({
      role_id: 'chairperson',
      election_mode: 'single',
      seat_count: 1,
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });
});
