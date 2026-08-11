/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as openAssignmentsModule from '@/features/groups/logic/openAssignments';
import { useCreateAgendaItemForm } from '../useCreateAgendaItemForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

let searchParams: Record<string, unknown> = {};
let events: {
  id: string;
  title: string;
  group_id: string | null;
  description?: string | null;
}[] = [];
let amendments: { id: string; title?: string | null }[] = [];
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
let sourceAllocationsResultType = 'complete';
let sourceGroupRolesResultType = 'complete';
let restoredAgendaDraft: { formState: Record<string, any> } | null = null;
let sourceGroup: { id: string; name?: string | null } | null = null;
const hoistedMocks = vi.hoisted(() => ({
  mutateMock: vi.fn((_input: unknown) => ({
    client: Promise.resolve(),
    server: Promise.resolve({ type: 'success' }),
  })),
  onServerErrorMock: vi.fn(),
  trackCreateFinalizationMock: vi.fn(),
  waitForOptimisticCreateMock: vi.fn(async (result: { client?: Promise<unknown> }) => {
    await result.client;
  }),
}));
const { mutateMock, onServerErrorMock } = hoistedMocks;

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => searchParams,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: { __query?: string } | undefined) => {
    if (query?.__query === 'delegateAllocationsBySourceGroup') {
      return [sourceAllocations, { type: sourceAllocationsResultType }];
    }

    if (query?.__query === 'rolesFull') {
      return [sourceGroupRoles, { type: sourceGroupRolesResultType }];
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
  useAllAmendments: () => ({ amendments }),
  useEventAgenda: () => ({ agendaItems: eventAgendaItems }),
  useRolesWithGroups: () => ({ roles: userRoles }),
  useUserEventParticipations: () => ({ participations }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useCurrentUserActiveGroupIds: () => ({ activeGroupIds }),
  useGroupById: () => ({ group: sourceGroup }),
}));

vi.mock('../../logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => restoredAgendaDraft,
  trackCreateFinalization: hoistedMocks.trackCreateFinalizationMock,
  waitForOptimisticCreate: hoistedMocks.waitForOptimisticCreateMock,
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  onServerError: hoistedMocks.onServerErrorMock,
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

function findAnyField<TKind extends CreateFormFieldDescriptor['kind']>(
  config: ReturnType<typeof useCreateAgendaItemForm>,
  key: string,
  kind: TKind
) {
  const fields = config.steps.flatMap(step => [
    ...(step.fields ?? []),
    ...(step.sections?.flatMap(section => section.fields ?? []) ?? []),
  ]);
  return findField(fields, key, kind);
}

describe('useCreateAgendaItemForm', () => {
  beforeEach(() => {
    searchParams = {};
    activeGroupIds = new Set(['group-1']);
    participations = [
      { event_id: 'event-participant', status: 'confirmed' },
      { event_id: 'event-null-group', status: 'confirmed' },
    ];
    events = [
      { id: 'event-member', title: 'Member group event', group_id: 'group-1' },
      {
        id: 'event-participant',
        title: 'Participating event',
        group_id: 'group-2',
        description: 'A participating event',
      },
      { id: 'event-empty-title', title: '', group_id: 'group-1', description: '' },
      { id: 'event-null-group', title: 'No group event', group_id: null },
      { id: 'event-unrelated', title: 'Unrelated event', group_id: 'group-2' },
    ];
    amendments = [];
    sourceAllocations = [];
    sourceGroupRoles = [];
    userRoles = [];
    eventAgendaItems = [];
    sourceAllocationsResultType = 'complete';
    sourceGroupRolesResultType = 'complete';
    restoredAgendaDraft = null;
    sourceGroup = null;
    mutateMock.mockClear();
    onServerErrorMock.mockClear();
    hoistedMocks.trackCreateFinalizationMock.mockClear();
    hoistedMocks.waitForOptimisticCreateMock.mockClear();
  });

  it('orders title and description before event choice and filters selectable events', () => {
    const { result } = renderHook(() => useCreateAgendaItemForm());
    const fields = result.current.steps[0].fields ?? [];

    expect(result.current.steps[0].isValid()).toBe(false);
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

    expect(eventIds.sort()).toEqual([
      'event-empty-title',
      'event-member',
      'event-null-group',
      'event-participant',
    ]);
  });

  it('reports a missing list-election seat count', () => {
    searchParams = {
      type: 'election',
      eventId: 'event-member',
      electionMode: 'list',
    };
    const { result } = renderHook(() => useCreateAgendaItemForm());
    expect(result.current.steps[0].isValid()).toBe(false);
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
    expect(result.current.steps[0].isValid()).toBe(true);
    return act(async () => {
      expect(await result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
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
    expect(result.current.steps[0].isValid()).toBe(true);

    const additionalLinkFields = result.current.steps[3].fields ?? [];
    expect(additionalLinkFields.some(field => field.key === 'role')).toBe(false);
    expect(additionalLinkFields.some(field => field.key === 'role-renewal-role')).toBe(true);

    let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
    await act(async () => {
      outcome = await result.current.onSubmit?.();
    });

    const mutateCalls = mutateMock.mock.calls as unknown as [
      {
        type?: string;
        payload?: {
          agenda_items?: {
            id?: string;
            order_index?: number;
            event_id?: string;
            type?: string;
          }[];
          elections?: { role_id?: string; election_mode?: string; seat_count?: number }[];
        };
      },
    ][];
    const createFullMutation = mutateCalls
      .map(([mutation]) => mutation)
      .find(mutation => mutation.type === 'agendas.createFull');
    expect(createFullMutation).toBeTruthy();
    if (!createFullMutation) {
      throw new Error('Expected agendas.createFull mutation to be submitted');
    }
    const agendaItemId = createFullMutation.payload?.agenda_items?.[0]?.id;

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
    expect(agendaItemId).toBeTruthy();
    expect(outcome).toMatchObject({
      status: 'success',
      target: {
        to: '/event/$id/agenda/$agendaItemId',
        params: { id: 'event-member', agendaItemId },
      },
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('restores a complete vote draft including custom order and linked entities', async () => {
    amendments = [{ id: 'amendment-1', title: 'Budget amendment' }];
    userRoles = [{ id: 'role-1', title: 'Treasurer' }];
    restoredAgendaDraft = {
      formState: {
        eventId: 'event-member',
        type: 'vote',
        title: 'Restored vote',
        description: 'Restored description',
        order: 7,
        hasCustomOrder: true,
        duration: '15',
        amendmentId: 'amendment-1',
        roleId: 'role-1',
        majorityType: 'two_thirds',
        timeLimit: '5',
        ballotVisibility: 'secret',
        electionMode: 'list',
        seatCountInput: '4',
      },
    };

    const { result } = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() => {
      expect(findAnyField(result.current, 'title', 'text').value).toBe('Restored vote');
    });

    expect(findAnyField(result.current, 'order', 'text').value).toBe(7);
    expect(findAnyField(result.current, 'duration', 'text').value).toBe('15');
    expect(findAnyField(result.current, 'amendment', 'typeahead').props.value).toBe('amendment-1');
    const review = findAnyField(result.current, 'review', 'customComponent').props as any;
    expect(review.sections.flatMap((section: any) => section.fields).length).toBeGreaterThan(7);
    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
  });

  it('restores an empty agenda draft with default values', () => {
    restoredAgendaDraft = { formState: {} };
    const { result } = renderHook(() => useCreateAgendaItemForm());

    expect(findAnyField(result.current, 'title', 'text').value).toBe('');
    expect(
      (findAnyField(result.current, 'type-selector', 'customComponent').props as any).type
    ).toBe('discussion');
    expect(findAnyField(result.current, 'order', 'text').value).toBe(1);
  });

  it('blocks submission before basic information is complete', async () => {
    const { result } = renderHook(() => useCreateAgendaItemForm());
    await act(async () => {
      expect(await result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
  });

  it('submits a configured vote and executes its recovery retry', async () => {
    searchParams = { eventId: 'event-member', type: 'vote' };
    amendments = [{ id: 'amendment-1', title: 'Budget amendment' }];
    const reportProgress = vi.fn();
    const setRecoveryTarget = vi.fn();
    const { result } = renderHook(() => useCreateAgendaItemForm());

    act(() => {
      findAnyField(result.current, 'title', 'text').onValueChange('  Budget vote  ');
      findAnyField(result.current, 'description', 'text').onValueChange('  Decide now  ');
      findAnyField(result.current, 'order', 'text').onValueChange('0');
      findAnyField(result.current, 'duration', 'text').onValueChange('20');
      (findAnyField(result.current, 'majority-type', 'customComponent').props as any).onChange(
        'absolute'
      );
      findAnyField(result.current, 'time-limit', 'text').onValueChange('3');
      (findAnyField(result.current, 'ballot-visibility', 'customComponent').props as any).onChange(
        'secret'
      );
      (findAnyField(result.current, 'amendment', 'typeahead').props as any).onChange({
        id: 'amendment-1',
      });
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.onSubmit?.({ reportProgress, setRecoveryTarget } as any);
    });

    const payload = (mutateMock.mock.calls.at(-1)?.[0] as any)?.payload;
    expect(payload.agenda_items[0]).toMatchObject({
      type: 'vote',
      duration: 20,
      order_index: 1,
      voting_phase: 'indicative',
      majority_type: 'absolute',
      time_limit: 180,
      amendment_id: 'amendment-1',
    });
    expect(payload.votes[0].vote).toMatchObject({
      title: 'Budget vote',
      ballot_visibility: 'secret',
      amendment_id: 'amendment-1',
    });
    expect(payload.votes[0].choices.map((choice: any) => choice.label)).toEqual([
      'Yes',
      'No',
      'Abstain',
    ]);
    expect(outcome).toMatchObject({ status: 'success' });
    expect(reportProgress).toHaveBeenCalledTimes(4);
    expect(setRecoveryTarget).toHaveBeenCalledTimes(1);

    const retry = hoistedMocks.trackCreateFinalizationMock.mock.calls.at(-1)?.[0]?.retry;
    expect(retry).toBeTypeOf('function');
    retry();
    expect(hoistedMocks.trackCreateFinalizationMock).toHaveBeenCalledTimes(2);
  });

  it('submits a non-votable discussion with empty optional values', async () => {
    searchParams = { eventId: 'event-member', type: 'discussion' };
    eventAgendaItems = [{ order_index: null }, { order_index: 4 }];
    const { result } = renderHook(() => useCreateAgendaItemForm());

    act(() => {
      findAnyField(result.current, 'title', 'text').onValueChange('Discussion');
      (findAnyField(result.current, 'event', 'typeahead').props as any).onChange(null);
    });

    await act(async () => {
      await result.current.onSubmit?.();
    });

    const payload = (mutateMock.mock.calls.at(-1)?.[0] as any)?.payload;
    expect(payload).toEqual(
      expect.objectContaining({
        agenda_items: [
          expect.objectContaining({
            type: 'discussion',
            order_index: 5,
            duration: 0,
            amendment_id: null,
            voting_phase: null,
            majority_type: null,
            time_limit: null,
          }),
        ],
      })
    );
    expect(payload).not.toHaveProperty('roles');
    expect(payload).not.toHaveProperty('elections');
    expect(payload).not.toHaveProperty('votes');
  });

  it('reports loading and failed assignment lookups before mutation', async () => {
    searchParams = {
      eventId: 'event-member',
      type: 'election',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:missing',
    };
    sourceAllocationsResultType = 'unknown';
    const loadingHook = renderHook(() => useCreateAgendaItemForm());
    act(() => findAnyField(loadingHook.result.current, 'title', 'text').onValueChange('Election'));
    expect(loadingHook.result.current.steps[0].isValid()).toBe(false);
    expect(loadingHook.result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.agendaItem.assignmentLoading'
    );
    await act(async () => {
      expect(await loadingHook.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
    loadingHook.unmount();

    sourceAllocationsResultType = 'complete';
    const failedHook = renderHook(() => useCreateAgendaItemForm());
    act(() => findAnyField(failedHook.result.current, 'title', 'text').onValueChange('Election'));
    expect(failedHook.result.current.steps[0].isValid()).toBe(false);
    expect(failedHook.result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.agendaItem.assignmentLookupFailed'
    );
    expect(
      findAnyField(failedHook.result.current, 'assignment-error', 'customComponent')
    ).toBeTruthy();
    await act(async () => {
      expect(await failedHook.result.current.onSubmit?.()).toMatchObject({ status: 'blocked' });
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('reacts to changed search defaults and submits a standard multi-seat election', async () => {
    userRoles = [{ id: 'role-1', title: 'Treasurer' }];
    const hook = renderHook(() => useCreateAgendaItemForm());

    searchParams = {
      eventId: 'event-member',
      type: 'election',
      electionMode: 'list',
    };
    hook.rerender();
    await waitFor(() => {
      expect(findAnyField(hook.result.current, 'event', 'typeahead').props.value).toBe(
        'event-member'
      );
      expect(findAnyField(hook.result.current, 'seat-count', 'text')).toBeTruthy();
    });

    act(() => {
      findAnyField(hook.result.current, 'title', 'text').onValueChange('Board members');
      findAnyField(hook.result.current, 'description', 'text').onValueChange('');
      findAnyField(hook.result.current, 'seat-count', 'text').onValueChange('3');
      (findAnyField(hook.result.current, 'election-mode', 'customComponent').props as any).onChange(
        'list'
      );
      (findAnyField(hook.result.current, 'majority-type', 'customComponent').props as any).onChange(
        'two_thirds'
      );
      findAnyField(hook.result.current, 'time-limit', 'text').onValueChange('2');
      (findAnyField(hook.result.current, 'role', 'customComponent').props as any).onChange(
        'role-1'
      );
    });

    await act(async () => {
      await hook.result.current.onSubmit?.();
    });
    const payload = (mutateMock.mock.calls.at(-1)?.[0] as any)?.payload;
    expect(payload.elections[0]).toMatchObject({
      election_mode: 'list',
      seat_count: 3,
      max_votes: 3,
      role_id: 'role-1',
      majority_type: 'two_thirds',
      description: null,
    });
    expect(payload.agenda_items[0]).toMatchObject({ time_limit: 120 });
  });

  it('resets ballot defaults across type changes and reports optimistic creation failures', async () => {
    searchParams = { eventId: 'event-member' };
    const { result } = renderHook(() => useCreateAgendaItemForm());
    const selector = () =>
      findAnyField(result.current, 'type-selector', 'customComponent').props as any;

    act(() => selector().onTypeChange('vote'));
    await waitFor(() => expect(selector().type).toBe('vote'));
    act(() => selector().onTypeChange('election'));
    await waitFor(() => expect(selector().type).toBe('election'));
    act(() => findAnyField(result.current, 'title', 'text').onValueChange('Failing election'));

    hoistedMocks.waitForOptimisticCreateMock.mockRejectedValueOnce(new Error('server rejected'));
    await act(async () => {
      await expect(result.current.onSubmit?.()).rejects.toThrow('server rejected');
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('handles null query collections and assignment params without event targets', async () => {
    searchParams = { sourceGroupId: 'group-1' };
    sourceAllocations = null as any;
    sourceGroupRoles = null as any;
    const emptyHook = renderHook(() => useCreateAgendaItemForm());
    expect(
      (findAnyField(emptyHook.result.current, 'type-selector', 'customComponent').props as any)
        .delegateAssignment
    ).toBe(false);
    emptyHook.unmount();

    searchParams = {
      sourceGroupId: 'group-1',
      assignmentId: 'role:role-empty',
      type: 'vote',
    };
    sourceAllocations = [];
    sourceGroupRoles = [
      {
        id: 'role-empty',
        title: null,
        name: null,
        description: null,
        scope: 'group',
        assignment_mode: 'elected',
        elections: [],
      },
    ];
    const roleHook = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() =>
      expect(
        (findAnyField(roleHook.result.current, 'type-selector', 'customComponent').props as any)
          .type
      ).toBe('election')
    );
    expect(
      findAnyField(roleHook.result.current, 'role-renewal-role', 'customComponent')
    ).toBeTruthy();
    roleHook.unmount();

    searchParams = {
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:allocation-no-target-param',
      type: 'vote',
    };
    sourceAllocations = [
      {
        id: 'allocation-no-target-param',
        allocated_seats: 1,
        group: { id: 'group-1' },
        event: {
          id: 'target-event',
          title: 'Target',
          group: { id: 'target-group' },
          delegates: [],
        },
      },
    ];
    sourceGroupRoles = [];
    const delegateHook = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() =>
      expect(
        (findAnyField(delegateHook.result.current, 'type-selector', 'customComponent').props as any)
          .type
      ).toBe('election')
    );
    expect(
      findAnyField(delegateHook.result.current, 'delegate-assignment', 'customComponent')
    ).toBeTruthy();
  });

  it('throws a submission failure for an incomplete delegate target', async () => {
    searchParams = {
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:broken',
      targetEventId: 'broken-target',
    };
    sourceAllocations = [
      {
        id: 'broken',
        allocated_seats: 1,
        group: { id: 'group-1' },
        event: {
          id: 'broken-target',
          title: 'Broken target',
          group: {},
          delegates: [],
        },
      },
    ];
    const { result } = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() => expect(findAnyField(result.current, 'title', 'text').value).toBeTruthy());
    await act(async () => {
      await expect(result.current.onSubmit?.()).rejects.toThrow(
        'Der Delegiertenauftrag konnte nicht eindeutig aufgelöst werden.'
      );
    });
  });

  it('labels multiple automatic single-election delegate seats', async () => {
    searchParams = {
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:plural',
      targetEventId: 'plural-target',
    };
    sourceAllocations = [
      {
        id: 'plural',
        allocated_seats: 2,
        group: { id: 'group-1' },
        event: {
          id: 'plural-target',
          title: 'Plural target',
          group: { id: 'target-group' },
          delegate_election_mode: 'single',
          delegates: [],
        },
      },
    ];
    const { result } = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() =>
      expect(findAnyField(result.current, 'delegate-seat-count', 'customComponent')).toBeTruthy()
    );
    expect(
      (findAnyField(result.current, 'delegate-seat-count', 'customComponent').props as any)
        .seatLabel
    ).toBe('generated.inline.0044_einzelwahlen_c5379380');
  });

  it('submits a minimal vote with null optional links', async () => {
    searchParams = { type: 'vote', eventId: 'event-member' };
    const { result } = renderHook(() => useCreateAgendaItemForm());
    act(() => findAnyField(result.current, 'title', 'text').onValueChange('Minimal vote'));
    await act(async () => {
      await result.current.onSubmit?.();
    });
    const payload = (mutateMock.mock.calls.at(-1)?.[0] as any)?.payload;
    expect(payload.votes[0].vote).toMatchObject({ description: null, amendment_id: null });
  });

  it('covers optional role routing and missing linked labels', () => {
    searchParams = { type: 'election' };
    const noEvent = renderHook(() => useCreateAgendaItemForm());
    const emptyRoleProps = findAnyField(noEvent.result.current, 'role', 'customComponent')
      .props as any;
    expect(emptyRoleProps.groupIds).toBeUndefined();
    expect(emptyRoleProps.eventId).toBeUndefined();
    noEvent.unmount();

    searchParams = { type: 'election', eventId: 'event-null-group' };
    const roleHook = renderHook(() => useCreateAgendaItemForm());
    act(() => {
      findAnyField(roleHook.result.current, 'title', 'text').onValueChange('Unknown role');
      (findAnyField(roleHook.result.current, 'role', 'customComponent').props as any).onChange(
        'missing-role'
      );
    });
    const roleReview = findAnyField(roleHook.result.current, 'review', 'customComponent')
      .props as any;
    expect(
      roleReview.sections
        .flatMap((section: any) => section.fields)
        .some((field: any) => field.value === 'missing-role')
    ).toBe(true);
    roleHook.unmount();

    searchParams = { type: 'vote', eventId: 'event-member' };
    amendments = [{ id: 'amendment-without-title', title: null }];
    const amendmentHook = renderHook(() => useCreateAgendaItemForm());
    act(() => {
      findAnyField(amendmentHook.result.current, 'title', 'text').onValueChange('Fallback label');
      (findAnyField(amendmentHook.result.current, 'amendment', 'typeahead').props as any).onChange({
        id: 'amendment-without-title',
      });
    });
    const amendmentReview = findAnyField(amendmentHook.result.current, 'review', 'customComponent')
      .props as any;
    expect(
      amendmentReview.sections
        .flatMap((section: any) => section.fields)
        .some((field: any) => field.value === 'amendment-without-title')
    ).toBe(true);
    act(() =>
      (findAnyField(amendmentHook.result.current, 'amendment', 'typeahead').props as any).onChange(
        null
      )
    );
  });

  it.each(['list', 'single'] as const)(
    'creates delegate-assignment seat roles and %s election records',
    async electionMode => {
      searchParams = {
        eventId: 'event-member',
        type: 'election',
        sourceGroupId: 'group-1',
        assignmentId: 'delegate:allocation-1',
        targetEventId: 'target-event',
        electionMode,
      };
      sourceGroup = { id: 'group-1', name: 'Source Group' };
      sourceGroupRoles = electionMode === 'list' ? (null as any) : [];
      const allocatedSeats = electionMode === 'single' ? 1 : 2;
      sourceAllocations = [
        {
          id: 'allocation-1',
          allocated_seats: allocatedSeats,
          group: { id: 'group-1', name: 'Source Group' },
          event: {
            id: 'target-event',
            title: electionMode === 'list' ? undefined : 'Delegate Assembly',
            group: { id: 'target-group', name: 'Target Group' },
            delegate_election_mode: electionMode,
            delegates: [],
          },
        },
      ];

      const { result } = renderHook(() => useCreateAgendaItemForm());
      await waitFor(() => {
        expect(String(findAnyField(result.current, 'title', 'text').value).length).toBeGreaterThan(
          0
        );
      });

      act(() => findAnyField(result.current, 'description', 'text').onValueChange(''));
      expect(findAnyField(result.current, 'delegate-assignment', 'customComponent')).toBeTruthy();
      expect(findAnyField(result.current, 'delegate-target', 'customComponent')).toBeTruthy();
      await act(async () => {
        await result.current.onSubmit?.();
      });

      const payload = (mutateMock.mock.calls.at(-1)?.[0] as any)?.payload;
      expect(payload.roles).toHaveLength(allocatedSeats);
      expect(payload.elections).toHaveLength(electionMode === 'list' ? 1 : allocatedSeats);
      expect(payload.agenda_items).toHaveLength(electionMode === 'list' ? 1 : allocatedSeats);
      expect(payload.elections[0].election_mode).toBe(electionMode);
    }
  );

  it('keeps assignment prefill inert when an integration record lacks its seat count', () => {
    searchParams = {
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:missing-seat-count',
    };
    vi.spyOn(openAssignmentsModule, 'buildOpenAssignments').mockReturnValueOnce([
      {
        id: 'delegate:missing-seat-count',
        kind: 'delegate_election',
        status: 'open',
        title: 'Invalid assignment',
        description: '',
        targetEvent: {
          id: 'target-event',
          title: 'Assembly',
          group: { id: 'target-group', name: 'Target' },
        },
      },
    ]);

    const { result } = renderHook(() => useCreateAgendaItemForm());

    expect(findAnyField(result.current, 'type-selector', 'customComponent').props).toMatchObject({
      delegateAssignment: true,
      type: 'election',
    });
  });

  it('rejects a list assignment when the host does not allocate its seat role id', async () => {
    searchParams = {
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:list-without-id',
      targetEventId: 'target-event',
    };
    vi.spyOn(openAssignmentsModule, 'buildOpenAssignments').mockReturnValueOnce([
      {
        id: 'delegate:list-without-id',
        kind: 'delegate_election',
        status: 'open',
        title: 'List assignment',
        description: '',
        seatCount: 1,
        completedSeatCount: 0,
        remainingSeatCount: 1,
        targetEvent: {
          id: 'target-event',
          title: 'Assembly',
          delegate_election_mode: 'list',
          group: { id: 'target-group', name: 'Target' },
        },
      },
    ]);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce(undefined as never);

    const { result } = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() => expect(findAnyField(result.current, 'title', 'text').value).toBeTruthy());

    await act(async () => {
      await expect(result.current.onSubmit?.()).rejects.toThrow(
        'Für die Delegiertenwahl wurde kein Sitz angelegt.'
      );
    });
  });

  it('rejects an assignment that cannot produce a primary agenda item', async () => {
    searchParams = {
      eventId: 'event-member',
      sourceGroupId: 'group-1',
      assignmentId: 'delegate:invalid-count',
      targetEventId: 'target-event',
    };
    vi.spyOn(openAssignmentsModule, 'buildOpenAssignments').mockReturnValueOnce([
      {
        id: 'delegate:invalid-count',
        kind: 'delegate_election',
        status: 'open',
        title: 'Invalid assignment',
        description: '',
        seatCount: Number.NaN,
        completedSeatCount: 0,
        remainingSeatCount: Number.NaN,
        targetEvent: {
          id: 'target-event',
          title: 'Assembly',
          delegate_election_mode: 'single',
          group: { id: 'target-group', name: 'Target' },
        },
      },
    ]);

    const { result } = renderHook(() => useCreateAgendaItemForm());
    await waitFor(() => expect(findAnyField(result.current, 'title', 'text').value).toBeTruthy());

    await act(async () => {
      await expect(result.current.onSubmit?.()).rejects.toThrow(
        'Es wurde kein Tagesordnungspunkt erzeugt.'
      );
    });
  });
});
