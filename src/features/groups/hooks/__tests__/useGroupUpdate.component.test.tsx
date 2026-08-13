/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createGroup: vi.fn(() => ({ kind: 'create' })),
  updateGroup: vi.fn(() => ({ kind: 'update' })),
  propose: vi.fn((..._args: any[]) => ({ kind: 'propose' })),
  removeConnection: vi.fn(() => ({ kind: 'remove' })),
  syncHashtags: vi.fn(async () => undefined),
  updateConversation: vi.fn(() => ({ kind: 'conversation' })),
  waitForClientApply: vi.fn(async (value: unknown) => value),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  groupConversation: null as null | { id: string },
  groupConnections: [] as Record<string, any>[],
  groupConnectionRequests: [] as Record<string, any>[],
  groupHashtags: [] as Record<string, any>[] | null,
  allHashtags: [] as Record<string, any>[] | null,
  uuid: 0,
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ createGroup: mocks.createGroup, updateGroup: mocks.updateGroup }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: mocks.syncHashtags }),
  useCommonState: () => ({
    groupHashtags: mocks.groupHashtags,
    allHashtags: mocks.allHashtags,
  }),
}));
vi.mock('@/zero/messages/useMessageActions', () => ({
  useMessageActions: () => ({ updateConversation: mocks.updateConversation }),
}));
vi.mock('@/zero/messages/useMessageState', () => ({
  useMessageState: () => ({ groupConversation: mocks.groupConversation }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionActions: () => ({
    proposeGroupConnectionChange: mocks.propose,
    deleteGroupConnection: mocks.removeConnection,
  }),
  useGroupConnectionState: () => ({
    groupConnections: mocks.groupConnections,
    groupConnectionRequests: mocks.groupConnectionRequests,
  }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/logic/richText', () => ({
  EMPTY_RICH_TEXT_VALUE: [],
  toRichTextValue: (value: unknown) =>
    Array.isArray(value) ? value : [{ type: 'p', children: [{ text: String(value) }] }],
  richTextToPlainText: (value: any[]) => String(value?.[0]?.children?.[0]?.text ?? ''),
  toZeroRichTextValue: (value: unknown) => ({ zero: value }),
}));
vi.mock('@/features/shared/ui/status', () => ({
  RIGHT_TYPES: [
    'informationRight',
    'amendmentRight',
    'rightToSpeak',
    'activeVotingRight',
    'passiveVotingRight',
  ],
}));
vi.mock('@/features/network/logic/groupConnectionComposer', () => ({
  canonicalGroupPair: (left: string, right: string) =>
    left < right
      ? { group_a_id: left, group_b_id: right }
      : { group_a_id: right, group_b_id: left },
  getExpandedRightDirections: (direction: string) =>
    direction === 'none' ? [] : direction === 'mutual' ? ['incoming', 'outgoing'] : [direction],
  getGrantEndpointsForRightDirection: (direction: string, current: string, partner: string) =>
    direction === 'incoming'
      ? { holder_group_id: current, scope_group_id: partner }
      : { holder_group_id: partner, scope_group_id: current },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import {
  buildGroupFormData,
  buildGroupMutationFields,
  type GroupFormData,
  useGroupUpdate,
} from '../useGroupUpdate';

const directions: GroupFormData['connectedRelationshipDirections'] = {
  informationRight: 'incoming',
  amendmentRight: 'outgoing',
  rightToSpeak: 'mutual',
  activeVotingRight: 'none',
  passiveVotingRight: 'incoming',
} as any;

function completeFormData(): GroupFormData {
  return {
    name: 'Complete',
    description: 'Description',
    descriptionContent: [{ type: 'p', children: [{ text: 'Description' }] }] as never,
    email: 'mail@example.test',
    country: 'DE',
    region: 'BW',
    post_code: '79098',
    city: 'Freiburg',
    street: 'Street',
    house_number: '1',
    latitude: 48,
    longitude: 8,
    location_kind: 'place',
    location_place_id: 'place-1',
    location_boundary_source: 'osm',
    location_geometry: { type: 'Point' },
    location_bounds: [1, 2, 3, 4],
    imageURL: 'image',
    videoURL: 'video',
    visibility: 'private',
    website: 'website',
    youtube: 'youtube',
    linkedin: 'linkedin',
    whatsapp: 'whatsapp',
    instagram: 'instagram',
    twitter: 'twitter',
    facebook: 'facebook',
    snapchat: 'snapchat',
    tiktok: 'tiktok',
    hashtags: ['complete'],
    connected_group_id: 'partner',
    siblingMembershipDirection: 'current_members_to_partner',
    sibling_membership_mode: 'role_members',
    sibling_role_id: 'role-1',
    parliament_source_group_ids: ['origin-1'],
    connectedRelationshipDirections: directions,
  };
}

function peerConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connection-1',
    connection_type: 'peer',
    group_a_id: 'group-1',
    group_b_id: 'partner',
    grants: [],
    membership_rule: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.groupConversation = null;
  mocks.groupConnections = [];
  mocks.groupConnectionRequests = [];
  mocks.groupHashtags = [];
  mocks.allHashtags = [];
  mocks.uuid = 0;
  vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++mocks.uuid}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

describe('useGroupUpdate normalization', () => {
  it('normalizes empty, description-only, and complete form inputs', () => {
    expect(buildGroupFormData()).toMatchObject({
      name: '',
      description: '',
      email: '',
      latitude: null,
      visibility: 'public',
      hashtags: [],
      connected_group_id: null,
    });
    expect(buildGroupFormData({ description: 'Fallback description' }).description).toBe(
      'Fallback description'
    );
    expect(buildGroupFormData({}, ['fallback']).hashtags).toEqual(['fallback']);

    const complete = completeFormData();
    expect(buildGroupFormData(complete, ['ignored'])).toEqual(complete);
  });

  it('builds complete and null-normalized mutation payloads for both modes', () => {
    expect(buildGroupMutationFields(buildGroupFormData(), true)).toMatchObject({
      name: '',
      description: null,
      email: null,
      image_url: null,
      x: null,
      twitter: null,
      visibility: 'public',
    });
    expect(buildGroupMutationFields(buildGroupFormData(), false).x).toBe('');

    const complete = completeFormData();
    expect(buildGroupMutationFields(complete, true)).toMatchObject({
      name: 'Complete',
      description: { zero: complete.descriptionContent },
      email: 'mail@example.test',
      x: 'twitter',
      twitter: 'twitter',
      image_url: 'image',
      visibility: 'private',
    });
    expect(buildGroupMutationFields(complete, false).x).toBe('twitter');
  });
});

describe('useGroupUpdate state and submission', () => {
  it('initializes once, syncs junction hashtags once, updates fields, and resets edits', async () => {
    mocks.groupHashtags = [
      { hashtag: { tag: 'one' } },
      { hashtag: null },
      { hashtag: { tag: '' } },
      { hashtag: { tag: 'two' } },
    ];
    const initialData = { name: 'Original', description: 'Initial' };
    const { result, rerender } = renderHook(({ data }) => useGroupUpdate('group-1', data), {
      initialProps: { data: initialData as Partial<GroupFormData> },
    });

    await waitFor(() => expect(result.current.formData.name).toBe('Original'));
    expect(result.current.formData.hashtags).toEqual(['one', 'two']);

    act(() => result.current.updateField('name', 'Changed'));
    const changedReference = result.current.formData;
    act(() => result.current.updateField('name', 'Changed'));
    expect(result.current.formData).toBe(changedReference);

    const content = [{ type: 'p', children: [{ text: 'Edited' }] }] as never;
    act(() => result.current.updateDescriptionContent(content));
    expect(result.current.formData.description).toBe('Edited');
    const contentReference = result.current.formData;
    act(() => result.current.updateDescriptionContent(content));
    expect(result.current.formData).toBe(contentReference);

    rerender({ data: { name: 'Ignored later data' } });
    expect(result.current.formData.name).toBe('Changed');

    act(() => result.current.resetForm());
    expect(result.current.formData).toMatchObject({
      name: 'Ignored later data',
      description: '',
      hashtags: ['one', 'two'],
    });

    act(() => result.current.removeImage());
    expect(mocks.updateGroup).toHaveBeenCalledWith({ id: 'group-1', image_url: null });
  });

  it('resets a create form and does not persist image removal', () => {
    const { result } = renderHook(() => useGroupUpdate('group-1'));
    act(() => result.current.updateField('name', 'Temporary'));
    act(() => result.current.resetForm());
    expect(result.current.formData.name).toBe('');
    act(() => result.current.removeImage());
    expect(mocks.updateGroup).not.toHaveBeenCalled();

    expect(renderHook(() => useGroupUpdate('group-2', {})).result.current.formData.name).toBe('');
  });

  it('rejects blank names with and without a submit event', async () => {
    const preventDefault = vi.fn();
    const { result } = renderHook(() => useGroupUpdate('group-1'));
    await act(() => result.current.handleSubmit({ preventDefault } as never));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mocks.toastError).toHaveBeenCalledOnce();
    await act(() => result.current.handleSubmit());
    expect(mocks.createGroup).not.toHaveBeenCalled();
  });

  it('requires a group type when creating and always clears the submitting state', async () => {
    const { result } = renderHook(() => useGroupUpdate('group-1'));
    act(() => result.current.updateField('name', 'Created'));
    await act(() => result.current.handleSubmit());
    expect(mocks.createGroup).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('creates a group, applies hashtags, and navigates without update toast', async () => {
    mocks.groupHashtags = null;
    mocks.allHashtags = null;
    const { result } = renderHook(() =>
      useGroupUpdate('group-1', undefined, { groupType: 'base' })
    );
    act(() => result.current.setFormData(completeFormData()));
    await act(() => result.current.handleSubmit());

    expect(mocks.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'group-1', group_type: 'base', owner_id: null })
    );
    expect(mocks.syncHashtags).toHaveBeenCalledWith('group', 'group-1', ['complete'], [], []);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/group/group-1' });
  });

  it('updates a renamed group and synchronizes its conversation', async () => {
    mocks.groupConversation = { id: 'conversation-1' };
    const { result } = renderHook(() => useGroupUpdate('group-1', { name: 'Original' }));
    await waitFor(() => expect(result.current.formData.name).toBe('Original'));
    act(() => result.current.updateField('name', 'Renamed'));
    await act(() => result.current.handleSubmit());

    expect(mocks.updateGroup).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
    expect(mocks.updateConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conversation-1', name: 'Renamed' })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledOnce();
  });

  it('does not update a conversation when the name is unchanged or absent', async () => {
    const { result } = renderHook(() => useGroupUpdate('group-1', { name: 'Original' }));
    await waitFor(() => expect(result.current.formData.name).toBe('Original'));
    await act(() => result.current.handleSubmit());
    expect(mocks.updateConversation).not.toHaveBeenCalled();
  });

  it('shows the update failure toast when a mutation rejects', async () => {
    mocks.waitForClientApply.mockRejectedValueOnce(new Error('failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useGroupUpdate('group-1', { name: 'Original' }));
    await waitFor(() => expect(result.current.formData.name).toBe('Original'));
    await act(() => result.current.handleSubmit());
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });
});

describe('useGroupUpdate sibling relationship synchronization', () => {
  it('removes the previous partner and proposes grants and role membership for a new partner', async () => {
    mocks.groupConnections = [peerConnection({ id: 'previous', group_b_id: 'previous-partner' })];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'previous-partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() => result.current.setFormData(completeFormData()));
    await act(() => result.current.handleSubmit());

    expect(mocks.removeConnection).toHaveBeenCalledWith({
      id: 'previous',
      acting_group_id: 'group-1',
    });
    expect(mocks.propose).toHaveBeenCalledWith(
      expect.objectContaining({
        group_a_id: 'group-1',
        group_b_id: 'partner',
        active_connection_id: null,
        desired_connection_type: 'peer',
        membership_rule: expect.objectContaining({
          operation: 'upsert',
          member_source_group_id: 'group-1',
          member_target_group_id: 'partner',
          membership_mode: 'role_members',
          required_source_role_id: 'role-1',
          eligible_origin_group_ids: [],
        }),
      })
    );
    expect(mocks.propose.mock.calls[0]?.[0].grants).toHaveLength(5);
  });

  it('removes the previous connection when the partner is cleared', async () => {
    mocks.groupConnections = [peerConnection()];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { hasSiblingConnections: true }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() => result.current.updateField('connected_group_id', null));
    await act(() => result.current.handleSubmit());
    expect(mocks.removeConnection).toHaveBeenCalledOnce();
    expect(mocks.propose).not.toHaveBeenCalled();
  });

  it('reuses an existing connection/request, removes stale grants, and removes membership', async () => {
    mocks.groupConnections = [
      peerConnection({
        grants: [
          {
            id: 'grant-keep',
            right_key: 'informationRight',
            holder_group_id: 'group-1',
            scope_group_id: 'partner',
          },
          {
            id: 'grant-remove',
            right_key: 'amendmentRight',
            holder_group_id: 'group-1',
            scope_group_id: 'partner',
          },
        ],
        membership_rule: {
          id: 'membership-1',
          member_source_group_id: 'partner',
          member_target_group_id: 'group-1',
          membership_mode: 'selected_source_groups',
          required_source_role_id: null,
          origins: [{ eligible_origin_group_id: 'origin-1' }, { eligible_origin_group_id: null }],
        },
      }),
      peerConnection({ id: 'wrong-type', connection_type: 'hierarchy' }),
      peerConnection({ id: 'wrong-pair', group_a_id: 'other' }),
    ];
    mocks.groupConnectionRequests = [
      { id: 'request-1', group_a_id: 'group-1', group_b_id: 'partner' },
    ];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() =>
      result.current.setFormData({
        ...completeFormData(),
        sibling_membership_mode: 'none',
        siblingMembershipDirection: null,
        connectedRelationshipDirections: {
          ...directions,
          amendmentRight: 'none',
          rightToSpeak: 'none',
          activeVotingRight: 'none',
          passiveVotingRight: 'none',
        },
      })
    );
    await act(() => result.current.handleSubmit());

    const proposal = mocks.propose.mock.calls[0]?.[0];
    expect(proposal).toMatchObject({
      id: 'request-1',
      active_connection_id: 'connection-1',
      proposed_connection_id: 'connection-1',
      membership_rule: {
        existing_membership_rule_id: 'membership-1',
        operation: 'remove',
        eligible_origin_group_ids: ['origin-1'],
      },
    });
    expect(proposal.grants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ existing_grant_id: 'grant-keep', operation: 'upsert' }),
        expect.objectContaining({ existing_grant_id: 'grant-remove', operation: 'remove' }),
      ])
    );
  });

  it('supports reverse peer orientation and selected-source membership', async () => {
    mocks.groupConnections = [
      peerConnection({ group_a_id: 'partner', group_b_id: 'group-1', grants: undefined }),
    ];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() =>
      result.current.setFormData({
        ...completeFormData(),
        siblingMembershipDirection: 'partner_members_to_current',
        sibling_membership_mode: 'selected_source_groups',
        parliament_source_group_ids: undefined as never,
      })
    );
    await act(() => result.current.handleSubmit());
    expect(mocks.propose.mock.calls[0]?.[0].membership_rule).toMatchObject({
      member_source_group_id: 'partner',
      member_target_group_id: 'group-1',
      required_source_role_id: null,
      eligible_origin_group_ids: [],
    });
  });

  it('synchronizes sibling relationships while creating', async () => {
    const { result } = renderHook(() =>
      useGroupUpdate('group-1', undefined, { groupType: 'sibling' })
    );
    act(() => result.current.setFormData(completeFormData()));
    await act(() => result.current.handleSubmit());
    expect(mocks.createGroup).toHaveBeenCalledOnce();
    expect(mocks.propose).toHaveBeenCalledOnce();
  });

  it('supports a role-members rule without a selected role', async () => {
    mocks.groupConnections = [peerConnection()];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() =>
      result.current.setFormData({
        ...completeFormData(),
        sibling_role_id: null,
      })
    );
    await act(() => result.current.handleSubmit());
    expect(mocks.propose.mock.calls[0]?.[0].membership_rule.required_source_role_id).toBeNull();
  });

  it('emits no membership rule when neither desired nor existing membership is present', async () => {
    mocks.groupConnections = [peerConnection()];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() =>
      result.current.setFormData({
        ...completeFormData(),
        sibling_membership_mode: 'none',
        siblingMembershipDirection: null,
      })
    );
    await act(() => result.current.handleSubmit());
    expect(mocks.propose.mock.calls[0]?.[0].membership_rule).toBeNull();
  });

  it('normalizes absent origins while removing an existing membership rule', async () => {
    mocks.groupConnections = [
      peerConnection({
        membership_rule: {
          id: 'membership-1',
          member_source_group_id: 'partner',
          member_target_group_id: 'group-1',
          membership_mode: 'all_members',
          required_source_role_id: null,
          origins: undefined,
        },
      }),
    ];
    const { result } = renderHook(() =>
      useGroupUpdate(
        'group-1',
        { name: 'Group', connected_group_id: 'partner' },
        { groupType: 'sibling' }
      )
    );
    await waitFor(() => expect(result.current.formData.name).toBe('Group'));
    act(() =>
      result.current.setFormData({
        ...completeFormData(),
        sibling_membership_mode: null,
        siblingMembershipDirection: null,
      })
    );
    await act(() => result.current.handleSubmit());
    expect(mocks.propose.mock.calls[0]?.[0].membership_rule.eligible_origin_group_ids).toEqual([]);
  });
});
