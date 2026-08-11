/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateElectionCandidateForm } from '../useCreateElectionCandidateForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';
import { setCreateRestoreDraft } from '../../logic/createFinalization';

const addCandidate = vi.fn();
let electionsForSearch: {
  id: string;
  title: string;
  description?: string | null;
  agenda_item_id?: string | null;
  agenda_item?: {
    id?: string | null;
    event?: {
      id: string;
      group_id: string | null;
    } | null;
  } | null;
}[] = [];
let participations: { event_id: string; status: string | null }[] = [];
let activeGroupIds = new Set<string>();

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/zero/elections/useElectionActions', () => ({
  useElectionActions: () => ({ addCandidateOptimistic: addCandidate }),
}));

vi.mock('@/zero/elections/useElectionState', () => ({
  useElectionState: () => ({ electionsForSearch }),
}));

vi.mock('@/zero/events/useEventState', () => ({
  useUserEventParticipations: () => ({ participations }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAssignableGroupMembersByGroupIds: () => ({ members: [], isLoading: false }),
  useCurrentUserActiveGroupIds: () => ({ activeGroupIds }),
  useGroupById: () => ({ group: null }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    finalizationSuccess: vi.fn(),
    loading: vi.fn(),
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

describe('useCreateElectionCandidateForm', () => {
  beforeEach(() => {
    addCandidate.mockReset();
    addCandidate.mockReturnValue({
      client: Promise.resolve(),
      server: new Promise(() => undefined),
    });
    window.sessionStorage.clear();
    vi.stubGlobal('crypto', { randomUUID: () => 'candidate-1' });
    activeGroupIds = new Set(['group-1']);
    participations = [{ event_id: 'event-participant', status: 'active' }];
    electionsForSearch = [
      {
        id: 'election-member',
        title: 'Member event election',
        agenda_item_id: 'agenda-member',
        agenda_item: { id: 'agenda-member', event: { id: 'event-member', group_id: 'group-1' } },
      },
      {
        id: 'election-participant',
        title: 'Participating event election',
        agenda_item_id: 'agenda-participant',
        agenda_item: {
          id: 'agenda-participant',
          event: { id: 'event-participant', group_id: 'group-2' },
        },
      },
      {
        id: 'election-unrelated',
        title: 'Unrelated election',
        agenda_item_id: 'agenda-unrelated',
        agenda_item: {
          id: 'agenda-unrelated',
          event: { id: 'event-unrelated', group_id: 'group-2' },
        },
      },
      {
        id: 'election-without-event',
        title: 'Election without event',
        agenda_item: null,
      },
    ];
  });

  it('only exposes elections from selectable events', () => {
    const { result } = renderHook(() => useCreateElectionCandidateForm());
    const electionField = findField(
      result.current.steps[0].fields ?? [],
      'election',
      'customComponent'
    );
    const props = electionField.props as {
      allowedElectionIds: string[];
      onChange: (electionId: string) => void;
    };

    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.electionCandidate.validation.electionRequired'
    );
    expect([...props.allowedElectionIds].sort()).toEqual([
      'election-member',
      'election-participant',
    ]);

    act(() => {
      props.onChange('election-unrelated');
    });
    expect(result.current.steps[0].isValid()).toBe(false);

    act(() => {
      props.onChange('election-member');
    });
    expect(result.current.steps[0].isValid()).toBe(true);
  });

  it('stores election-candidate recovery drafts under the matching entity key', async () => {
    const { result } = renderHook(() => useCreateElectionCandidateForm());
    const electionField = findField(
      result.current.steps[0].fields ?? [],
      'election',
      'customComponent'
    );

    act(() => {
      (electionField.props as { onChange: (electionId: string) => void }).onChange(
        'election-member'
      );
    });

    let outcome: Awaited<ReturnType<typeof result.current.onSubmit>> | undefined;
    await act(async () => {
      outcome = await result.current.onSubmit?.();
    });

    const rawDraft = window.sessionStorage.getItem('polity:create:recovery:election:candidate-1');
    expect(rawDraft).not.toBeNull();
    expect(JSON.parse(rawDraft ?? '{}')).toMatchObject({
      id: 'election:candidate-1',
      entityType: 'election',
      entityId: 'candidate-1',
      createPath: '/create/election-candidate',
      target: {
        to: '/event/$id/agenda/$agendaItemId',
        params: { id: 'event-member', agendaItemId: 'agenda-member' },
      },
    });
    expect(outcome).toMatchObject({
      status: 'success',
      target: {
        to: '/event/$id/agenda/$agendaItemId',
        params: { id: 'event-member', agendaItemId: 'agenda-member' },
      },
    });
  });

  it('blocks submission until an eligible election is selected', async () => {
    const { result } = renderHook(() => useCreateElectionCandidateForm());
    await expect(result.current.onSubmit?.()).resolves.toEqual({ status: 'blocked' });
    expect(addCandidate).not.toHaveBeenCalled();
  });

  it('restores candidate fields and falls back to the create route without an agenda item id', async () => {
    electionsForSearch = [
      {
        id: 'election-fallback',
        title: '',
        agenda_item: { event: { id: 'event-member', group_id: 'group-1' } },
      },
    ];
    setCreateRestoreDraft({
      id: 'election:restored',
      entityType: 'election',
      entityId: 'restored',
      createPath: '/create/election-candidate',
      formState: {
        electionId: 'election-fallback',
        statement: 'Restored statement',
        imageURL: 'https://example.com/candidate.jpg',
      },
      mutationPayload: {},
      target: null,
      submittedAt: Date.now(),
      status: 'failed',
    } as any);

    const { result } = renderHook(() => useCreateElectionCandidateForm());
    await waitFor(() => expect(result.current.steps[0].isValid()).toBe(true));
    const review = result.current.steps[2].fields?.[0];
    expect(review?.kind).toBe('customComponent');
    expect((review as any).props).toMatchObject({ subtitle: 'Restored statement' });

    const outcome = await result.current.onSubmit?.();
    expect(outcome).toMatchObject({ status: 'success', target: { to: '/create' } });
  });

  it('ignores restore drafts for other election create paths', () => {
    setCreateRestoreDraft({
      id: 'election:wrong',
      entityType: 'election',
      entityId: 'wrong',
      createPath: '/create/election',
      formState: { electionId: 'election-member' },
      mutationPayload: {},
      target: null,
      submittedAt: Date.now(),
      status: 'failed',
    } as any);
    const { result } = renderHook(() => useCreateElectionCandidateForm());
    expect(result.current.steps[0].isValid()).toBe(false);
  });

  it('defaults missing fields in a matching restore draft', async () => {
    setCreateRestoreDraft({
      id: 'election:empty-restore',
      entityType: 'election',
      entityId: 'empty-restore',
      createPath: '/create/election-candidate',
      formState: {},
      mutationPayload: {},
      target: null,
      submittedAt: Date.now(),
      status: 'failed',
    } as any);
    const { result } = renderHook(() => useCreateElectionCandidateForm());
    await waitFor(() => expect(result.current.steps[0].isValid()).toBe(false));
    const statement = findField(result.current.steps[1].fields ?? [], 'statement', 'text');
    expect(statement.value).toBe('');
  });
});
