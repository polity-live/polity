/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDelegateAssemblyParticipantsComposition,
  useEventParticipantsComposition,
} from '../useDelegateAssemblyParticipantsComposition';

const mocks = vi.hoisted(() => ({
  sources: {
    isDelegateAssembly: false,
    hasGroupBackedComposition: false,
    shouldResolveGroupComposition: false,
    participants: [] as any[],
  },
  composition: {
    showComposition: false,
    membershipsWithProvenance: [] as any[],
    isLoading: false,
  },
  buckets: [] as any[],
  groupArg: undefined as any,
  maskedArg: undefined as any,
  bucketArg: undefined as any,
}));

vi.mock('@/features/groups/hooks/useGroupMembershipComposition', () => ({
  useGroupMembershipComposition: (group: unknown) => {
    mocks.groupArg = group;
    return mocks.composition;
  },
}));
vi.mock('../../logic/eventParticipantComposition', () => ({
  buildEventParticipantCompositionSources: () => mocks.sources,
  maskUnmatchedEventParticipantComposition: (participants: unknown) => {
    mocks.maskedArg = participants;
    return participants;
  },
  buildEventParticipantCompositionBuckets: (participants: unknown) => {
    mocks.bucketArg = participants;
    return mocks.buckets;
  },
}));

beforeEach(() => {
  mocks.sources = {
    isDelegateAssembly: false,
    hasGroupBackedComposition: false,
    shouldResolveGroupComposition: false,
    participants: [],
  };
  mocks.composition = {
    showComposition: false,
    membershipsWithProvenance: [],
    isLoading: false,
  };
  mocks.buckets = [];
  mocks.groupArg = undefined;
  mocks.maskedArg = undefined;
  mocks.bucketArg = undefined;
});

describe('useEventParticipantsComposition coverage', () => {
  it('uses source rows without group composition and can expose derived buckets', () => {
    const sourceParticipant = { id: 'source' };
    mocks.sources = { ...mocks.sources, participants: [sourceParticipant] };
    mocks.buckets = [{ key: 'bucket' }];
    const { result } = renderHook(() =>
      useEventParticipantsComposition(undefined, [sourceParticipant] as any)
    );
    expect(mocks.groupArg).toBeNull();
    expect(mocks.maskedArg).toEqual([sourceParticipant]);
    expect(mocks.bucketArg).toEqual([sourceParticipant]);
    expect(result.current).toMatchObject({
      showComposition: true,
      participantsWithProvenance: [sourceParticipant],
      compositionBuckets: [{ key: 'bucket' }],
      isLoading: false,
    });
  });

  it('uses resolved membership rows and reports group-backed and loading variants', () => {
    const membership = { id: 'membership' };
    mocks.sources = {
      ...mocks.sources,
      isDelegateAssembly: true,
      shouldResolveGroupComposition: true,
      participants: [{ id: 'source' }],
    };
    mocks.composition = {
      showComposition: true,
      membershipsWithProvenance: [membership],
      isLoading: true,
    };
    const event = { group: { id: 'group-1' } };
    const { result } = renderHook(() =>
      useDelegateAssemblyParticipantsComposition(event as any, [] as any)
    );
    expect(mocks.groupArg).toEqual({ id: 'group-1' });
    expect(mocks.maskedArg).toEqual([membership]);
    expect(mocks.bucketArg).toBeUndefined();
    expect(result.current).toMatchObject({
      isDelegateAssembly: true,
      showComposition: true,
      compositionBuckets: [],
      isLoading: true,
    });
  });

  it('short-circuits explicit group-backed composition and returns an empty state', () => {
    mocks.sources = { ...mocks.sources, hasGroupBackedComposition: true };
    const backed = renderHook(() => useEventParticipantsComposition({ group: null } as any, []));
    expect(backed.result.current.showComposition).toBe(true);
    backed.unmount();

    mocks.sources = { ...mocks.sources, hasGroupBackedComposition: false };
    const empty = renderHook(() => useEventParticipantsComposition({ group: null } as any, []));
    expect(empty.result.current.showComposition).toBe(false);
  });
});
