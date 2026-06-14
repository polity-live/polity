import {
  ENTITY_TUTORIAL_ACTIONS,
  type EntityTutorialTopic,
} from '@/features/assistant/constants.ts';
import { useAriaKaiTutorialActions } from '@/features/assistant/hooks/useAriaKaiTutorialActions.ts';

interface UseAriaKaiMessageActionsControllerProps {
  conversationId: string;
  currentUserId: string;
}

export function useAriaKaiMessageActionsController({
  conversationId,
  currentUserId,
}: UseAriaKaiMessageActionsControllerProps) {
  const { handleShowMeClick, handleTopicClick, isLoading, topics, tutorialStep } =
    useAriaKaiTutorialActions({
      conversationId,
      currentUserId,
    });

  return {
    isLoading,
    topics,
    tutorialStep,
    overviewAction: ENTITY_TUTORIAL_ACTIONS.overview,
    handleShowMeClick,
    handleTopicClick: (topic: EntityTutorialTopic) => handleTopicClick(topic),
  };
}
