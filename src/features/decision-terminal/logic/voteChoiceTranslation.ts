/**
 * Vote choice label translation logic
 * Maps semantic keys and labels to translated choice labels
 */

import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface VoteChoice {
  id: string;
  label?: string | null;
  semantic_key?: string | null;
}

/**
 * Translate a vote choice label based on semantic_key and label
 * Priority: semantic_key translation > label translation > fallback label
 */
export function translateVoteChoiceLabel(choice: VoteChoice, index: number): string {
  // If there's a semantic_key, try to translate it
  if (choice.semantic_key) {
    const semanticKey = choice.semantic_key.toLowerCase();

    // Common semantic keys for votes
    if (semanticKey === 'support' || semanticKey === 'accept') {
      return translateText('features.timeline.terminal.support', 'Support');
    }
    if (semanticKey === 'oppose' || semanticKey === 'reject') {
      return translateText('features.timeline.terminal.oppose', 'Oppose');
    }
    if (semanticKey === 'abstain') {
      return translateText('features.timeline.terminal.abstain', 'Abstain');
    }
  }

  // If there's a label, try to translate it based on the label value
  if (choice.label) {
    const labelLower = choice.label.toLowerCase();

    // Handle common English labels
    if (labelLower === 'support' || labelLower === 'accept' || labelLower === 'in favor') {
      return translateText('features.timeline.terminal.support', 'Support');
    }
    if (labelLower === 'oppose' || labelLower === 'reject' || labelLower === 'against') {
      return translateText('features.timeline.terminal.oppose', 'Oppose');
    }
    if (labelLower === 'abstain' || labelLower === 'abstention') {
      return translateText('features.timeline.terminal.abstain', 'Abstain');
    }

    // If no match, return the label as is
    return choice.label;
  }

  // Fallback to choice position
  return `Choice ${index + 1}`;
}
