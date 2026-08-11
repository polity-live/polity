/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  group: undefined as unknown,
  isLoading: false,
  connections: [] as unknown[],
  user: { id: 'user-1' } as unknown,
  buildDirections: vi.fn(() => ({
    informationRight: 'incoming',
    amendmentRight: 'outgoing',
    rightToSpeak: 'mutual',
    activeVotingRight: 'none',
    passiveVotingRight: 'incoming',
  })),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useGroupData', () => ({
  useGroupData: () => ({ group: mocks.group, isLoading: mocks.isLoading }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionState: () => ({ groupConnections: mocks.connections }),
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/logic/richText', () => ({
  richTextToPlainText: (value: unknown) => `plain:${String(value)}`,
  toRichTextValue: (value: unknown) => [{ type: 'p', value }],
}));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  buildRightDirectionsForConnection: mocks.buildDirections,
}));

import { useGroupEditController } from '../useGroupEditController';

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'connection-1',
    connection_type: 'peer',
    group_a_id: 'group-1',
    group_b_id: 'group-2',
    membership_rule: {
      member_source_group_id: 'group-1',
      member_target_group_id: 'group-2',
      membership_mode: 'role_members',
      required_source_role_id: 'role-1',
      origins: [{ eligible_origin_group_id: 'source-1' }, { eligible_origin_group_id: null }],
    },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.group = undefined;
  mocks.isLoading = false;
  mocks.connections = [];
  mocks.user = { id: 'user-1' };
  mocks.navigate.mockClear();
  mocks.buildDirections.mockClear();
});

describe('useGroupEditController contract', () => {
  it('returns empty state and neutral directions while group data is absent', () => {
    mocks.isLoading = true;
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current).toMatchObject({
      groupId: 'group-1',
      group: undefined,
      isLoading: true,
      connectedGroupId: null,
      primarySiblingConnection: null,
      initialFormData: undefined,
      connectedRelationshipDirections: {
        informationRight: 'none',
        amendmentRight: 'none',
        rightToSpeak: 'none',
        activeVotingRight: 'none',
        passiveVotingRight: 'none',
      },
    });
    expect(current.getRelativeSiblingMembershipDirection()).toBeNull();
  });

  it('normalizes every missing form field and legacy sibling mode', () => {
    mocks.group = {
      id: 'group-1',
      name: null,
      description: null,
      email: null,
      country: null,
      region: null,
      post_code: null,
      website: null,
      youtube: null,
      linkedin: null,
      whatsapp: null,
      instagram: null,
      twitter: null,
      x: null,
      facebook: null,
      snapchat: null,
      tiktok: null,
      city: null,
      street: null,
      house_number: null,
      latitude: null,
      longitude: null,
      location_kind: null,
      location_place_id: null,
      location_boundary_source: null,
      location_geometry: null,
      location_bounds: null,
      image_url: null,
      video_url: null,
      connected_group_id: null,
      sibling_membership_mode: 'elected',
      sibling_role_id: null,
      sibling_sources: null,
    };
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current.initialFormData).toMatchObject({
      name: '',
      email: '',
      twitter: '',
      latitude: null,
      connected_group_id: null,
      siblingMembershipDirection: null,
      sibling_membership_mode: 'role_members',
      sibling_role_id: null,
      parliament_source_group_ids: [],
    });
    expect(current.fallbackCanonicalMembershipMode('elected')).toBe('role_members');
    expect(current.fallbackCanonicalMembershipMode('parliament')).toBe('selected_source_groups');
    expect(current.fallbackCanonicalMembershipMode('open')).toBe('none');
    expect(current.fallbackCanonicalMembershipMode('other')).toBeNull();
    expect(current.fallbackCanonicalMembershipMode(undefined)).toBeNull();
  });

  it('preserves complete form values and falls back from Twitter to X', () => {
    mocks.group = {
      id: 'group-1',
      name: 'Group',
      description: 'Description',
      email: 'mail@example.test',
      country: 'DE',
      region: 'BW',
      post_code: '79098',
      website: 'https://example.test',
      youtube: 'youtube',
      linkedin: 'linkedin',
      whatsapp: 'whatsapp',
      instagram: 'instagram',
      twitter: null,
      x: 'x-value',
      facebook: 'facebook',
      snapchat: 'snapchat',
      tiktok: 'tiktok',
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
      image_url: 'image',
      video_url: 'video',
      connected_group_id: null,
      sibling_membership_mode: null,
      sibling_role_id: 'legacy-role',
      sibling_sources: [{ source_group_id: 'legacy-source' }],
    };
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current.initialFormData).toMatchObject({
      name: 'Group',
      description: 'plain:Description',
      twitter: 'x-value',
      latitude: 48,
      longitude: 8,
      imageURL: 'image',
      videoURL: 'video',
      sibling_role_id: 'legacy-role',
      parliament_source_group_ids: ['legacy-source'],
    });
  });

  it('selects a direct peer connection and derives rights and membership data', () => {
    mocks.group = {
      id: 'group-1',
      name: 'Group',
      connected_group_id: 'group-2',
      sibling_membership_mode: 'open',
      sibling_role_id: 'legacy-role',
      sibling_sources: [{ source_group_id: 'legacy-source' }],
    };
    mocks.connections = [
      connection({ id: 'wrong-type', connection_type: 'hierarchy' }),
      connection({ id: 'wrong-pair', group_b_id: 'group-3' }),
      connection(),
    ];
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current.primarySiblingConnection).toMatchObject({ id: 'connection-1' });
    expect(current.getRelativeSiblingMembershipDirection()).toBe('current_members_to_partner');
    expect(current.connectedRelationshipDirections).toEqual(
      mocks.buildDirections.mock.results[0]?.value
    );
    expect(current.initialFormData).toMatchObject({
      siblingMembershipDirection: 'current_members_to_partner',
      sibling_membership_mode: 'role_members',
      sibling_role_id: 'role-1',
      parliament_source_group_ids: ['source-1'],
    });
  });

  it('supports reverse peer orientation and partner-to-current membership', () => {
    mocks.group = { id: 'group-1', connected_group_id: 'group-2' };
    mocks.connections = [
      connection({
        group_a_id: 'group-2',
        group_b_id: 'group-1',
        membership_rule: {
          member_source_group_id: 'group-2',
          membership_mode: 'all_members',
          required_source_role_id: null,
          origins: undefined,
        },
      }),
    ];
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current.getRelativeSiblingMembershipDirection()).toBe('partner_members_to_current');
    expect(current.initialFormData).toMatchObject({
      sibling_membership_mode: 'all_members',
      sibling_role_id: null,
      parliament_source_group_ids: [],
    });
  });

  it('handles a selected peer without a membership rule', () => {
    mocks.group = {
      id: 'group-1',
      connected_group_id: 'group-2',
      sibling_membership_mode: 'parliament',
      sibling_sources: [{ source_group_id: 'fallback-source' }],
    };
    mocks.connections = [connection({ membership_rule: null })];
    const current = renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current;
    expect(current.getRelativeSiblingMembershipDirection()).toBeNull();
    expect(current.initialFormData).toMatchObject({
      sibling_membership_mode: 'selected_source_groups',
      parliament_source_group_ids: ['fallback-source'],
    });
  });

  it('returns null when a persisted connected group has no matching peer row', () => {
    mocks.group = { id: 'group-1', connected_group_id: 'group-2' };
    mocks.connections = [connection({ connection_type: 'hierarchy' })];
    expect(
      renderHook(() => useGroupEditController({ groupId: 'group-1' })).result.current
        .primarySiblingConnection
    ).toBeNull();
  });
});
