/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateEventForm } from '../useCreateEventForm';
import type { CreateFormFieldDescriptor } from '../../types/create-form.types';

const navigate = vi.fn();
const createEvent = vi.fn();
let searchParams: Record<string, string | undefined> = {};
let creatableGroupIds = new Set<string>();
let groupPermissionLoading = false;

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => searchParams,
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: () => [[], { type: 'complete' }],
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-current' },
  }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) =>
    (
      ({
        'generated.inline.0030_public_61c9b2b1': 'public',
        'generated.inline.0031_authenticated_8fda38ce': 'authenticated',
        'generated.inline.0032_ratio_4b6339ba': 'ratio',
        'generated.inline.0034_list_38b62be4': 'list',
        'generated.inline.0035_online_2dbc2fd2': 'online',
        'generated.inline.0036_hybrid_e2ac482d': 'hybrid',
      }) as Record<string, string>
    )[key] ?? key,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../ui/inputs/CreateRichTextField', () => ({
  CreateRichTextField: () => null,
}));

vi.mock('@/features/file-upload/ui/ImageUpload.tsx', () => ({
  ImageUpload: () => null,
}));

vi.mock('@/zero/events/useEventActions', () => ({
  useEventActions: () => ({ createEvent }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({
    allHashtags: [],
    userHashtags: [],
  }),
  useCommonActions: () => ({
    syncEntityHashtags: vi.fn(),
  }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupById: (id?: string) => ({
    group: id
      ? {
          id,
          name: id === 'group-allowed' ? 'Allowed Group' : 'Denied Group',
          group_type: 'base',
          has_hierarchy_children: false,
        }
      : undefined,
  }),
}));

vi.mock('@/zero/rbac', () => ({
  useCreatableGroupIds: () => ({
    creatableGroupIds,
    isLoading: groupPermissionLoading,
  }),
}));

vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    completeProcessTaskWithEvent: vi.fn(),
  }),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    amendments: {
      openProcessTasksByGroup: (args: unknown) => ({ __query: 'openProcessTasksByGroup', args }),
    },
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: vi.fn(async (value: unknown) => value),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: () => [],
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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

function fillTitle(result: { current: ReturnType<typeof useCreateEventForm> }) {
  const titleField = findField(result.current.steps[0].fields ?? [], 'title', 'text');
  act(() => {
    titleField.onValueChange('Open planning session');
  });
}

function fillDateTime(result: { current: ReturnType<typeof useCreateEventForm> }) {
  const timeSeriesStep = result.current.steps.find(
    step => step.label === 'pages.create.event.timeSeries.tabLabel'
  );
  const timeSeriesField = findField(timeSeriesStep?.fields ?? [], 'time-series', 'customComponent');
  const props = timeSeriesField.props as {
    onDateTimeChange: (field: string, value: string) => void;
  };

  act(() => {
    props.onDateTimeChange('startDate', '2026-07-01');
    props.onDateTimeChange('startTime', '10:00');
    props.onDateTimeChange('endDate', '2026-07-01');
    props.onDateTimeChange('endTime', '11:00');
  });
}

describe('useCreateEventForm', () => {
  beforeEach(() => {
    searchParams = {};
    creatableGroupIds = new Set();
    groupPermissionLoading = false;
    navigate.mockClear();
    createEvent.mockReset();
    vi.stubGlobal('crypto', { randomUUID: () => 'event-1' });
  });

  it('shows the date/time requirement for an open event without a group', () => {
    const { result } = renderHook(() => useCreateEventForm());
    fillTitle(result);

    const timeSeriesStep = result.current.steps.find(
      step => step.label === 'pages.create.event.timeSeries.tabLabel'
    );

    expect(timeSeriesStep?.isValid()).toBe(false);
    expect(timeSeriesStep?.getInvalidReason?.()).toBe(
      'pages.create.event.timeSeries.validation.dateTimeRangeRequired'
    );

    fillDateTime(result);

    expect(result.current.steps.at(-1)?.isValid()).toBe(true);
  });

  it('requires an associated group for assemblies', () => {
    const { result } = renderHook(() => useCreateEventForm());
    const eventTypeField = findField(
      result.current.steps[1].fields ?? [],
      'event-type',
      'customComponent'
    );

    act(() => {
      (eventTypeField.props as { onChange: (value: string) => void }).onChange('general_assembly');
    });

    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );

    expect(groupStep?.isValid()).toBe(false);
    expect(groupStep?.getInvalidReason?.()).toBe(
      'pages.create.event.validation.groupRequiredForAssembly'
    );
  });

  it('blocks an unauthorized prefilled group before submit', () => {
    searchParams = { groupId: 'group-denied' };

    const { result } = renderHook(() => useCreateEventForm());
    const groupStep = result.current.steps.find(
      step => step.label === 'pages.create.event.associatedGroup'
    );

    expect(groupStep?.isValid()).toBe(false);
    expect(groupStep?.getInvalidReason?.()).toBe(
      'pages.create.event.validation.groupPermissionDenied'
    );
  });
});
