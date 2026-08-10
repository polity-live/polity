'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { usePublicGroups } from '@/zero/groups/useGroupState.ts';
import type { Group } from '../hooks/useOnboarding.ts';
import { formatLocation } from '@/features/shared/logic/locationHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';

type PublicGroup = NonNullable<ReturnType<typeof usePublicGroups>['groups']>[number];
type NormalizedOnboardingGroup = Group & {
  hashtags: string[];
  member_count: number;
};
type SearchableOnboardingGroup = NormalizedOnboardingGroup & {
  matchingInterestTags: string[];
};

interface GroupSearchStepProps {
  selectedGroups: Group[];
  interestTags: string[];
  activeGroupId: string | null;
  onToggleGroup: (group: Group) => void;
  onActiveGroupChange: (groupId: string | null) => void;
  onClearSelectedGroups: () => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

function toOnboardingGroup(group: PublicGroup): NormalizedOnboardingGroup {
  const location = formatLocation(group);
  const description = richTextToPlainText(group.description);
  const hashtags =
    group.group_hashtags
      ?.map(junction => junction.hashtag?.tag)
      .filter((tag): tag is string => !!tag) ?? [];

  return {
    id: group.id,
    name: group.name ?? '',
    description: description || undefined,
    member_count: group.member_count ?? 0,
    location: location || undefined,
    visibility: group.visibility ?? 'public',
    latitude: typeof group.latitude === 'number' ? group.latitude : null,
    longitude: typeof group.longitude === 'number' ? group.longitude : null,
    hashtags,
  };
}

function hasMappableCoordinates(group: Group) {
  return (
    typeof group.latitude === 'number' &&
    Number.isFinite(group.latitude) &&
    typeof group.longitude === 'number' &&
    Number.isFinite(group.longitude)
  );
}

export function useGroupSearchStepController({
  selectedGroups,
  interestTags,
  activeGroupId,
  onToggleGroup,
  onActiveGroupChange,
  onClearSelectedGroups,
  onNext,
  onBack,
  isLoading,
}: GroupSearchStepProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  // Query all public groups via facade
  const { groups: groupsData, isLoading: groupsLoading } = usePublicGroups();

  const normalizedInterestTags = useMemo(
    () => interestTags.map(tag => tag.toLowerCase()),
    [interestTags]
  );

  const groups = useMemo(() => {
    return (groupsData ?? []).map(group => {
      const onboardingGroup = toOnboardingGroup(group);
      const matchingInterestTags = onboardingGroup.hashtags.filter(tag =>
        normalizedInterestTags.includes(tag.toLowerCase())
      );

      return {
        ...onboardingGroup,
        matchingInterestTags,
      };
    });
  }, [groupsData, normalizedInterestTags]);

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    const sortByInterestMatch = (groupList: SearchableOnboardingGroup[]) =>
      [...groupList].sort((left, right) => {
        const leftMatches = left.matchingInterestTags.length;
        const rightMatches = right.matchingInterestTags.length;

        if (leftMatches !== rightMatches) return rightMatches - leftMatches;
        return right.member_count - left.member_count;
      });

    if (!searchTerm.trim()) {
      return sortByInterestMatch(groups).slice(0, 10); // Show first 10 if no search
    }

    const term = searchTerm.toLowerCase();
    return sortByInterestMatch(
      groups.filter(group => {
        return (
          group.name?.toLowerCase().includes(term) ||
          group.description?.toLowerCase().includes(term) ||
          group.location?.toLowerCase().includes(term) ||
          group.hashtags?.some(tag => tag.toLowerCase().includes(term))
        );
      })
    );
  }, [groups, searchTerm]);

  const selectedGroupIds = useMemo(
    () => new Set(selectedGroups.map(group => group.id)),
    [selectedGroups]
  );

  const mappableGroups = useMemo(
    () => filteredGroups.filter(hasMappableCoordinates),
    [filteredGroups]
  );

  const activeGroup =
    filteredGroups.find(group => group.id === activeGroupId) ??
    selectedGroups.find(group => group.id === activeGroupId) ??
    selectedGroups[0] ??
    null;

  const handleSelectGroup = (group: Group) => {
    onActiveGroupChange(group.id);
    onToggleGroup(group);
  };

  const handleActivateGroup = (groupId: string | null) => {
    onActiveGroupChange(groupId);
  };

  const handleSkip = () => {
    onClearSelectedGroups();
    onNext();
  };
  return {
    selectedGroups,
    selectedGroupIds,
    activeGroupId,
    activeGroup,
    hasSelectedGroups: selectedGroups.length > 0,
    mappableGroups,
    unmappableGroupCount: filteredGroups.length - mappableGroups.length,
    onClearSelectedGroups,
    onNext,
    onBack,
    isLoading,
    t,
    searchTerm,
    setSearchTerm,
    groupsData,
    groupsLoading,
    filteredGroups,
    handleSelectGroup,
    handleActivateGroup,
    handleSkip,
  };
}
