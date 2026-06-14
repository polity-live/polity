/**
 * Group Edit Form Component
 *
 * Complete form for editing group information including basic info,
 * location, social media, and image upload.
 */

import { useGroupUpdate } from '../hooks/useGroupUpdate';
import type { GroupFormData, GroupType } from '../hooks/useGroupUpdate';
import { useState, useRef } from 'react';
import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useAllGroups, useGroupState } from '@/zero/groups/useGroupState';
import { useGroupConnectionState } from '@/zero/network';
import { RIGHT_TYPES, type RightType } from '@/features/shared/ui/status';
import { useGroupConflictPreflight } from '../hooks/useGroupConflictPreflight';
import {
  canonicalGroupPair,
  getExpandedRightDirections,
  getRightGrantEndpoints,
} from '@/features/network/logic/groupConnectionComposer';
interface GroupEditFormProps {
  groupId: string;
  initialData?: Partial<GroupFormData>;
  onCancel?: () => void;
  actorId?: string;
  visibility?: 'public' | 'private' | 'authenticated';
  groupType?: GroupType;
}

export function useGroupEditFormController({
  groupId,
  initialData,
  onCancel,
  actorId,
  visibility,
  groupType,
}: GroupEditFormProps) {
  const { t } = useTranslation();

  const isCreating = !initialData;

  const [showReview, setShowReview] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const {
    formData,
    setFormData,
    updateDescriptionContent,
    updateField,
    removeImage,
    handleSubmit,
    isSubmitting,
  } = useGroupUpdate(groupId, initialData, { actorId, visibility, groupType });

  const { groups: allGroups } = useAllGroups();

  const availableGroups = allGroups.filter(
    (group): group is NonNullable<(typeof allGroups)[number]> => Boolean(group?.id)
  );

  const { roles: connectedGroupRoles } = useGroupState({
    groupId: formData.connected_group_id ?? undefined,
  });

  const { groupConnections } = useGroupConnectionState({ groupId });

  const selectableConnectedGroups = availableGroups.filter(group => group.id !== groupId);

  const selectableConnectedRoles = (connectedGroupRoles ?? []).filter(
    role => role.scope === 'group' && role.assignee_kind !== 'guest'
  );

  const relationshipDirectionOptions: {
    value: GroupFormData['connectedRelationshipDirections'][RightType];
    label: string;
  }[] = [
    { value: 'none', label: translateText('generated.inline.0159_keine_3ce60e74') },
    {
      value: 'current_has_right_in_partner',
      label: translateText(
        'generated.inline.0160_aktuelle_gruppe_hat_recht_in_partnergruppe_ca1db0de'
      ),
    },
    {
      value: 'partner_has_right_in_current',
      label: translateText(
        'generated.inline.0161_partnergruppe_hat_recht_in_aktueller_gruppe_8b85ec2f'
      ),
    },
    {
      value: 'mutual',
      label: translateText('generated.inline.0162_beide_haben_das_recht_gegenseitig_a982cb49'),
    },
  ];

  const membershipDirectionOptions: {
    value: NonNullable<GroupFormData['siblingMembershipDirection']>;
    label: string;
    description: string;
  }[] = [
    {
      value: 'partner_members_to_current',
      label: translateText('generated.inline.0163_partnergruppe_aktuelle_gruppe_d9e667ae'),
      description: translateText(
        'generated.inline.0164_mitglieder_fliessen_aus_der_partnergruppe_in__034d78c0'
      ),
    },
    {
      value: 'current_members_to_partner',
      label: translateText('generated.inline.0165_aktuelle_gruppe_partnergruppe_e947dfc0'),
      description: translateText(
        'generated.inline.0166_mitglieder_fliessen_aus_der_aktuellen_gruppe__57884822'
      ),
    },
  ];

  const existingSiblingLink =
    formData.connected_group_id == null
      ? null
      : (groupConnections.find(
          connection =>
            connection.connection_type === 'peer' &&
            ((connection.group_a_id === groupId &&
              connection.group_b_id === formData.connected_group_id) ||
              (connection.group_a_id === formData.connected_group_id &&
                connection.group_b_id === groupId))
        ) ?? null);

  const siblingGrants = RIGHT_TYPES.flatMap(right => {
    const direction = formData.connectedRelationshipDirections[right];
    return getExpandedRightDirections(direction).map(selectedDirection => {
      const endpoints = getRightGrantEndpoints(
        selectedDirection,
        groupId,
        formData.connected_group_id ?? ''
      );
      return {
        id: existingSiblingLink?.grants?.find(
          existingGrant =>
            existingGrant.right_key === right &&
            existingGrant.holder_group_id === endpoints.holder_group_id &&
            existingGrant.scope_group_id === endpoints.scope_group_id
        )?.id,
        right_key: right,
        ...endpoints,
        status: 'active' as const,
        initiator_group_id: groupId,
      };
    });
  });

  const siblingMembershipRule = {
    membership_mode: formData.sibling_membership_mode ?? 'none',
    required_source_role_id:
      formData.sibling_membership_mode === 'role_members'
        ? (formData.sibling_role_id ?? null)
        : null,
    eligible_origin_group_ids:
      formData.sibling_membership_mode === 'selected_source_groups'
        ? (formData.parliament_source_group_ids ?? [])
        : [],
  };

  const pair = formData.connected_group_id
    ? canonicalGroupPair(groupId, formData.connected_group_id)
    : null;

  const hasSiblingMembership =
    formData.sibling_membership_mode != null &&
    formData.sibling_membership_mode !== 'none' &&
    formData.siblingMembershipDirection != null;

  const siblingConfigurationPreflight = useGroupConflictPreflight(
    groupType === 'sibling' &&
      formData.connected_group_id &&
      pair &&
      (siblingGrants.length > 0 || hasSiblingMembership)
      ? {
          kind: 'group_connection_upsert',
          connection_id: existingSiblingLink?.id,
          ...pair,
          connection_type: 'peer',
          parent_group_id: null,
          child_group_id: null,
          grants: siblingGrants,
          membership_rule: hasSiblingMembership
            ? {
                member_source_group_id:
                  formData.siblingMembershipDirection === 'current_members_to_partner'
                    ? groupId
                    : formData.connected_group_id,
                member_target_group_id:
                  formData.siblingMembershipDirection === 'current_members_to_partner'
                    ? formData.connected_group_id
                    : groupId,
                membership_mode: siblingMembershipRule.membership_mode as
                  | 'all_members'
                  | 'role_members'
                  | 'selected_source_groups',
                required_source_role_id: siblingMembershipRule.required_source_role_id,
                eligible_origin_group_ids: siblingMembershipRule.eligible_origin_group_ids,
              }
            : null,
        }
      : null,
    {
      enabled:
        groupType === 'sibling' &&
        Boolean(formData.connected_group_id) &&
        (siblingGrants.length > 0 || hasSiblingMembership),
    }
  );

  const onFormSubmit = (e: React.FormEvent) => {
    if (siblingConfigurationPreflight.blocking) {
      e.preventDefault();
      return;
    }

    if (isCreating && !showReview) {
      e.preventDefault();
      if (!formData.name.trim()) return;
      setShowReview(true);
      return;
    }
    handleSubmit(e);
  };

  const confirmCreate = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return {
    groupId,
    initialData,
    onCancel,
    actorId,
    visibility,
    groupType,
    t,
    isCreating,
    showReview,
    setShowReview,
    formRef,
    formData,
    setFormData,
    updateDescriptionContent,
    updateField,
    removeImage,
    handleSubmit,
    isSubmitting,
    allGroups,
    availableGroups,
    connectedGroupRoles,
    groupConnections,
    selectableConnectedGroups,
    selectableConnectedRoles,
    relationshipDirectionOptions,
    membershipDirectionOptions,
    existingSiblingLink,
    siblingGrants,
    siblingMembershipRule,
    pair,
    hasSiblingMembership,
    siblingConfigurationPreflight,
    onFormSubmit,
    confirmCreate,
  };
}
