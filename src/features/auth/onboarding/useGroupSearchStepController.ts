'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { usePublicGroups } from '@/zero/groups/useGroupState.ts';
import type { Group } from '../hooks/useOnboarding.ts';
import { buildLocationSearchValue, formatLocation } from '@/features/shared/logic/locationHelpers';
import { richTextToPlainText } from '@/features/shared/logic/richText';

interface GroupSearchStepProps {
  selectedGroup: Group | null;
  onSelectGroup: (group: Group | null) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}
export function useGroupSearchStepController({
  selectedGroup,
  onSelectGroup,
  onNext,
  onBack,
  isLoading,
}: GroupSearchStepProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  // Query all public groups via facade
  const { groups: groupsData, isLoading: groupsLoading } = usePublicGroups();

  // Filter groups based on search term
  const filteredGroups = useMemo(() => {
    const groups = groupsData ?? [];
    if (!searchTerm.trim()) {
      return groups.slice(0, 10); // Show first 10 if no search
    }

    const term = searchTerm.toLowerCase();
    return groups.filter(group => {
      const description = richTextToPlainText(group.description).toLowerCase();

      return (
        group.name?.toLowerCase().includes(term) ||
        description.includes(term) ||
        buildLocationSearchValue(group).includes(term)
      );
    });
  }, [groupsData, searchTerm]);

  const handleSelectGroup = (group: (typeof filteredGroups)[number]) => {
    const location = formatLocation(group);
    const description = richTextToPlainText(group.description);

    if (selectedGroup?.id === group.id) {
      onSelectGroup(null); // Deselect
    } else {
      onSelectGroup({
        id: group.id,
        name: group.name ?? '',
        description: description || undefined,
        member_count: group.member_count || 0,
        location: location || undefined,
        visibility: group.visibility ?? 'public',
      });
    }
  };

  const handleSkip = () => {
    onSelectGroup(null);
    onNext();
  };
  return {
    selectedGroup,
    onSelectGroup,
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
    handleSkip,
  };
}
