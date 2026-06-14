/**
 * Group Update Hook
 *
 * Manages form state and mutations for updating group information.
 * Handles group profile updates including basic info, location, and social media.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useCommonState, useCommonActions } from '@/zero/common';
import { useMessageActions } from '@/zero/messages/useMessageActions';
import { useMessageState } from '@/zero/messages/useMessageState';
import { useGroupConnectionActions, useGroupConnectionState } from '@/zero/network';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import { RIGHT_TYPES, type RightType } from '@/features/network/ui/RightFilters';
import { serverConfirmed } from '@/zero/mutate-with-server-check';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toRichTextValue,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import type {
  CanonicalMembershipMode,
  GroupRelationshipDirection,
  RelativeMembershipDirection,
} from '@/features/network/types/network.types';
import {
  canonicalGroupPair,
  getExpandedRightDirections,
  getRightGrantEndpoints,
} from '@/features/network/logic/groupConnectionComposer';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type GroupType = 'base' | 'hierarchical' | 'sibling';
export type RelationshipDirection = GroupRelationshipDirection;

const INITIAL_CONNECTED_RELATIONSHIP_DIRECTIONS: Record<RightType, RelationshipDirection> = {
  informationRight: 'none',
  amendmentRight: 'none',
  rightToSpeak: 'none',
  activeVotingRight: 'none',
  passiveVotingRight: 'none',
};

export interface GroupFormData {
  name: string;
  description: string;
  descriptionContent: Value;
  email: string;
  country: string;
  region: string;
  post_code: string;
  city: string;
  street: string;
  house_number: string;
  latitude: number | null;
  longitude: number | null;
  imageURL: string;
  visibility: Visibility;
  website: string;
  youtube: string;
  linkedin: string;
  whatsapp: string;
  instagram: string;
  twitter: string;
  facebook: string;
  snapchat: string;
  tiktok: string;
  hashtags: string[];
  connected_group_id?: string | null;
  siblingMembershipDirection?: RelativeMembershipDirection | null;
  sibling_membership_mode?: CanonicalMembershipMode | null;
  sibling_role_id?: string | null;
  parliament_source_group_ids?: string[];
  connectedRelationshipDirections: Record<RightType, RelationshipDirection>;
}

interface UseGroupUpdateResult {
  formData: GroupFormData;
  setFormData: (data: GroupFormData) => void;
  updateField: <K extends keyof GroupFormData>(field: K, value: GroupFormData[K]) => void;
  updateDescriptionContent: (value: Value) => void;
  removeImage: () => void;
  isSubmitting: boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  resetForm: () => void;
}

const initialFormState: GroupFormData = {
  name: '',
  description: '',
  descriptionContent: EMPTY_RICH_TEXT_VALUE,
  email: '',
  country: '',
  region: '',
  post_code: '',
  city: '',
  street: '',
  house_number: '',
  latitude: null,
  longitude: null,
  imageURL: '',
  visibility: 'public' as Visibility,
  website: '',
  youtube: '',
  linkedin: '',
  whatsapp: '',
  instagram: '',
  twitter: '',
  facebook: '',
  snapchat: '',
  tiktok: '',
  hashtags: [],
  connected_group_id: null,
  siblingMembershipDirection: null,
  sibling_membership_mode: null,
  sibling_role_id: null,
  parliament_source_group_ids: [],
  connectedRelationshipDirections: INITIAL_CONNECTED_RELATIONSHIP_DIRECTIONS,
};

/**
 * Hook for managing group update form state and mutations
 *
 * @param groupId - ID of the group to update
 * @param initialData - Initial form data (usually from fetched group data)
 * @param options - Additional options like actorId and visibility
 * @returns Form state, handlers, and submission logic
 *
 * @example
 * const { formData, updateField, handleSubmit, isSubmitting } = useGroupUpdate(groupId, group, { actorId: userId, visibility: 'public' });
 */
export function useGroupUpdate(
  groupId: string,
  initialData?: Partial<GroupFormData>,
  options?: {
    actorId?: string;
    visibility?: 'public' | 'private' | 'authenticated';
    groupType?: GroupType;
  }
): UseGroupUpdateResult {
  const navigate = useNavigate();
  const { createGroup, updateGroup } = useGroupActions();
  const { proposeGroupConnectionChange, deleteGroupConnection } = useGroupConnectionActions();
  const isCreating = !initialData;
  const commonActions = useCommonActions();
  const { updateConversation } = useMessageActions();
  const { groupConversation } = useMessageState({ groupId });
  const { groupConnections, groupConnectionRequests } = useGroupConnectionState({ groupId });
  const { groupHashtags, allHashtags } = useCommonState({
    group_id: groupId,
    loadAllHashtags: true,
  });
  const [formData, setFormData] = useState<GroupFormData>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalName, setOriginalName] = useState('');

  const initializedRef = useRef(false);
  const hashtagsInitializedRef = useRef(false);

  // Derive existing tags from junction data
  const existingTags = useMemo(
    () => (groupHashtags ?? []).map(j => j.hashtag?.tag).filter((t): t is string => !!t),
    [groupHashtags]
  );

  // Initialize hashtags from junction data once available
  useEffect(() => {
    if (existingTags.length > 0 && !hashtagsInitializedRef.current) {
      hashtagsInitializedRef.current = true;
      setFormData(prev => ({ ...prev, hashtags: existingTags }));
    }
  }, [existingTags]);

  // Initialize form data only once when initial data first becomes available
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      initializedRef.current = true;
      const descriptionContent = toRichTextValue(
        initialData.descriptionContent ?? initialData.description ?? ''
      );
      const newFormData = {
        name: initialData.name || '',
        description: richTextToPlainText(descriptionContent),
        descriptionContent,
        email: initialData.email || '',
        country: initialData.country || '',
        region: initialData.region || '',
        post_code: initialData.post_code || '',
        city: initialData.city || '',
        street: initialData.street || '',
        house_number: initialData.house_number || '',
        latitude: initialData.latitude ?? null,
        longitude: initialData.longitude ?? null,
        imageURL: initialData.imageURL || '',
        visibility: initialData.visibility ?? 'public',
        website: initialData.website || '',
        youtube: initialData.youtube || '',
        linkedin: initialData.linkedin || '',
        whatsapp: initialData.whatsapp || '',
        instagram: initialData.instagram || '',
        twitter: initialData.twitter || '',
        facebook: initialData.facebook || '',
        snapchat: initialData.snapchat || '',
        tiktok: initialData.tiktok || '',
        hashtags: initialData.hashtags || existingTags,
        connected_group_id: initialData.connected_group_id ?? null,
        siblingMembershipDirection: initialData.siblingMembershipDirection ?? null,
        sibling_membership_mode: initialData.sibling_membership_mode ?? null,
        sibling_role_id: initialData.sibling_role_id ?? null,
        parliament_source_group_ids: initialData.parliament_source_group_ids ?? [],
        connectedRelationshipDirections: initialData.connectedRelationshipDirections ?? {
          ...INITIAL_CONNECTED_RELATIONSHIP_DIRECTIONS,
        },
      };
      setFormData(newFormData);
      setOriginalName(initialData.name || '');
    }
  }, [initialData]);

  /**
   * Update a single form field
   */
  const updateField = <K extends keyof GroupFormData>(field: K, value: GroupFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateDescriptionContent = (value: Value) => {
    setFormData(prev => ({
      ...prev,
      description: richTextToPlainText(value),
      descriptionContent: value,
    }));
  };

  const removeImage = () => {
    if (isCreating) {
      return;
    }

    updateGroup({
      id: groupId,
      image_url: null,
    });
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    if (initialData) {
      const descriptionContent = toRichTextValue(
        initialData.descriptionContent ?? initialData.description ?? ''
      );
      const resetData = {
        name: initialData.name || '',
        description: richTextToPlainText(descriptionContent),
        descriptionContent,
        email: initialData.email || '',
        country: initialData.country || '',
        region: initialData.region || '',
        post_code: initialData.post_code || '',
        city: initialData.city || '',
        street: initialData.street || '',
        house_number: initialData.house_number || '',
        latitude: initialData.latitude ?? null,
        longitude: initialData.longitude ?? null,
        imageURL: initialData.imageURL || '',
        visibility: initialData.visibility ?? 'public',
        website: initialData.website || '',
        youtube: initialData.youtube || '',
        linkedin: initialData.linkedin || '',
        whatsapp: initialData.whatsapp || '',
        instagram: initialData.instagram || '',
        twitter: initialData.twitter || '',
        facebook: initialData.facebook || '',
        snapchat: initialData.snapchat || '',
        tiktok: initialData.tiktok || '',
        hashtags: existingTags,
        connected_group_id: initialData.connected_group_id ?? null,
        siblingMembershipDirection: initialData.siblingMembershipDirection ?? null,
        sibling_membership_mode: initialData.sibling_membership_mode ?? null,
        sibling_role_id: initialData.sibling_role_id ?? null,
        parliament_source_group_ids: initialData.parliament_source_group_ids ?? [],
        connectedRelationshipDirections: initialData.connectedRelationshipDirections ?? {
          ...INITIAL_CONNECTED_RELATIONSHIP_DIRECTIONS,
        },
      };
      setFormData(resetData);
    } else {
      setFormData(initialFormState);
    }
  };

  const syncConnectedSiblingRelationships = async () => {
    const nextConnectedGroupId = formData.connected_group_id ?? null;
    const previousConnectedGroupId = initialData?.connected_group_id ?? null;
    const findPeerConnection = (connectedGroupId: string | null) =>
      groupConnections.find(connection => {
        if (!connectedGroupId || connection.connection_type !== 'peer') {
          return false;
        }

        return (
          (connection.group_a_id === groupId && connection.group_b_id === connectedGroupId) ||
          (connection.group_a_id === connectedGroupId && connection.group_b_id === groupId)
        );
      });
    const previousConnection = findPeerConnection(previousConnectedGroupId);
    const existingConnection = findPeerConnection(nextConnectedGroupId);
    const partnerChanged =
      previousConnectedGroupId != null && previousConnectedGroupId !== nextConnectedGroupId;

    if (partnerChanged && previousConnection) {
      await serverConfirmed(deleteGroupConnection({ id: previousConnection.id }));
    }

    if (!nextConnectedGroupId) {
      if (!partnerChanged && previousConnection) {
        await serverConfirmed(deleteGroupConnection({ id: previousConnection.id }));
      }
      return;
    }

    const desiredGrants = RIGHT_TYPES.flatMap(right => {
      const direction = formData.connectedRelationshipDirections[right];
      return getExpandedRightDirections(direction).map(selectedDirection => ({
        right_key: right,
        ...getRightGrantEndpoints(selectedDirection, groupId, nextConnectedGroupId),
      }));
    });

    const existingGrantIds = new Map(
      (existingConnection?.grants ?? []).map(grant => [
        `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`,
        grant.id,
      ])
    );
    const desiredGrantKeys = new Set(
      desiredGrants.map(
        grant => `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`
      )
    );
    const grants = [
      ...desiredGrants.map(grant => ({
        id: crypto.randomUUID(),
        existing_grant_id:
          existingGrantIds.get(
            `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`
          ) ?? null,
        operation: 'upsert' as const,
        ...grant,
      })),
      ...(existingConnection?.grants ?? [])
        .filter(
          grant =>
            !desiredGrantKeys.has(
              `${grant.right_key}:${grant.holder_group_id}:${grant.scope_group_id}`
            )
        )
        .map(grant => ({
          id: crypto.randomUUID(),
          existing_grant_id: grant.id,
          operation: 'remove' as const,
          right_key: grant.right_key as RightType,
          holder_group_id: grant.holder_group_id,
          scope_group_id: grant.scope_group_id,
        })),
    ];
    const membershipMode = formData.sibling_membership_mode;
    const hasMembership =
      membershipMode != null &&
      membershipMode !== 'none' &&
      formData.siblingMembershipDirection != null;
    const memberSourceGroupId =
      formData.siblingMembershipDirection === 'current_members_to_partner'
        ? groupId
        : nextConnectedGroupId;
    const memberTargetGroupId =
      formData.siblingMembershipDirection === 'current_members_to_partner'
        ? nextConnectedGroupId
        : groupId;
    const existingMembershipRule = existingConnection?.membership_rule ?? null;
    const membershipRule = hasMembership
      ? {
          id: crypto.randomUUID(),
          existing_membership_rule_id: existingMembershipRule?.id ?? null,
          operation: 'upsert' as const,
          member_source_group_id: memberSourceGroupId,
          member_target_group_id: memberTargetGroupId,
          membership_mode: membershipMode,
          required_source_role_id:
            membershipMode === 'role_members' ? (formData.sibling_role_id ?? null) : null,
          eligible_origin_group_ids:
            membershipMode === 'selected_source_groups'
              ? (formData.parliament_source_group_ids ?? [])
              : [],
        }
      : existingMembershipRule
        ? {
            id: crypto.randomUUID(),
            existing_membership_rule_id: existingMembershipRule.id,
            operation: 'remove' as const,
            member_source_group_id: existingMembershipRule.member_source_group_id,
            member_target_group_id: existingMembershipRule.member_target_group_id,
            membership_mode: existingMembershipRule.membership_mode as Exclude<
              CanonicalMembershipMode,
              'none'
            >,
            required_source_role_id: existingMembershipRule.required_source_role_id,
            eligible_origin_group_ids:
              existingMembershipRule.origins
                ?.map(origin => origin.eligible_origin_group_id)
                .filter((id): id is string => Boolean(id)) ?? [],
          }
        : null;
    const pair = canonicalGroupPair(groupId, nextConnectedGroupId);
    const existingRequest = groupConnectionRequests.find(
      request => request.group_a_id === pair.group_a_id && request.group_b_id === pair.group_b_id
    );
    const connectionId = existingConnection?.id ?? crypto.randomUUID();
    const result = proposeGroupConnectionChange({
      id: existingRequest?.id ?? crypto.randomUUID(),
      active_connection_id: existingConnection?.id ?? null,
      proposed_connection_id: connectionId,
      ...pair,
      desired_connection_type: 'peer',
      desired_parent_group_id: null,
      desired_child_group_id: null,
      initiator_group_id: groupId,
      grants,
      membership_rule: membershipRule,
    });

    await serverConfirmed(result);
  };

  /**
   * Handle form submission and group update
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!formData.name.trim()) {
      toast.error(translateText('generated.inline.0585_group_name_is_required_122d4408'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if name changed
      const nameChanged = formData.name !== originalName;

      if (isCreating) {
        if (!options?.groupType) {
          throw new Error('groupType is required when creating a group from useGroupUpdate');
        }

        const createGroupResult = createGroup({
          id: groupId,
          name: formData.name,
          description: formData.description
            ? toZeroRichTextValue(formData.descriptionContent)
            : null,
          email: formData.email || null,
          country: formData.country || null,
          region: formData.region || null,
          post_code: formData.post_code || null,
          city: formData.city || null,
          street: formData.street || null,
          house_number: formData.house_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          image_url: formData.imageURL || null,
          x: formData.twitter || null,
          website: formData.website || null,
          youtube: formData.youtube || null,
          linkedin: formData.linkedin || null,
          whatsapp: formData.whatsapp || null,
          instagram: formData.instagram || null,
          twitter: formData.twitter || null,
          facebook: formData.facebook || null,
          snapchat: formData.snapchat || null,
          tiktok: formData.tiktok || null,
          visibility: formData.visibility,
          owner_id: null,
        });
        await serverConfirmed(createGroupResult);
        if (options.groupType === 'sibling') {
          await syncConnectedSiblingRelationships();
        }
      } else {
        await updateGroup({
          id: groupId,
          name: formData.name,
          description: formData.description
            ? toZeroRichTextValue(formData.descriptionContent)
            : null,
          email: formData.email || null,
          country: formData.country || null,
          region: formData.region || null,
          post_code: formData.post_code || null,
          city: formData.city || null,
          street: formData.street || null,
          house_number: formData.house_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          image_url: formData.imageURL || null,
          x: formData.twitter,
          website: formData.website || null,
          youtube: formData.youtube || null,
          linkedin: formData.linkedin || null,
          whatsapp: formData.whatsapp || null,
          instagram: formData.instagram || null,
          twitter: formData.twitter || null,
          facebook: formData.facebook || null,
          snapchat: formData.snapchat || null,
          tiktok: formData.tiktok || null,
          visibility: formData.visibility,
        });

        if (options?.groupType === 'sibling') {
          await syncConnectedSiblingRelationships();
        }

        // Sync name to group conversation if it changed
        if (nameChanged && groupConversation) {
          await updateConversation({
            id: groupConversation.id,
            name: formData.name,
            last_message_at: Date.now(),
          });
        }
      }

      // Sync hashtags
      await commonActions.syncEntityHashtags(
        'group',
        groupId,
        formData.hashtags,
        groupHashtags ?? [],
        allHashtags ?? []
      );

      toast.success(translateText('generated.inline.0586_group_updated_successfully_131579a7'));
      navigate({ to: `/group/${groupId}` });
    } catch (error) {
      toast.error(translateText('generated.inline.0587_failed_to_update_group_185c81aa'));
      console.error('Update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    updateField,
    updateDescriptionContent,
    removeImage,
    isSubmitting,
    handleSubmit,
    resetForm,
  };
}
