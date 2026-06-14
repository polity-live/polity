'use client';

import { useSuggestionViewToggleController } from '@/features/editor/hooks/useSuggestionViewToggleController';
import type { TDiscussion } from '../types';

import { SuggestionViewToggleView } from './SuggestionViewToggleView';

interface SuggestionViewToggleProps {
  discussions: TDiscussion[];
  selectedCrIds: Set<string> | null;
  onSelectedCrIdsChange: (crIds: Set<string> | null) => void;
}

export function SuggestionViewToggle(props: SuggestionViewToggleProps) {
  const controller = useSuggestionViewToggleController(props);

  return <SuggestionViewToggleView selectedCrIds={props.selectedCrIds} {...controller} />;
}
