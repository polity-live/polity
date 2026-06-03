import { useMemo } from 'react';
import { useGroupConflictPreflight } from '@/features/groups/hooks/useGroupConflictPreflight';
import {
  buildCanonicalNetworkLinkPayload,
  hasConfiguredNetworkLink,
} from '../logic/networkLinkComposer';
import type { NetworkLinkComposerValue } from '../types/network.types';

export function useNetworkLinkComposerPreflight(args: {
  currentGroupId: string;
  initiatorGroupId: string;
  value: NetworkLinkComposerValue;
  existingLinkId?: string | null;
  existingRightIdsByKey?: Partial<Record<string, string | undefined>>;
  membershipRuleId?: string | null;
  enabled?: boolean;
}) {
  const rightDirectionsKey = useMemo(
    () => JSON.stringify(args.value.rightDirections),
    [args.value.rightDirections]
  );
  const membershipRulesKey = useMemo(
    () => JSON.stringify(args.value.membershipRules),
    [args.value.membershipRules]
  );
  const existingRightIdsKey = useMemo(
    () => JSON.stringify(args.existingRightIdsByKey ?? {}),
    [args.existingRightIdsByKey]
  );

  const preflightInput = useMemo(() => {
    if (
      !args.value.selectedGroupId ||
      !hasConfiguredNetworkLink({
        rightDirections: args.value.rightDirections,
        membershipRules: args.value.membershipRules,
      })
    ) {
      return null;
    }

    const payload = buildCanonicalNetworkLinkPayload({
      currentGroupId: args.currentGroupId,
      otherGroupId: args.value.selectedGroupId,
      relationshipType: args.value.relationshipType,
      rightDirections: args.value.rightDirections,
      membershipRules: args.value.membershipRules,
      linkId: args.existingLinkId ?? undefined,
      existingRightIdsByKey: args.existingRightIdsByKey,
      membershipRuleId: args.membershipRuleId ?? undefined,
      initiatorGroupId: args.initiatorGroupId,
      status: 'active',
    });

    return {
      kind: 'network_link_upsert' as const,
      link_id: payload.id,
      source_group_id: payload.source_group_id,
      target_group_id: payload.target_group_id,
      structural_relation: payload.structural_relation,
      rights: payload.rights.map(right => ({
        id: right.id,
        right_key: right.right_key,
        direction: right.direction,
        status: 'active' as const,
        initiator_group_id: args.initiatorGroupId,
      })),
      membership_rules: {
        forward: payload.membership_rule.forward,
        backward: payload.membership_rule.backward,
      },
      membership_rule: {
        membership_mode: payload.membership_rule.membership_mode,
        role_id: payload.membership_rule.role_id ?? null,
        source_group_ids: payload.membership_rule.source_group_ids ?? null,
      },
    };
  }, [
    args.currentGroupId,
    args.existingLinkId,
    args.initiatorGroupId,
    args.membershipRuleId,
    args.value.relationshipType,
    args.value.selectedGroupId,
    existingRightIdsKey,
    membershipRulesKey,
    rightDirectionsKey,
  ]);

  return useGroupConflictPreflight(preflightInput, {
    enabled: args.enabled ?? Boolean(preflightInput),
  });
}
