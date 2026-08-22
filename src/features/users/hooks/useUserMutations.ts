import { useState } from 'react';
import type { MutableJSONValue } from '@/zero/shared/helpers';
import { useUserActions } from '@/zero/users/useUserActions';
import { useCommonActions } from '@/zero/common/useCommonActions';
import { createTimelineEvent } from '@/features/timeline/utils/createTimelineEvent';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/**
 * Hook for user update mutations
 * Handles updating user profile data via Zero
 */
export function useUserMutations() {
  const userActions = useUserActions();
  const commonActions = useCommonActions();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update user profile information
   */
  const updateUserProfile = async (
    userId: string,
    profileData: {
      first_name?: string;
      last_name?: string;
      contact_email?: string | null;
      gender?: 'male' | 'female' | 'diverse' | null;
      bio?: string;
      about?: MutableJSONValue | null;
      avatar?: string | null;
      video_url?: string | null;
      x?: string;
      whatsapp?: string;
      instagram?: string;
      twitter?: string;
      facebook?: string;
      snapchat?: string;
      tiktok?: string;
      youtube?: string;
      linkedin?: string;
      website?: string;
      country?: string;
      region?: string;
      post_code?: string;
      city?: string;
      street?: string;
      house_number?: string;
      latitude?: number | null;
      longitude?: number | null;
      location_kind?: string | null;
      location_place_id?: string | null;
      location_boundary_source?: string | null;
      location_geometry?: MutableJSONValue | null;
      location_bounds?: MutableJSONValue | null;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await userActions.updateProfileClientApplied({
        ...profileData,
      });

      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : translateText('generated.inline.0174_failed_to_update_profile_bc8dc9b4');
      setError(errorMessage);
      console.error('Failed to update profile:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Link avatar file to user
   */
  const linkAvatarFile = async (userId: string, fileId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await userActions.updateProfileClientApplied({
        avatar: fileId,
        video_url: null,
      });

      await createTimelineEvent({
        data: {
          eventType: 'image_uploaded',
          entityType: 'user',
          entityId: userId,
          actorId: userId,
          title: translateText('generated.inline.0547_avatar_updated_46e014bb'),
          description: translateText(
            'generated.inline.0548_user_uploaded_a_new_profile_image_6d8365b5'
          ),
          contentType: 'image',
          status: {},
        },
      });
      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : translateText('generated.inline.0175_failed_to_update_avatar_ecd69081');
      setError(errorMessage);
      console.error('Failed to link avatar:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update user with complete profile data including hashtags (junction-based)
   */
  const updateCompleteProfile = async (
    userId: string,
    profileData: {
      first_name?: string;
      last_name?: string;
      contact_email?: string | null;
      gender?: 'male' | 'female' | 'diverse' | null;
      bio?: string;
      about?: MutableJSONValue | null;
      aboutPlainText?: string;
      avatar?: string | null;
      video_url?: string | null;
      whatsapp?: string;
      instagram?: string;
      twitter?: string;
      facebook?: string;
      snapchat?: string;
      tiktok?: string;
      youtube?: string;
      linkedin?: string;
      website?: string;
      country?: string;
      region?: string;
      post_code?: string;
      city?: string;
      street?: string;
      house_number?: string;
      latitude?: number | null;
      longitude?: number | null;
      location_kind?: string | null;
      location_place_id?: string | null;
      location_boundary_source?: string | null;
      location_geometry?: MutableJSONValue | null;
      location_bounds?: MutableJSONValue | null;
      visibility?: string;
      hashtags?: string[];
      existingJunctions?: {
        id: string;
        hashtag_id: string;
        hashtag?: { id: string; tag: string } | undefined;
      }[];
      allHashtags?: { id: string; tag: string }[];
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await userActions.updateProfileClientApplied({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        contact_email: profileData.contact_email,
        gender: profileData.gender,
        bio: profileData.bio,
        about: profileData.about,
        avatar: profileData.avatar,
        video_url: profileData.video_url,
        x: profileData.twitter,
        whatsapp: profileData.whatsapp,
        instagram: profileData.instagram,
        twitter: profileData.twitter,
        facebook: profileData.facebook,
        snapchat: profileData.snapchat,
        tiktok: profileData.tiktok,
        youtube: profileData.youtube,
        linkedin: profileData.linkedin,
        website: profileData.website,
        country: profileData.country,
        region: profileData.region,
        post_code: profileData.post_code,
        city: profileData.city,
        street: profileData.street,
        house_number: profileData.house_number,
        latitude: profileData.latitude,
        longitude: profileData.longitude,
        location_kind: profileData.location_kind,
        location_place_id: profileData.location_place_id,
        location_boundary_source: profileData.location_boundary_source,
        location_geometry: profileData.location_geometry,
        location_bounds: profileData.location_bounds,
        visibility: profileData.visibility,
      });

      // Sync hashtags via junction tables
      if (profileData.hashtags && profileData.existingJunctions && profileData.allHashtags) {
        await commonActions.syncEntityHashtags(
          'user',
          userId,
          profileData.hashtags,
          profileData.existingJunctions,
          profileData.allHashtags
        );
      }

      // Add timeline event for profile update
      await createTimelineEvent({
        data: {
          eventType: 'updated',
          entityType: 'user',
          entityId: userId,
          actorId: userId,
          title: profileData.first_name
            ? translateText('features.user.timeline.profileUpdatedBy', {
                name: [profileData.first_name, profileData.last_name].filter(Boolean).join(' '),
              })
            : translateText('features.user.timeline.profileUpdated'),
          description: profileData.aboutPlainText?.substring(0, 100) || undefined,
        },
      });

      return { success: true };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : translateText('generated.inline.0174_failed_to_update_profile_bc8dc9b4');
      setError(errorMessage);
      console.error('Failed to update complete profile:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateUserProfile,
    linkAvatarFile,
    updateCompleteProfile,
    isLoading,
    error,
  };
}
