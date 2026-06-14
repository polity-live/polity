import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  ENTITY_TUTORIAL_ACTIONS,
  type EntityTutorialTopic,
} from '@/features/assistant/constants.ts';
import { Users, Calendar, FileEdit, BookOpen, Vote, Sparkles } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation.ts';
import type React from 'react';

interface AriaKaiMessageActionsViewProps {
  isLoading: boolean;
  topics: readonly EntityTutorialTopic[];
  tutorialStep: number;
  overviewAction: { labelKey: string };
  onShowMeClick: () => Promise<void>;
  onTopicClick: (topic: EntityTutorialTopic) => Promise<void>;
}

const TOPIC_ICONS: Record<EntityTutorialTopic, React.ReactNode> = {
  groups: <Users className="h-4 w-4" />,
  events: <Calendar className="h-4 w-4" />,
  amendments: <FileEdit className="h-4 w-4" />,
  blogs: <BookOpen className="h-4 w-4" />,
  elections: <Vote className="h-4 w-4" />,
};

export function AriaKaiMessageActionsView({
  isLoading,
  topics,
  tutorialStep,
  overviewAction,
  onShowMeClick,
  onTopicClick,
}: AriaKaiMessageActionsViewProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-3 space-y-2">
      {tutorialStep === 0 ? (
        <Button
          onClick={() => void onShowMeClick()}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="min-w-[140px] flex-1 sm:flex-initial"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {t(overviewAction.labelKey)}
        </Button>
      ) : null}

      {tutorialStep > 0 ? (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic: EntityTutorialTopic) => (
            <Button
              key={topic}
              onClick={() => void onTopicClick(topic)}
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
      ) : null}
    </div>
  );
}
