/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'user-1' } as { id: string } | undefined,
  groups: [
    { id: 'group-1', name: 'Group One' },
    { id: 'group-2', name: 'Group Two' },
    null,
    { id: '', name: 'Invalid' },
  ] as any[],
  users: [
    {
      id: 'invite-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      handle: 'ada',
      email: 'ada@example.test',
    },
    { id: 'invite-2', first_name: '', last_name: '', handle: 'grace', email: null },
    { id: 'invite-3', first_name: '', last_name: '', handle: '', email: 'mail@example.test' },
    { id: 'invite-4', first_name: '', last_name: '', handle: '', email: '' },
  ] as any[],
  roles: [
    { id: 'role-1', scope: 'group', assignee_kind: 'member' },
    { id: 'guest-role', scope: 'group', assignee_kind: 'guest' },
    { id: 'event-role', scope: 'event', assignee_kind: 'member' },
  ] as any[],
  restore: null as any,
  configured: false,
  incomplete: false,
  preflight: { isLoading: false, blocking: false, response: { summary: null } } as any,
  csvText: 'csv',
  csvResult: {
    missingColumns: false,
    matchedUsers: [],
    notFoundNames: [],
    ambiguousNames: [],
    invalidRows: [],
  } as any,
  canonicalMembership: true,
  createResult: { mutate: Promise.resolve() } as any,
  createFullGroup: vi.fn(),
  waitForOptimisticCreate: vi.fn(),
  trackCreateFinalization: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

const defaultDirections = () => ({
  informationRight: 'none',
  amendmentRight: 'none',
  rightToSpeak: 'none',
  activeVotingRight: 'none',
  passiveVotingRight: 'none',
});

const defaultRule = () => ({ membershipMode: 'none', roleId: '', sourceGroupIds: [] as string[] });

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'pages.create.group.foundingAssemblyDefaultName'
        ? `Founding assembly: ${options?.groupName}`
        : key === 'pages.create.group.foundingAssemblyDefaultNameFallback'
          ? 'Founding assembly'
          : `${key}${options ? `:${JSON.stringify(options)}` : ''}`,
  }),
  translate: (key: string) =>
    key === 'generated.inline.0030_public_61c9b2b1'
      ? 'public'
      : key === 'generated.inline.0031_authenticated_8fda38ce'
        ? 'authenticated'
        : key,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ createFullGroup: mocks.createFullGroup }),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAllGroups: () => ({ groups: mocks.groups }),
  useGroupRoles: () => ({ roles: mocks.roles }),
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ allUsers: mocks.users }),
}));

vi.mock('@/zero/common', () => ({
  useCommonState: () => ({ userHashtags: [{ hashtag: { tag: 'civic' } }] }),
}));

vi.mock('@/zero/common/hashtagHelpers', () => ({
  extractHashtagTags: () => ['civic'],
}));

vi.mock('@/features/create/logic/groupInviteCsv', () => ({
  matchInviteCsvUsers: () => mocks.csvResult,
}));

vi.mock('@/features/shared/logic/richText', () => ({
  EMPTY_RICH_TEXT_VALUE: [{ type: 'p', children: [{ text: '' }] }],
  richTextToPlainText: () => 'Rich description',
  toZeroRichTextValue: (value: unknown) => ({ zero: value }),
}));

vi.mock('@/features/shared/logic/geoLocationShape', () => ({
  geoLocationFieldsFromShape: (shape: any) => ({
    location_kind: shape?.kind ?? null,
    location_place_id: shape?.id ?? null,
    location_boundary_source: shape?.source ?? null,
    location_geometry: shape?.geometry ?? null,
    location_bounds: shape?.bounds ?? null,
  }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: mocks.toastError,
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
  },
}));

vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  getSiblingMembershipKind: (value: string) => (value === 'none' ? null : value),
}));

vi.mock('@/features/network/logic/groupConnectionComposer', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createEmptyMembershipRule: () => defaultRule(),
  buildGroupConnectionComposerDefaults: () => ({
    selectedGroupId: '',
    relationshipType: 'child',
    membershipDirection: null,
    membershipRule: defaultRule(),
    rightDirections: defaultDirections(),
    preset: 'child',
  }),
  applyGroupConnectionPreset: (preset: string, value: any) => ({ ...value, preset }),
  hasConfiguredGroupConnection: () => mocks.configured,
  hasIncompleteMembershipRule: () => mocks.incomplete,
  buildCanonicalGroupConnectionPayload: (input: any) => ({
    id: 'proposed-connection',
    group_a_id: input.currentGroupId,
    group_b_id: input.otherGroupId,
    connection_type: input.relationshipType,
    parent_group_id: input.currentGroupId,
    child_group_id: input.otherGroupId,
    grants: [
      {
        right_key: 'informationRight',
        holder_group_id: input.currentGroupId,
        scope_group_id: input.otherGroupId,
      },
    ],
    membership_rule: mocks.canonicalMembership
      ? { membership_mode: input.membershipRule.membershipMode }
      : null,
  }),
}));

vi.mock('@/features/network/hooks/useGroupConnectionComposerPreflight', () => ({
  useGroupConnectionComposerPreflight: () => mocks.preflight,
}));

vi.mock('@/features/create/logic/createSubmitTargets', () => ({
  createBlockedSubmitOutcome: () => ({ status: 'blocked' }),
  createRouteSubmitTarget: (_entity: string, target: unknown) => target,
  createSuccessSubmitOutcome: (target: unknown) => ({ status: 'success', target }),
}));

vi.mock('@/features/create/logic/createFinalization', () => ({
  consumeCreateRestoreDraft: () => mocks.restore,
  waitForOptimisticCreate: (...args: unknown[]) => mocks.waitForOptimisticCreate(...args),
  trackCreateFinalization: (...args: unknown[]) => mocks.trackCreateFinalization(...args),
}));

vi.mock('@/features/shared/logic/localDateTime', () => ({
  toLocalTimestamp: (date: string, time: string) => (date || time ? `${date}T${time}` : null),
}));

import { useCreateGroupForm } from '../useCreateGroupForm';

function findField(config: any, key: string) {
  for (const step of config.steps) {
    const field = step.fields.find((candidate: any) => candidate.key === key);
    if (field) return field;
  }
  throw new Error(`Missing field ${key}`);
}

function linkValue(overrides: Record<string, unknown> = {}) {
  return {
    selectedGroupId: 'group-1',
    relationshipType: 'child',
    membershipDirection: null,
    membershipRule: defaultRule(),
    rightDirections: { ...defaultDirections(), informationRight: 'outgoing' },
    preset: 'child',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authUser = { id: 'user-1' };
  mocks.roles = [
    { id: 'role-1', scope: 'group', assignee_kind: 'member' },
    { id: 'guest-role', scope: 'group', assignee_kind: 'guest' },
    { id: 'event-role', scope: 'event', assignee_kind: 'member' },
  ];
  mocks.restore = null;
  mocks.configured = false;
  mocks.incomplete = false;
  mocks.preflight = { isLoading: false, blocking: false, response: { summary: null } };
  mocks.csvText = 'csv';
  mocks.csvResult = {
    missingColumns: false,
    matchedUsers: [],
    notFoundNames: [],
    ambiguousNames: [],
    invalidRows: [],
  };
  mocks.canonicalMembership = true;
  mocks.createResult = { mutate: Promise.resolve() };
  mocks.createFullGroup.mockReturnValue(mocks.createResult);
  mocks.waitForOptimisticCreate.mockResolvedValue(undefined);

  class FakeFileReader {
    onload: ((event: any) => void) | null = null;
    readAsText() {
      this.onload?.({ target: { result: mocks.csvText } });
    }
  }
  vi.stubGlobal('FileReader', FakeFileReader);
});

describe('useCreateGroupForm state and validation', () => {
  it('validates basic data and updates every simple field family', () => {
    const { result } = renderHook(() => useCreateGroupForm());
    expect(result.current.entityType).toBe('group');
    expect(result.current.steps[0].isValid()).toBe(false);
    expect(result.current.steps[0].getInvalidReason?.()).toBe(
      'pages.create.group.validation.nameRequired'
    );
    result.current.steps.forEach(step => expect(step.isValid()).toBeTypeOf('boolean'));
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBe(
      'pages.create.group.validation.nameRequired'
    );

    act(() => findField(result.current, 'name').onValueChange('  Civic Group  '));
    act(() => findField(result.current, 'email').onValueChange('invalid'));
    expect(result.current.steps[0].getInvalidReason?.()).toBe('common.validation.emailHint');
    expect(findField(result.current, 'email').validator('bad')).toBe('common.validation.emailHint');
    expect(findField(result.current, 'email').validator('person@example.test')).toBeNull();
    act(() => findField(result.current, 'email').onValueChange('person@example.test'));
    expect(result.current.steps[0].isValid()).toBe(true);
    result.current.steps.forEach(step => expect(step.isValid()).toBe(true));
    expect(result.current.steps.at(-1)?.getInvalidReason?.()).toBeNull();

    act(() =>
      findField(result.current, 'description').props.onChange([
        { type: 'p', children: [{ text: 'Rich' }] },
      ])
    );
    expect(findField(result.current, 'description').props.value).toBeTruthy();

    act(() => findField(result.current, 'group-type').props.onChange('sibling'));
    expect(findField(result.current, 'group-type').props.value).toBe('hierarchical');
    act(() => findField(result.current, 'group-type').props.onChange('hierarchical'));
    expect(findField(result.current, 'invite-people').props.searchLabel).toContain('searchGuests');
    act(() => findField(result.current, 'group-type').props.onChange('base'));

    const location = () => findField(result.current, 'location').props;
    for (const [field, value] of [
      ['country', 'DE'],
      ['region', 'HE'],
      ['city', 'Darmstadt'],
      ['post_code', '64283'],
      ['street', 'Main Street'],
      ['house_number', '1'],
      ['ignored', 'value'],
    ]) {
      act(() => location().onFieldChange(field, value));
    }
    act(() => location().onCoordinatesChange({ latitude: 49.87, longitude: 8.65 }));
    expect(location().values).toMatchObject({
      latitude: 49.87,
      longitude: 8.65,
      city: 'Darmstadt',
    });
    act(() => location().onCoordinatesChange(null));
    expect(location().values.latitude).toBeNull();
    act(() => location().onShapeChange({ kind: 'place', id: 'place-1' }));

    const media = () => findField(result.current, 'image-tags').props;
    act(() => {
      media().onImageChange('image.png');
      media().onVideoChange('video.mp4');
      media().onHashtagsChange(['civic']);
      media().onVisibilityChange('authenticated');
    });
    expect(media()).toMatchObject({
      imageURL: 'image.png',
      videoURL: 'video.mp4',
      hashtags: ['civic'],
      visibility: 'authenticated',
    });

    act(() => findField(result.current, 'constitutional-toggle').props.onCheckedChange(true));
    expect(findField(result.current, 'event-name').value).toContain('Civic Group');
    act(() => {
      findField(result.current, 'event-name').onValueChange('Existing event');
      findField(result.current, 'event-location').onValueChange('Town hall');
    });
    const eventTime = () => findField(result.current, 'event-time').props;
    act(() => {
      eventTime().onChange('startDate', '');
      eventTime().onChange('startTime', '18:00');
    });
    expect(findField(result.current, 'review').props.sections.at(-1).fields.at(-1).value).toBe(
      '18:00'
    );
    act(() => {
      eventTime().onChange('startDate', '2026-09-01');
      eventTime().onChange('startTime', '');
    });
    expect(findField(result.current, 'review').props.sections.at(-1).fields.at(-1).value).toBe(
      '2026-09-01'
    );
    act(() => {
      eventTime().onChange('startDate', '2026-09-01');
      eventTime().onChange('startTime', '18:00');
      eventTime().onChange('ignored', 'x');
    });
    expect(eventTime()).toMatchObject({ startDate: '2026-09-01', startTime: '18:00' });
    act(() => findField(result.current, 'constitutional-toggle').props.onCheckedChange(false));
    act(() => findField(result.current, 'constitutional-toggle').props.onCheckedChange(true));
    expect(findField(result.current, 'event-name').value).toBe('Existing event');

    const review = findField(result.current, 'review').props;
    expect(review.subtitle).toBe('Rich description');
    expect(review.hashtags).toEqual(['civic']);
    expect(review.sections.flatMap((section: any) => section.fields).length).toBeGreaterThan(4);
  });

  it('restores complete and sparse drafts through explicit defaults', () => {
    mocks.restore = {
      formState: {
        groupType: 'sibling',
        name: 'Restored',
        description: 'Description',
        descriptionContent: [{ type: 'p', children: [{ text: 'Description' }] }],
        email: 'restored@example.test',
        country: 'DE',
        region: 'HE',
        post_code: '64283',
        city: 'Darmstadt',
        street: 'Street',
        house_number: '2',
        latitude: 1,
        longitude: 2,
        locationShape: { kind: 'place' },
        imageURL: 'image',
        videoURL: 'video',
        hashtags: ['restored'],
        visibility: 'private',
        invitedUserIds: ['invite-1', 'missing-user'],
        linkedGroups: [
          {
            groupId: 'group-1',
            groupName: 'Group One',
            type: 'sibling',
            membershipDirection: null,
            membershipRule: {
              membershipMode: 'selected_source_groups',
              roleId: '',
              sourceGroupIds: ['source-1'],
            },
            membershipMode: 'selected_source_groups',
            roleId: 'role-1',
            sourceGroupIds: [],
            rightDirections: { ...defaultDirections(), informationRight: 'outgoing' },
          },
          {
            groupId: 'group-2',
            groupName: 'Group Two',
            type: 'sibling',
            membershipDirection: null,
            membershipRule: { membershipMode: 'none', roleId: '', sourceGroupIds: [] },
            membershipMode: 'none',
            roleId: '',
            sourceGroupIds: [],
            rightDirections: defaultDirections(),
          },
        ],
        createConstitutionalEvent: true,
        eventName: 'Restored event',
        eventLocation: 'Hall',
        eventStartDate: '2026-09-01',
        eventStartTime: '18:00',
      },
    };
    const full = renderHook(() => useCreateGroupForm());
    expect(findField(full.result.current, 'name').value).toBe('Restored');
    expect(findField(full.result.current, 'review').props.title).toBe('Restored');
    expect(findField(full.result.current, 'review').props.linkedGroupReviewData).toHaveLength(2);
    full.unmount();

    mocks.restore = { formState: {} };
    const sparse = renderHook(() => useCreateGroupForm());
    expect(findField(sparse.result.current, 'name').value).toBe('');
    expect(findField(sparse.result.current, 'image-tags').props.hashtags).toEqual([]);
    expect(findField(sparse.result.current, 'constitutional-toggle').props.checked).toBe(false);
  });
});

describe('useCreateGroupForm CSV invites', () => {
  it('guards missing files, empty reads, malformed and empty CSVs, then reports mixed matches', () => {
    const { result, rerender } = renderHook(() => useCreateGroupForm());
    const upload = () => findField(result.current, 'invite-people').props.onCsvUpload;

    upload()({ target: { files: null, value: 'same' } });
    mocks.csvText = '';
    upload()({ target: { files: [new File([''], 'empty.csv')], value: 'same' } });
    expect(mocks.toastError).not.toHaveBeenCalled();

    mocks.csvText = 'headers';
    mocks.csvResult = { ...mocks.csvResult, missingColumns: true };
    upload()({ target: { files: [new File(['x'], 'bad.csv')], value: 'same' } });
    expect(mocks.toastError).toHaveBeenLastCalledWith('pages.create.group.csvMissingColumns');

    mocks.csvResult = {
      missingColumns: false,
      matchedUsers: [],
      notFoundNames: [],
      ambiguousNames: [],
      invalidRows: [],
    };
    upload()({ target: { files: [new File(['x'], 'empty.csv')], value: 'same' } });
    expect(mocks.toastError).toHaveBeenLastCalledWith('pages.create.group.csvEmpty');

    mocks.csvResult = {
      missingColumns: false,
      matchedUsers: [
        { id: 'invite-1', name: 'Ada Lovelace' },
        { id: 'invite-2', name: 'Grace' },
      ],
      notFoundNames: ['Missing'],
      ambiguousNames: [
        {
          name: 'Alex',
          candidates: [
            { id: 'one', name: 'Alex One' },
            { id: 'two', name: 'Alex Two' },
          ],
        },
      ],
      invalidRows: [{ row: 4 }],
    };
    const event = { target: { files: [new File(['x'], 'mixed.csv')], value: 'same' } };
    upload()(event);
    rerender();
    expect(event.target.value).toBe('');
    expect(mocks.toastSuccess).toHaveBeenCalled();
    expect(mocks.toastInfo).toHaveBeenCalled();
    expect(findField(result.current, 'invite-people').props.invitedUserIds).toEqual([
      'invite-1',
      'invite-2',
    ]);
    expect(
      findField(result.current, 'invite-people').props.csvInviteSummary.ambiguousNames[0]
    ).toHaveProperty('candidatesLabel');

    mocks.csvResult = {
      missingColumns: false,
      matchedUsers: [],
      notFoundNames: ['Only missing'],
      ambiguousNames: [],
      invalidRows: [],
    };
    upload()({ target: { files: [new File(['x'], 'missing.csv')], value: 'same' } });

    mocks.csvResult = {
      missingColumns: false,
      matchedUsers: [{ id: 'invite-1', name: 'Ada Lovelace' }],
      notFoundNames: [],
      ambiguousNames: [],
      invalidRows: [],
    };
    upload()({ target: { files: [new File(['x'], 'matched.csv')], value: 'same' } });
    expect(findField(result.current, 'invite-people').props.invitedUserIds).toEqual([
      'invite-1',
      'invite-2',
    ]);
  });
});

describe('useCreateGroupForm connection composer', () => {
  it('handles invalid, blocked, incomplete, new, existing, reset, and remove flows', () => {
    const { result, rerender } = renderHook(() => useCreateGroupForm());
    const connections = () => findField(result.current, 'link-groups').props;

    act(() => connections().onAdd());
    expect(mocks.toastError).toHaveBeenCalled();

    act(() =>
      connections().onValueChange({
        ...linkValue(),
        membershipRule: null,
      })
    );
    rerender();
    expect(connections().value.membershipRule).toEqual({ roleId: '' });

    mocks.configured = true;
    act(() => connections().onValueChange(linkValue()));
    mocks.preflight = { isLoading: false, blocking: true, response: { summary: 'Conflict' } };
    rerender();
    act(() => connections().onAdd());
    expect(mocks.toastError).toHaveBeenLastCalledWith('Conflict');
    mocks.preflight = { isLoading: false, blocking: true, response: { summary: null } };
    rerender();
    act(() => connections().onAdd());
    expect(mocks.toastError).toHaveBeenLastCalledWith('pages.create.group.linkConflictBlocked');

    mocks.preflight = { isLoading: false, blocking: false, response: { summary: null } };
    mocks.incomplete = true;
    rerender();
    act(() => connections().onAdd());
    expect(mocks.toastError).toHaveBeenCalled();

    mocks.incomplete = false;
    rerender();
    act(() => connections().onAdd());
    expect(connections().linkedGroups).toHaveLength(1);
    expect(connections().value.selectedGroupId).toBe('');

    act(() => connections().onValueChange(linkValue({ selectedGroupId: 'group-2' })));
    act(() => connections().onAdd());
    expect(connections().linkedGroups).toHaveLength(2);

    act(() => connections().onValueChange(linkValue({ selectedGroupId: 'missing-group' })));
    act(() => connections().onAdd());
    expect(connections().linkedGroups.at(-1).groupName).toBe('missing-group');

    act(() =>
      connections().onValueChange(
        linkValue({
          selectedGroupId: 'group-1',
          relationshipType: 'sibling',
          membershipRule: { membershipMode: 'role_members', roleId: 'role-1', sourceGroupIds: [] },
        })
      )
    );
    rerender();
    expect(connections().existingRightStatuses?.get('informationRight')).toBe('outgoing');
    act(() => connections().onAdd());
    expect(mocks.toastInfo).toHaveBeenCalledWith('pages.create.group.groupAlreadyLinked');
    expect(connections().linkedGroups.find((group: any) => group.groupId === 'group-1').type).toBe(
      'sibling'
    );

    act(() => connections().onRemove('group-2'));
    expect(connections().linkedGroups.some((group: any) => group.groupId === 'group-2')).toBe(
      false
    );
    act(() => connections().onValueChange(linkValue()));
    act(() => connections().onActiveTabChange('custom'));
    act(() => connections().onCancel());
    expect(connections().value.selectedGroupId).toBe('');
    expect(connections().activeTab).toBe('preset');

    mocks.preflight = { isLoading: true, blocking: false, response: { summary: null } };
    rerender();
    expect(connections().addDisabled).toBe(true);
    expect(connections().selectableRolesByDirection.partner_members_to_current).toHaveLength(1);
    expect(connections().selectableRolesByDirection.current_members_to_partner).toHaveLength(1);

    mocks.roles = null as any;
    rerender();
    expect(connections().selectableRolesByDirection.partner_members_to_current).toEqual([]);
  });
});

describe('useCreateGroupForm submission', () => {
  it('blocks missing and invalid basics before entering the mutation path', async () => {
    const { result } = renderHook(() => useCreateGroupForm());
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    act(() => {
      findField(result.current, 'name').onValueChange('Group');
      findField(result.current, 'email').onValueChange('bad');
    });
    await expect(result.current.onSubmit()).resolves.toEqual({ status: 'blocked' });
    expect(mocks.toastError).toHaveBeenCalledWith('common.validation.emailHint');
    expect(mocks.createFullGroup).not.toHaveBeenCalled();
  });

  it('submits a full group, reports progress, and exposes a retry finalizer', async () => {
    mocks.configured = true;
    const { result } = renderHook(() => useCreateGroupForm());
    act(() => {
      findField(result.current, 'name').onValueChange('  Full Group  ');
      findField(result.current, 'email').onValueChange('group@example.test');
      findField(result.current, 'description').props.onChange([
        { type: 'p', children: [{ text: 'D' }] },
      ]);
      findField(result.current, 'invite-people').props.onInvitedUserIdsChange([
        'invite-1',
        'invite-2',
        'invite-3',
        'invite-4',
        'missing-user',
      ]);
      findField(result.current, 'image-tags').props.onImageChange('image.png');
      findField(result.current, 'image-tags').props.onVideoChange('video.mp4');
      findField(result.current, 'image-tags').props.onHashtagsChange(['civic']);
      findField(result.current, 'constitutional-toggle').props.onCheckedChange(true);
    });
    act(() => {
      findField(result.current, 'event-location').onValueChange('Town hall');
      findField(result.current, 'event-time').props.onChange('startDate', '2026-09-01');
      findField(result.current, 'event-time').props.onChange('startTime', '18:00');
      findField(result.current, 'link-groups').props.onValueChange(linkValue());
    });
    act(() => findField(result.current, 'link-groups').props.onAdd());

    const reportProgress = vi.fn();
    const setRecoveryTarget = vi.fn();
    const outcome = await act(async () =>
      result.current.onSubmit({ reportProgress, setRecoveryTarget })
    );
    expect(outcome).toMatchObject({ status: 'success' });
    expect(mocks.createFullGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ name: 'Full Group', email: 'group@example.test' }),
        official_invite_user_ids: ['invite-1', 'invite-2', 'invite-3', 'invite-4', 'missing-user'],
        guest_invite_user_ids: [],
        connection_requests: [expect.objectContaining({ membership_rule: expect.any(Object) })],
        founding_event: expect.objectContaining({ location_name: 'Town hall' }),
      }),
      { notificationMode: 'silent' }
    );
    expect(reportProgress).toHaveBeenCalledWith({ key: 'ready', status: 'active' });
    expect(setRecoveryTarget).toHaveBeenCalled();
    expect(mocks.trackCreateFinalization).toHaveBeenCalledOnce();

    const tracked = mocks.trackCreateFinalization.mock.calls[0][0];
    tracked.retry();
    expect(mocks.createFullGroup).toHaveBeenCalledTimes(2);
    expect(mocks.trackCreateFinalization).toHaveBeenCalledTimes(2);
  });

  it('submits minimal guest-invite payloads without a user or context', async () => {
    mocks.authUser = undefined;
    mocks.canonicalMembership = false;
    mocks.configured = true;
    const { result } = renderHook(() => useCreateGroupForm());
    act(() => {
      findField(result.current, 'name').onValueChange('Minimal');
      findField(result.current, 'group-type').props.onChange('hierarchical');
      findField(result.current, 'invite-people').props.onInvitedUserIdsChange(['invite-1']);
      findField(result.current, 'constitutional-toggle').props.onCheckedChange(true);
      findField(result.current, 'link-groups').props.onValueChange(linkValue());
    });
    act(() => findField(result.current, 'link-groups').props.onAdd());
    await act(async () => result.current.onSubmit());
    expect(mocks.createFullGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({
          description: null,
          email: null,
          country: null,
          image_url: null,
          video_url: null,
        }),
        official_invite_user_ids: [],
        guest_invite_user_ids: ['invite-1'],
        founding_event: null,
        connection_requests: [expect.objectContaining({ membership_rule: null })],
      }),
      { notificationMode: 'silent' }
    );
  });

  it('resets submitting state and rethrows optimistic failures', async () => {
    const { result } = renderHook(() => useCreateGroupForm());
    act(() => {
      findField(result.current, 'name').onValueChange('Failure');
      findField(result.current, 'constitutional-toggle').props.onCheckedChange(true);
    });
    mocks.waitForOptimisticCreate.mockRejectedValueOnce(new Error('sync failed'));
    await expect(result.current.onSubmit()).rejects.toThrow('sync failed');
    expect(result.current.isSubmitting).toBe(false);
  });
});
