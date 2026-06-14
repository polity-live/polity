'use client';

import { useAriaKaiMessageActionsController } from '../hooks/useAriaKaiMessageActionsController';
import { AriaKaiMessageActionsView } from './AriaKaiMessageActionsView';

interface AriaKaiMessageActionsProps {
  conversationId: string;
  currentUserId: string;
}

export function AriaKaiMessageActions({
  conversationId,
  currentUserId,
}: AriaKaiMessageActionsProps) {
  const controller = useAriaKaiMessageActionsController({ conversationId, currentUserId });

  return (
    <AriaKaiMessageActionsView
      isLoading={controller.isLoading}
      topics={controller.topics}
      tutorialStep={controller.tutorialStep}
      overviewAction={controller.overviewAction}
      onShowMeClick={controller.handleShowMeClick}
      onTopicClick={controller.handleTopicClick}
    />
  );
}
