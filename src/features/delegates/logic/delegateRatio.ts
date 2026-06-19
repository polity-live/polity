export const DEFAULT_MEMBERS_PER_DELEGATE = 50;

export interface DelegateRatioEventLike {
  event_type?: string | null;
  delegate_seat_allocation_type?: string | null;
  main_group_delegate_allocation_mode?: string | null;
}

export interface DelegateMembersPerSeatInfo {
  count: number;
  translationKey: 'features.delegates.ratio.oneMember' | 'features.delegates.ratio.members';
}

export function getDelegateMembersPerSeatInfo(
  event: DelegateRatioEventLike | null | undefined
): DelegateMembersPerSeatInfo | null {
  if (!event || event.event_type !== 'delegate_assembly') {
    return null;
  }

  if (event.delegate_seat_allocation_type === 'fixed_total') {
    return null;
  }

  const parsed = Number.parseInt(event.main_group_delegate_allocation_mode || '', 10);
  const count = Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MEMBERS_PER_DELEGATE;

  return {
    count,
    translationKey:
      count === 1 ? 'features.delegates.ratio.oneMember' : 'features.delegates.ratio.members',
  };
}
