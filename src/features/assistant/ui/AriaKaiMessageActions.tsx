'use client';

import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  ENTITY_TUTORIAL_ACTIONS,
  type EntityTutorialTopic,
} from '@/features/assistant/constants.ts';
import { useAriaKaiTutorialActions } from '@/features/assistant/hooks/useAriaKaiTutorialActions.ts';
import { Users, Calendar, FileEdit, BookOpen, Vote, Sparkles } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';

interface AriaKaiMessageActionsProps {
  conversationId: string;
  currentUserId: string;
}

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  groups: <Users className="h-4 w-4" />,
  events: <Calendar className="h-4 w-4" />,
  amendments: <FileEdit className="h-4 w-4" />,
  blogs: <BookOpen className="h-4 w-4" />,
  elections: <Vote className="h-4 w-4" />,
};

export function AriaKaiMessageActions({
  conversationId,
  currentUserId,
}: AriaKaiMessageActionsProps) {
  const { t } = useTranslation();
  const { handleShowMeClick, handleTopicClick, isLoading, topics, tutorialStep } =
    useAriaKaiTutorialActions({
      conversationId,
      currentUserId,
    });

  return (
    <div className="mt-3 space-y-2">
      {/* Show "Show me" button if tutorial hasn't started */}
      {tutorialStep === 0 && (
        <Button
          onClick={() => void handleShowMeClick()}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="min-w-[140px] flex-1 sm:flex-initial"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {t(ENTITY_TUTORIAL_ACTIONS.overview.labelKey)}
        </Button>
      )}

      {/* Show topic buttons if overview has been shown */}
      {tutorialStep > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map(topic => (
            <Button
              key={topic}
              onClick={() => void handleTopicClick(topic as EntityTutorialTopic)}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="min-w-[140px] flex-1 sm:flex-initial"
            >
              {TOPIC_ICONS[topic]}
              <span className="ml-2">{t(ENTITY_TUTORIAL_ACTIONS[topic].labelKey)}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
