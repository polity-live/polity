import { useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import { useMessageActions } from '@/zero/messages/useMessageActions.ts';
import { useUserState } from '@/zero/users/useUserState.ts';
import { useUserActions } from '@/zero/users/useUserActions.ts';
import {
  ENTITY_DESCRIPTIONS,
  ENTITY_TUTORIAL_ACTIONS,
  ENTITY_TUTORIAL_TOPICS,
  type EntityTopic,
  type EntityTutorialTopic,
} from '../constants.ts';

interface UseAriaKaiTutorialActionsOptions {
  conversationId: string;
  currentUserId: string;
}

function formatAssistantReply(topic: EntityTopic): string {
  const description = ENTITY_DESCRIPTIONS[topic];

  if (topic === 'overview') {
    return description.message;
  }

  return `**${description.title}**\n\n${description.message}`;
}

export function useAriaKaiTutorialActions({
  conversationId,
  currentUserId,
}: UseAriaKaiTutorialActionsOptions) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage, sendAssistantMessage } = useMessageActions();
  const { updateProfile } = useUserActions();
  const { user: currentUser } = useUserState({ userId: currentUserId });

  const tutorialStep = currentUser?.tutorial_step ?? 0;

  const runTutorialAction = async (topic: EntityTopic) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const action = ENTITY_TUTORIAL_ACTIONS[topic];

      await sendMessage({
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        content: t(action.labelKey),
        context_json: '[]',
        deleted_at: 0,
      });

      await sendAssistantMessage({
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        content: formatAssistantReply(topic),
        context_json: '[]',
        deleted_at: 0,
      });

      await updateProfile({
        id: currentUserId,
        tutorial_step: action.tutorial_step,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowMeClick = async () => runTutorialAction('overview');

  const handleTopicClick = async (topic: EntityTutorialTopic) => runTutorialAction(topic);

  return {
    handleShowMeClick,
    handleTopicClick,
    isLoading,
    topics: ENTITY_TUTORIAL_TOPICS,
    tutorialStep,
  };
}
