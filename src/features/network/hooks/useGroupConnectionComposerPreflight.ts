import { useMemo } from 'react';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import {
  buildCanonicalGroupConnectionPayload,
  hasConfiguredGroupConnection,
  hasIncompleteMembershipRule,
} from '../logic/groupConnectionComposer';
import type { GroupConnectionComposerValue } from '../types/network.types';

export function useGroupConnectionComposerPreflight(args: {
  currentGroupId: string;
  initiatorGroupId: string;
  value: GroupConnectionComposerValue;
  existingConnectionId?: string | null;
  existingRightIdsByKey?: Partial<Record<string, string | undefined>>;
  membershipRuleId?: string | null;
  enabled?: boolean;
}) {
  const rightDirectionsKey = useMemo(
    () => JSON.stringify(args.value.rightDirections),
    [args.value.rightDirections]
  );
  const membershipRuleKey = useMemo(
    () =>
      JSON.stringify({
        membershipDirection: args.value.membershipDirection,
        membershipRule: args.value.membershipRule,
      }),
    [args.value.membershipDirection, args.value.membershipRule]
  );
  const existingRightIdsKey = useMemo(
    () => JSON.stringify(args.existingRightIdsByKey ?? {}),
    [args.existingRightIdsByKey]
  );

  const preflightInput = useMemo(() => {
    if (
      !args.value.selectedGroupId ||
      hasIncompleteMembershipRule({
        membershipDirection: args.value.membershipDirection,
        membershipRule: args.value.membershipRule,
      }) ||
      !hasConfiguredGroupConnection({
        rightDirections: args.value.rightDirections,
        membershipDirection: args.value.membershipDirection,
        membershipRule: args.value.membershipRule,
      })
    ) {
      return null;
    }

    const payload = buildCanonicalGroupConnectionPayload({
      currentGroupId: args.currentGroupId,
      otherGroupId: args.value.selectedGroupId,
      relationshipType: args.value.relationshipType,
      rightDirections: args.value.rightDirections,
      membershipDirection: args.value.membershipDirection,
      membershipRule: args.value.membershipRule,
      connectionId: args.existingConnectionId ?? undefined,
      existingRightIdsByKey: args.existingRightIdsByKey,
      membershipRuleId: args.membershipRuleId ?? undefined,
      initiatorGroupId: args.initiatorGroupId,
      status: 'active',
    });

    return {
      kind: 'group_connection_upsert' as const,
      connection_id: payload.id,
      group_a_id: payload.group_a_id,
      group_b_id: payload.group_b_id,
      connection_type: payload.connection_type,
      parent_group_id: payload.parent_group_id,
      child_group_id: payload.child_group_id,
      grants: payload.grants.map(grant => ({
        id: grant.id,
        right_key: grant.right_key,
        holder_group_id: grant.holder_group_id,
        scope_group_id: grant.scope_group_id,
        status: 'active' as const,
        initiator_group_id: args.initiatorGroupId,
      })),
      membership_rule: payload.membership_rule,
    };
  }, [
    args.currentGroupId,
    args.existingConnectionId,
    args.initiatorGroupId,
    args.membershipRuleId,
    args.value.relationshipType,
    args.value.selectedGroupId,
    existingRightIdsKey,
    membershipRuleKey,
    rightDirectionsKey,
  ]);

  return useGroupConflictPreflight(preflightInput, {
    enabled: args.enabled ?? Boolean(preflightInput),
  });
}
