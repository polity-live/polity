'use client';

import type { Group } from '../hooks/useOnboarding.ts';

interface GroupSearchStepProps {
  selectedGroup: Group | null;
  onSelectGroup: (group: Group | null) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading?: boolean;
}
import { useGroupSearchStepController } from './useGroupSearchStepController';
import { GroupSearchStepView } from './GroupSearchStepView';

export function GroupSearchStep({
  selectedGroup,
  onSelectGroup,
  onNext,
  onBack,
  isLoading,
}: GroupSearchStepProps) {
  const viewProps = useGroupSearchStepController({
    selectedGroup,
    onSelectGroup,
    onNext,
    onBack,
    isLoading,
  });

  return <GroupSearchStepView {...viewProps} />;
}
