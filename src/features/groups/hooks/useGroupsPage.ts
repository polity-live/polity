import { useState, useMemo } from 'react';
import { useGroupState } from '@/zero/groups/useGroupState';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { richTextToPlainText } from '@/features/shared/logic/richText';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';

interface GroupDisplay {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  eventCount?: number;
  amendmentCount?: number;
  topics: string[];
}

function getAllGroupTags(groups: readonly GroupDisplay[]) {
  return [...new Set(groups.flatMap(group => group.topics))].sort();
}

function filterGroupDisplays(
  groups: readonly GroupDisplay[],
  searchTerm: string,
  selectedTags: readonly string[]
) {
  const normalizedSearch = searchTerm.toLowerCase();
  return groups.filter(group => {
    const matchesSearch =
      !searchTerm ||
      group.name.toLowerCase().includes(normalizedSearch) ||
      group.description?.toLowerCase().includes(normalizedSearch) ||
      group.topics.some(tag => tag.toLowerCase().includes(normalizedSearch));

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every(selectedTag =>
        group.topics.some(groupTag => groupTag.toLowerCase().includes(selectedTag.toLowerCase()))
      );

    return Boolean(matchesSearch && matchesTags);
  });
}

export const groupsPageInternals = { getAllGroupTags, filterGroupDisplays };

export function useGroupsPage() {
  const { t, language } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { searchResults, isLoading } = useGroupState({ includeSearch: true });

  const groups: GroupDisplay[] = useMemo(() => {
    const visibleGroups = (searchResults ?? []).filter(Boolean) as NonNullable<
      (typeof searchResults)[number]
    >[];

    return visibleGroups.map(group => {
      const displayGroup = resolveAppTutorialFixtureValue(group, {
        tutorialRunId: group.tutorial_run_id,
        language,
      });
      return {
        id: displayGroup.id,
        name: displayGroup.name ?? '',
        description: richTextToPlainText(displayGroup.description),
        memberCount: displayGroup.member_count ?? 0,
        eventCount: displayGroup.event_count ?? 0,
        amendmentCount: displayGroup.amendment_count ?? 0,
        topics: [],
      };
    });
  }, [language, searchResults]);

  const allTags = useMemo(() => {
    return getAllGroupTags(groups);
  }, [groups]);

  const filteredGroups = useMemo(
    () => filterGroupDisplays(groups, searchTerm, selectedTags),
    [groups, searchTerm, selectedTags]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
  };

  const hasActiveFilters = searchTerm !== '' || selectedTags.length > 0;

  return {
    t,
    isLoading,
    searchTerm,
    setSearchTerm,
    selectedTags,
    setSelectedTags,
    toggleTag,
    clearAllFilters,
    hasActiveFilters,
    allTags,
    filteredGroups,
  };
}
