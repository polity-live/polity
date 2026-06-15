'use client';

import { useState, useCallback } from 'react';
import { useUserActions } from '@/zero/users/useUserActions';
import { useGroupActions } from '@/zero/groups/useGroupActions';
import { useAuth } from '@/providers/auth-provider';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useCommonActions, useCommonState } from '@/zero/common';

export type OnboardingStep =
  | 'name'
  | 'interests'
  | 'groupSearch'
  | 'confirm'
  | 'ariaKai'
  | 'summary';

export interface Group {
  id: string;
  name: string;
  description?: string;
  member_count: number;
  location?: string;
  visibility: string;
  latitude?: number | null;
  longitude?: number | null;
  hashtags?: string[];
  matchingInterestTags?: string[];
}

export interface OnboardingData {
  firstName: string;
  lastName: string;
  selectedInterestTags: string[];
  selectedGroups: Group[];
  activeGroupId: string | null;
  membershipRequestSentGroupIds: string[];
  dontShowAriaKaiAgain: boolean;
}

interface UseOnboardingReturn {
  step: OnboardingStep;
  data: OnboardingData;
  isLoading: boolean;
  error: string | null;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setSelectedInterestTags: (tags: string[]) => void;
  toggleInterestTag: (tag: string) => void;
  clearInterestTags: () => void;
  toggleSelectedGroup: (group: Group) => void;
  setActiveGroupId: (groupId: string | null) => void;
  clearSelectedGroups: () => void;
  setDontShowAriaKaiAgain: (value: boolean) => void;
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  submitName: () => Promise<boolean>;
  saveInterests: () => Promise<boolean>;
  sendMembershipRequests: () => Promise<boolean>;
  skipMembership: () => void;
  completeOnboarding: (userId: string) => Promise<void>;
  allInterestSuggestions: string[];
}

const STEP_ORDER: OnboardingStep[] = [
  'name',
  'interests',
  'groupSearch',
  'confirm',
  'ariaKai',
  'summary',
];

function normalizeInterestTag(tag: string) {
  return tag.trim().replace(/^#/, '');
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>();

  return tags
    .map(normalizeInterestTag)
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function useOnboarding(): UseOnboardingReturn {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { updateProfileConfirmed } = useUserActions();
  const { joinGroup } = useGroupActions();
  const { syncEntityHashtags } = useCommonActions();
  const { allHashtags, userHashtags } = useCommonState({
    user_id: user?.id,
    loadAllHashtags: true,
  });
  const [step, setStep] = useState<OnboardingStep>('name');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    selectedInterestTags: [],
    selectedGroups: [],
    activeGroupId: null,
    membershipRequestSentGroupIds: [],
    dontShowAriaKaiAgain: false,
  });

  const setFirstName = useCallback((value: string) => {
    setData(prev => ({ ...prev, firstName: value }));
  }, []);

  const setLastName = useCallback((value: string) => {
    setData(prev => ({ ...prev, lastName: value }));
  }, []);

  const setSelectedInterestTags = useCallback((tags: string[]) => {
    setData(prev => ({ ...prev, selectedInterestTags: uniqueTags(tags).slice(0, 8) }));
  }, []);

  const toggleInterestTag = useCallback((tag: string) => {
    const normalizedTag = normalizeInterestTag(tag);
    if (!normalizedTag) return;

    setData(prev => {
      const exists = prev.selectedInterestTags.some(
        currentTag => currentTag.toLowerCase() === normalizedTag.toLowerCase()
      );

      return {
        ...prev,
        selectedInterestTags: exists
          ? prev.selectedInterestTags.filter(
              currentTag => currentTag.toLowerCase() !== normalizedTag.toLowerCase()
            )
          : uniqueTags([...prev.selectedInterestTags, normalizedTag]).slice(0, 8),
      };
    });
  }, []);

  const clearInterestTags = useCallback(() => {
    setData(prev => ({ ...prev, selectedInterestTags: [] }));
  }, []);

  const toggleSelectedGroup = useCallback((group: Group) => {
    setData(prev => {
      const isSelected = prev.selectedGroups.some(selectedGroup => selectedGroup.id === group.id);
      const selectedGroups = isSelected
        ? prev.selectedGroups.filter(selectedGroup => selectedGroup.id !== group.id)
        : [...prev.selectedGroups, group];

      return {
        ...prev,
        selectedGroups,
        activeGroupId: isSelected ? (selectedGroups.at(-1)?.id ?? null) : group.id,
        membershipRequestSentGroupIds: isSelected
          ? prev.membershipRequestSentGroupIds.filter(groupId => groupId !== group.id)
          : prev.membershipRequestSentGroupIds,
      };
    });
  }, []);

  const setActiveGroupId = useCallback((groupId: string | null) => {
    setData(prev => ({ ...prev, activeGroupId: groupId }));
  }, []);

  const clearSelectedGroups = useCallback(() => {
    setData(prev => ({
      ...prev,
      selectedGroups: [],
      activeGroupId: null,
      membershipRequestSentGroupIds: [],
    }));
  }, []);

  const setDontShowAriaKaiAgain = useCallback((value: boolean) => {
    setData(prev => ({ ...prev, dontShowAriaKaiAgain: value }));
  }, []);
  const goToStep = useCallback((newStep: OnboardingStep) => {
    setStep(newStep);
    setError(null);
  }, []);

  const nextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex < STEP_ORDER.length - 1) {
      // Skip confirm step if no group selected, but still show ariaKai
      if (step === 'groupSearch' && data.selectedGroups.length === 0) {
        setStep('ariaKai');
      } else {
        setStep(STEP_ORDER[currentIndex + 1]);
      }
    }
  }, [step, data.selectedGroups.length]);

  const previousStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      // Skip confirm step when going back if no group
      if (step === 'ariaKai' && data.selectedGroups.length === 0) {
        setStep('groupSearch');
      } else if (step === 'summary') {
        setStep('ariaKai');
      } else {
        setStep(STEP_ORDER[currentIndex - 1]);
      }
    }
  }, [step, data.selectedGroups.length]);

  const submitName = useCallback(async (): Promise<boolean> => {
    if (!data.firstName.trim() || !data.lastName.trim()) {
      setError(t('features.auth.errors.fillBothFields'));
      return false;
    }

    if (data.firstName.length < 2 || data.lastName.length < 2) {
      setError(t('features.auth.errors.nameTooShort'));
      return false;
    }

    setError(null);
    return true;
  }, [data.firstName, data.lastName, t]);

  const saveInterests = useCallback(async (): Promise<boolean> => {
    if (data.selectedInterestTags.length === 0) {
      setError(null);
      return true;
    }

    if (!user?.id) {
      setError(t('features.auth.errors.interestsSaveFailed'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await syncEntityHashtags(
        'user',
        user.id,
        data.selectedInterestTags,
        Array.from(userHashtags ?? []),
        Array.from(allHashtags ?? [])
      );
      return true;
    } catch (err) {
      console.error('Failed to save onboarding interests:', err);
      const errorMsg = t('features.auth.errors.interestsSaveFailed');
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [allHashtags, data.selectedInterestTags, syncEntityHashtags, t, user?.id, userHashtags]);

  const sendMembershipRequests = useCallback(async (): Promise<boolean> => {
    if (data.selectedGroups.length === 0) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const alreadySentIds = new Set(data.membershipRequestSentGroupIds);
      const successfulIds = new Set(data.membershipRequestSentGroupIds);
      const failures: string[] = [];

      for (const group of data.selectedGroups) {
        if (alreadySentIds.has(group.id)) {
          continue;
        }

        try {
          await joinGroup({
            id: crypto.randomUUID(),
            group_id: group.id,
            status: 'requested',
            visibility: '',
          });
          successfulIds.add(group.id);
        } catch (err) {
          console.error('Failed to send membership request:', err);
          failures.push(group.id);
        }
      }

      setData(prev => ({
        ...prev,
        membershipRequestSentGroupIds: Array.from(successfulIds),
      }));

      if (failures.length > 0) {
        const errorMsg = t('features.auth.errors.membershipRequestsPartialFailed');
        setError(errorMsg);
        toast.error(errorMsg);
        return false;
      }

      toast.success(
        t('features.auth.success.membershipRequestsSent', {
          count: data.selectedGroups.length,
        })
      );
      return true;
    } catch (err) {
      console.error('Failed to send membership request:', err);
      const errorMsg = t('features.auth.errors.membershipRequestFailed');
      setError(errorMsg);
      toast.error(errorMsg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [data.membershipRequestSentGroupIds, data.selectedGroups, joinGroup, t, user?.id]);

  const skipMembership = useCallback(() => {
    setStep('ariaKai');
  }, []);

  const completeOnboarding = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await updateProfileConfirmed({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
        });

        console.log('✅ Onboarding completed:', {
          userId,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      } catch (err) {
        console.error('Failed to complete onboarding:', err);
        const errorMsg = t('features.auth.errors.profileUpdateFailed');
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [data.firstName, data.lastName, t, updateProfileConfirmed]
  );

  return {
    step,
    data,
    isLoading,
    error,
    setFirstName,
    setLastName,
    setSelectedInterestTags,
    toggleInterestTag,
    clearInterestTags,
    toggleSelectedGroup,
    setActiveGroupId,
    clearSelectedGroups,
    setDontShowAriaKaiAgain,
    goToStep,
    nextStep,
    previousStep,
    submitName,
    saveInterests,
    sendMembershipRequests,
    skipMembership,
    completeOnboarding,
    allInterestSuggestions: (allHashtags ?? [])
      .map(hashtag => hashtag.tag)
      .filter((tag): tag is string => Boolean(tag)),
  };
}
