/**
 * Group Edit Component
 *
 * Complete group editing UI with loading and error states.
 * Handles data fetching, form display, and navigation.
 */

import { useNavigate } from '@tanstack/react-router';
import type { Value } from 'platejs';
import { useGroupData } from '../hooks/useGroupData';
import { useAuth } from '@/providers/auth-provider';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { RIGHT_TYPES, type RightType } from '@/features/shared/ui/status';
import { richTextToPlainText, toRichTextValue } from '@/features/shared/logic/richText';
import type { GroupFormData, RelationshipDirection } from '../hooks/useGroupUpdate';
import { useGroupConnectionState } from '@/zero/network';
import { buildRightDirectionsForConnection } from '@/features/network/logic/groupConnectionDerived';
import type { CanonicalMembershipMode } from '@/features/network/types/network.types';
interface GroupEditProps {
  groupId: string;
}

export function useGroupEditController({ groupId }: GroupEditProps) {
  const navigate = useNavigate();

  const { t } = useTranslation();

  const { group, isLoading } = useGroupData(groupId);

  const { groupConnections } = useGroupConnectionState({ groupId });

  const { user } = useAuth();

  const connectedRelationshipDirections: Record<RightType, RelationshipDirection> = {
    informationRight: 'none',
    amendmentRight: 'none',
    rightToSpeak: 'none',
    activeVotingRight: 'none',
    passiveVotingRight: 'none',
  };

  const connectedGroupId = group?.connected_group_id ?? null;

  const primarySiblingConnection =
    connectedGroupId == null
      ? null
      : (groupConnections.find(
          connection =>
            connection.connection_type === 'peer' &&
            ((connection.group_a_id === groupId && connection.group_b_id === connectedGroupId) ||
              (connection.group_a_id === connectedGroupId && connection.group_b_id === groupId))
        ) ?? null);

  const fallbackCanonicalMembershipMode = (
    siblingMembershipMode: string | null | undefined
  ): CanonicalMembershipMode | null => {
    switch (siblingMembershipMode) {
      case 'elected':
        return 'role_members';
      case 'parliament':
        return 'selected_source_groups';
      case 'open':
        return 'none';
      default:
        return null;
    }
  };

  const getRelativeSiblingMembershipDirection = () => {
    if (!primarySiblingConnection?.membership_rule || !group) {
      return null;
    }

    return primarySiblingConnection.membership_rule.member_source_group_id === group.id
      ? 'current_members_to_partner'
      : 'partner_members_to_current';
  };

  if (primarySiblingConnection) {
    const derivedDirections = buildRightDirectionsForConnection({
      currentGroupId: groupId,
      connection: primarySiblingConnection,
    });
    for (const right of RIGHT_TYPES) {
      connectedRelationshipDirections[right] = derivedDirections[right];
    }
  }

  const initialFormData: Partial<GroupFormData> | undefined = group
    ? ({
        name: group.name ?? '',
        description: richTextToPlainText(group.description),
        descriptionContent: toRichTextValue(group.description) as Value,
        email: group.email ?? '',
        country: group.country ?? '',
        region: group.region ?? '',
        post_code: group.post_code ?? '',
        website: group.website ?? '',
        youtube: group.youtube ?? '',
        linkedin: group.linkedin ?? '',
        whatsapp: group.whatsapp ?? '',
        instagram: group.instagram ?? '',
        twitter: group.twitter ?? group.x ?? '',
        facebook: group.facebook ?? '',
        snapchat: group.snapchat ?? '',
        tiktok: group.tiktok ?? '',
        city: group.city ?? '',
        street: group.street ?? '',
        house_number: group.house_number ?? '',
        latitude: group.latitude ?? null,
        longitude: group.longitude ?? null,
        imageURL: group.image_url ?? '',
        connected_group_id: group.connected_group_id ?? null,
        siblingMembershipDirection: getRelativeSiblingMembershipDirection(),
        sibling_membership_mode:
          (primarySiblingConnection?.membership_rule
            ?.membership_mode as GroupFormData['sibling_membership_mode']) ??
          fallbackCanonicalMembershipMode(group.sibling_membership_mode) ??
          null,
        sibling_role_id:
          primarySiblingConnection?.membership_rule?.required_source_role_id ??
          group.sibling_role_id ??
          null,
        parliament_source_group_ids:
          primarySiblingConnection?.membership_rule?.origins
            ?.map(origin => origin.eligible_origin_group_id)
            .filter((id): id is string => Boolean(id)) ??
          (group.sibling_sources ?? []).map(sourceLink => sourceLink.source_group_id) ??
          [],
        connectedRelationshipDirections: connectedRelationshipDirections,
      } as Partial<GroupFormData>)
    : undefined;

  return {
    groupId,
    navigate,
    t,
    group,
    isLoading,
    groupConnections,
    user,
    connectedRelationshipDirections,
    connectedGroupId,
    primarySiblingConnection,
    fallbackCanonicalMembershipMode,
    getRelativeSiblingMembershipDirection,
    initialFormData,
  };
}
