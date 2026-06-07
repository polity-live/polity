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
import { useNetworkLinkActions, useNetworkLinkState } from '@/zero/network';
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
  RelativeMembershipDirection,
} from '@/features/network/types/network.types';

export type GroupType = 'base' | 'hierarchical' | 'sibling';
export type RelationshipDirection = 'none' | 'outgoing' | 'incoming' | 'bidirectional';

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
  sibling_membership_direction?: RelativeMembershipDirection | null;
  sibling_membership_mode?: CanonicalMembershipMode | null;
  sibling_role_id?: string | null;
  parliament_source_group_ids?: string[];
  connected_relationship_directions: Record<RightType, RelationshipDirection>;
}

type NetworkLinkRightStatus = 'active' | 'requested' | 'pending' | 'rejected';
type NetworkLinkDirection = 'forward' | 'backward' | 'bidirectional';

function toNetworkLinkRightStatus(status: string | null | undefined): NetworkLinkRightStatus {
  switch (status) {
    case 'active':
    case 'requested':
    case 'pending':
    case 'rejected':
      return status;
    default:
      return 'requested';
  }
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
  sibling_membership_direction: null,
  sibling_membership_mode: null,
  sibling_role_id: null,
  parliament_source_group_ids: [],
  connected_relationship_directions: INITIAL_CONNECTED_RELATIONSHIP_DIRECTIONS,
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
  const { createNetworkLink, updateNetworkLink, deleteNetworkLink } = useNetworkLinkActions();
  const isCreating = !initialData;
  const commonActions = useCommonActions();
  const { updateConversation } = useMessageActions();
  const { groupConversation } = useMessageState({ groupId });
  const { groupLinks } = useNetworkLinkState({ groupId });
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
        sibling_membership_direction: initialData.sibling_membership_direction ?? null,
        sibling_membership_mode: initialData.sibling_membership_mode ?? null,
        sibling_role_id: initialData.sibling_role_id ?? null,
        parliament_source_group_ids: initialData.parliament_source_group_ids ?? [],
        connected_relationship_directions: initialData.connected_relationship_directions ?? {
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
        sibling_membership_direction: initialData.sibling_membership_direction ?? null,
        sibling_membership_mode: initialData.sibling_membership_mode ?? null,
        sibling_role_id: initialData.sibling_role_id ?? null,
        parliament_source_group_ids: initialData.parliament_source_group_ids ?? [],
        connected_relationship_directions: initialData.connected_relationship_directions ?? {
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
    const existingLink = groupLinks.find(link => {
      if (link.structural_relation !== 'sibling') {
        return false;
      }

      const candidateGroupIds = [previousConnectedGroupId, nextConnectedGroupId].filter(
        (connectedGroupId): connectedGroupId is string => Boolean(connectedGroupId)
      );

      return candidateGroupIds.some(
        connectedGroupId =>
          (link.source_group_id === groupId && link.target_group_id === connectedGroupId) ||
          (link.source_group_id === connectedGroupId && link.target_group_id === groupId)
      );
    });

    const rights = RIGHT_TYPES.flatMap(right => {
      const direction = formData.connected_relationship_directions[right];
      if (direction === 'none') {
        return [];
      }

      const canonicalDirection =
        direction === 'bidirectional'
          ? 'bidirectional'
          : direction === 'outgoing'
            ? 'forward'
            : 'backward';

      return [
        {
          id: existingLink?.rights?.find(existingRight => existingRight.right_key === right)?.id,
          right_key: right,
          direction: canonicalDirection as NetworkLinkDirection,
          status: toNetworkLinkRightStatus(
            existingLink?.rights?.find(existingRight => existingRight.right_key === right)?.status
          ),
          initiator_group_id: groupId,
        },
      ];
    });

    if (!nextConnectedGroupId || rights.length === 0) {
      if (existingLink) {
        await serverConfirmed(deleteNetworkLink({ id: existingLink.id }));
      }
      return;
    }

    const backwardMembershipRule = {
      membership_mode: (formData.sibling_membership_mode ?? 'none') as CanonicalMembershipMode,
      membership_direction:
        formData.sibling_membership_mode == null || formData.sibling_membership_mode === 'none'
          ? null
          : formData.sibling_membership_direction === 'outgoing'
            ? ('forward' as const)
            : formData.sibling_membership_direction === 'incoming'
              ? ('backward' as const)
              : null,
      role_id:
        formData.sibling_membership_mode === 'role_members'
          ? (formData.sibling_role_id ?? null)
          : null,
      source_group_ids:
        formData.sibling_membership_mode === 'selected_source_groups'
          ? (formData.parliament_source_group_ids ?? [])
          : null,
    };
    const membershipRule = {
      id: existingLink?.membership_rule?.id,
      membership_mode: backwardMembershipRule.membership_mode,
      membership_direction: backwardMembershipRule.membership_direction,
      role_id: backwardMembershipRule.role_id,
      source_group_ids: backwardMembershipRule.source_group_ids,
    };

    const result = existingLink
      ? updateNetworkLink({
          id: existingLink.id,
          source_group_id: groupId,
          target_group_id: nextConnectedGroupId,
          structural_relation: 'sibling',
          status: 'requested',
          rights,
          membership_rule: membershipRule,
        })
      : createNetworkLink({
          id: crypto.randomUUID(),
          source_group_id: groupId,
          target_group_id: nextConnectedGroupId,
          structural_relation: 'sibling',
          status: 'requested',
          rights,
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
      toast.error('Group name is required');
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

      toast.success('Group updated successfully');
      navigate({ to: `/group/${groupId}` });
    } catch (error) {
      toast.error('Failed to update group');
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
