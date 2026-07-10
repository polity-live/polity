import { useState, useEffect, useRef, useMemo } from 'react';
import type { ReadonlyJSONValue } from '@rocicorp/zero';
import type { Value } from 'platejs';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useUserMutations } from './useUserMutations';
import { useCommonState } from '@/zero/common/useCommonState';
import type { UserProfile } from '../types/user.types';
import { type Visibility } from '@/features/auth/logic/checkEntityAccess';
import {
  EMPTY_RICH_TEXT_VALUE,
  richTextToPlainText,
  toRichTextValue,
  toZeroRichTextValue,
} from '@/features/shared/logic/richText';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type UserGenderFormValue = 'male' | 'female' | 'diverse' | 'unspecified';

// Co-located types
export interface UserProfileFormData {
  firstName: string;
  lastName: string;
  gender: UserGenderFormValue;
  subtitle: string;
  about: string;
  aboutContent: Value;
  email: string;
  youtube: string;
  linkedin: string;
  whatsapp: string;
  instagram: string;
  twitter: string;
  facebook: string;
  snapchat: string;
  tiktok: string;
  website: string;
  country: string;
  region: string;
  post_code: string;
  city: string;
  street: string;
  house_number: string;
  latitude: number | null;
  longitude: number | null;
  location_kind: string | null;
  location_place_id: string | null;
  location_boundary_source: string | null;
  location_geometry: ReadonlyJSONValue | null;
  location_bounds: ReadonlyJSONValue | null;
  avatar: string;
  visibility: Visibility;
  hashtags: string[];
}

export interface UseUserProfileFormOptions {
  userId: string;
  user: UserProfile | null;
  onSuccess?: () => void;
}

export interface UseUserProfileFormReturn {
  formData: UserProfileFormData;
  setFormData: React.Dispatch<React.SetStateAction<UserProfileFormData>>;
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  updateAboutContent: (value: Value) => void;
  updateField: <K extends keyof UserProfileFormData>(
    field: K,
    value: UserProfileFormData[K]
  ) => void;
}

export function useUserProfileForm({
  userId,
  user,
  onSuccess,
}: UseUserProfileFormOptions): UseUserProfileFormReturn {
  const navigate = useNavigate();
  const { updateCompleteProfile } = useUserMutations();
  const { userHashtags, allHashtags } = useCommonState({
    user_id: userId,
    loadAllHashtags: true,
  });

  // Derive tag strings from junction data
  const existingTags = useMemo(
    () => (userHashtags ?? []).map(j => j.hashtag?.tag).filter(Boolean) as string[],
    [userHashtags]
  );

  const [formData, setFormData] = useState<UserProfileFormData>({
    firstName: '',
    lastName: '',
    gender: 'unspecified',
    subtitle: '',
    about: '',
    aboutContent: EMPTY_RICH_TEXT_VALUE,
    email: '',
    youtube: '',
    linkedin: '',
    whatsapp: '',
    instagram: '',
    twitter: '',
    facebook: '',
    snapchat: '',
    tiktok: '',
    website: '',
    country: '',
    region: '',
    post_code: '',
    city: '',
    street: '',
    house_number: '',
    latitude: null,
    longitude: null,
    location_kind: null,
    location_place_id: null,
    location_boundary_source: null,
    location_geometry: null,
    location_bounds: null,
    avatar: '',
    visibility: 'public' as Visibility,
    hashtags: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);
  const hashtagsInitializedRef = useRef(false);

  // Initialize form data only once when user data first loads
  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      const aboutContent = toRichTextValue(user.about ?? '');
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        gender:
          user.gender === 'male' || user.gender === 'female' || user.gender === 'diverse'
            ? user.gender
            : 'unspecified',
        subtitle: user.bio || '',
        about: richTextToPlainText(aboutContent),
        aboutContent,
        email: user.email || '',
        youtube: user.youtube || '',
        linkedin: user.linkedin || '',
        whatsapp: user.whatsapp || '',
        instagram: user.instagram || '',
        twitter: user.twitter || user.x || '',
        facebook: user.facebook || '',
        snapchat: user.snapchat || '',
        tiktok: user.tiktok || '',
        website: user.website || '',
        country: user.country || '',
        region: user.region || '',
        post_code: user.post_code || '',
        city: user.city || '',
        street: user.street || '',
        house_number: user.house_number || '',
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
        location_kind: user.location_kind ?? null,
        location_place_id: user.location_place_id ?? null,
        location_boundary_source: user.location_boundary_source ?? null,
        location_geometry: user.location_geometry ?? null,
        location_bounds: user.location_bounds ?? null,
        avatar: user.avatar || '',
        visibility: (user.visibility as Visibility) ?? 'public',
        hashtags: [],
      });
    }
  }, [user]);

  // Initialize hashtags once junction data loads
  useEffect(() => {
    if (existingTags.length > 0 && !hashtagsInitializedRef.current) {
      hashtagsInitializedRef.current = true;
      setFormData(prev => ({ ...prev, hashtags: existingTags }));
    }
  }, [existingTags]);

  const updateField = <K extends keyof UserProfileFormData>(
    field: K,
    value: UserProfileFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateAboutContent = (value: Value) => {
    setFormData(prev => ({
      ...prev,
      about: richTextToPlainText(value),
      aboutContent: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user) {
        toast.error(translateText('generated.inline.1181_no_user_data_to_update_33da5c6a'));
        return;
      }

      // Update the user using the mutations hook
      const result = await updateCompleteProfile(userId, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        gender: formData.gender === 'unspecified' ? null : formData.gender,
        bio: formData.subtitle,
        about: formData.about ? toZeroRichTextValue(formData.aboutContent) : null,
        aboutPlainText: formData.about,
        avatar: formData.avatar,
        youtube: formData.youtube,
        linkedin: formData.linkedin,
        whatsapp: formData.whatsapp,
        instagram: formData.instagram,
        twitter: formData.twitter,
        facebook: formData.facebook,
        snapchat: formData.snapchat,
        tiktok: formData.tiktok,
        website: formData.website,
        country: formData.country,
        region: formData.region,
        post_code: formData.post_code,
        city: formData.city,
        street: formData.street,
        house_number: formData.house_number,
        latitude: formData.latitude,
        longitude: formData.longitude,
        location_kind: formData.location_kind,
        location_place_id: formData.location_place_id,
        location_boundary_source: formData.location_boundary_source,
        location_geometry: formData.location_geometry,
        location_bounds: formData.location_bounds,
        visibility: formData.visibility,
        hashtags: formData.hashtags,
        existingJunctions: userHashtags ?? [],
        allHashtags: allHashtags ?? [],
      });

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate({ to: `/user/${userId}` });
        }
      }
    } catch (error) {
      toast.error(translateText('generated.inline.1182_failed_to_update_user_8743e9c1'));
      console.error('Update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    setFormData,
    isSubmitting,
    handleSubmit,
    updateAboutContent,
    updateField,
  };
}
