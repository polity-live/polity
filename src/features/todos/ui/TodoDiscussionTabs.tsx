import { useEffect, useState } from 'react';
import { Activity, MessageSquare } from 'lucide-react';

import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CommentThread } from '@/features/shared/ui/comments';
import type { TodoDiscussionController } from '../hooks/useTodoDiscussion';
import type { TodoActivityController, TodoActivitySeverityFilter } from '../hooks/useTodoActivity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ActivityLogView } from '@/features/shared/ui/wiki/ActivityLogView';

interface TodoDiscussionTabsProps {
  activity: TodoActivityController;
  discussion: TodoDiscussionController;
  resetKey: string;
}

function TodoActivityList({ activity }: { activity: TodoActivityController }) {
  return (
    <ActivityLogView
      activity={{
        activities: activity.activities,
        severity: activity.severity as TodoActivitySeverityFilter,
        setSeverity: activity.setSeverity,
        isLoading: activity.isLoading,
        hasMore: false,
        loadMore: activity.setSeverity.bind(null, activity.severity),
      }}
    />
  );
}

export function TodoDiscussionTabs({ activity, discussion, resetKey }: TodoDiscussionTabsProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('comments');

  useEffect(() => {
    setTab('comments');
  }, [resetKey]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="comments" data-action-id="todos.detail.tabs.comments">
          <MessageSquare className="mr-2 h-4 w-4" />
          {t('features.todos.activity.tabs.comments')}
        </TabsTrigger>
        {activity.canViewActivity ? (
          <TabsTrigger value="activity" data-action-id="todos.detail.tabs.activity">
            <Activity className="mr-2 h-4 w-4" />
            {t('features.todos.activity.tabs.activity')}
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="comments" className="pt-4">
        <CommentThread
          comments={discussion.comments}
          currentUserId={discussion.currentUserId}
          onAddComment={discussion.onAddComment}
          onVote={discussion.onVote}
          isSubmitting={discussion.isSubmitting}
          linkAuthors
        />
      </TabsContent>
      {activity.canViewActivity ? (
        <TabsContent value="activity" className="pt-4">
          <TodoActivityList activity={activity} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
