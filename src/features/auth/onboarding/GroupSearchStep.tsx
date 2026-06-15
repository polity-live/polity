'use client';

import type { Group } from '../hooks/useOnboarding.ts';

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
import { useGroupSearchStepController } from './useGroupSearchStepController';
import { GroupSearchStepView } from './GroupSearchStepView';

export function GroupSearchStep({
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
  const viewProps = useGroupSearchStepController({
    selectedGroups,
    interestTags,
    activeGroupId,
    onToggleGroup,
    onActiveGroupChange,
    onClearSelectedGroups,
    onNext,
    onBack,
    isLoading,
  });

  return <GroupSearchStepView {...viewProps} />;
}
