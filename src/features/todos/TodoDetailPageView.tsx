import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader } from '@/features/shared/ui/ui/card';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { TodoDetailHeader } from './ui/TodoDetailHeader';
import { TodoDetailView } from './ui/TodoDetailView';
import { TodoDetailEdit } from './ui/TodoDetailEdit';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
import { CommentThread } from '@/features/shared/ui/comments';
import type { TodoDiscussionController } from './hooks/useTodoDiscussion';
import { TodoArchiveAction, TodoArchiveBadge } from './ui/TodoArchiveAction';
import { BookOpen, Bot, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { resolveAppTutorialFixtureValue } from '@/features/app-tutorial/fixture-copy';
import { getTodoTutorialAnchor } from './logic/tutorialTodoAnchor';
export interface TodoDetailPageViewProps {
  todoId: any;
  t: any;
  todo: any;
  canAccess: any;
  isEditing: any;
  isSaving: any;
  formData: any;
  setIsEditing: any;
  handleSave: any;
  handleCancel: any;
  handleTitleChange: any;
  handleFormUpdate: any;
  discussion: TodoDiscussionController;
  canManageTodos: boolean;
  isArchiving: boolean;
  handleArchive: () => void;
  handleUnarchive: () => void;
}

export function TodoDetailPageView({
  todoId,
  t,
  todo,
  canAccess,
  isEditing,
  isSaving,
  formData,
  setIsEditing,
  handleSave,
  handleCancel,
  handleTitleChange,
  handleFormUpdate,
  discussion,
  canManageTodos,
  isArchiving,
  handleArchive,
  handleUnarchive,
}: TodoDetailPageViewProps) {
  const { language } = useTranslation();
  if (!todo) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">{t('features.todos.detail.notFound')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('features.todos.detail.noAccessDescription')}
        </p>
        <Button asChild data-action-id="todos.detail.not-found.back">
          <Link to="/todos" data-action-id="todos.detail.not-found.back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('features.todos.detail.backToTodos')}
          </Link>
        </Button>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  const displayTodo = resolveAppTutorialFixtureValue(todo, {
    tutorialRunId: todo.tutorial_run_id,
    language,
  });
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" data-action-id="todos.detail.back">
          <Link to="/todos" data-action-id="todos.detail.back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('features.todos.detail.backToTodos')}
          </Link>
        </Button>
        <ShareButton
          data-action-id="todos.detail.share"
          url={`/todos/${todoId}`}
          title={displayTodo.title || t('common.entities.todo')}
          variant="outline"
          size="sm"
        />
      </div>

      <Card
        data-tutorial-anchor={
          getTodoTutorialAnchor(todo) === 'tutorial-assistant-todo'
            ? 'todo-status-in-progress'
            : getTodoTutorialAnchor(todo)
              ? 'todo-complete'
              : undefined
        }
      >
        <CardHeader>
          {todo.archived_at ? (
            <div className="mb-2">
              <TodoArchiveBadge />
            </div>
          ) : null}
          <TodoDetailHeader
            isEditing={isEditing}
            isSaving={isSaving}
            title={displayTodo.title ?? ''}
            formTitle={formData.title}
            onEdit={() => setIsEditing(true)}
            onSave={handleSave}
            onCancel={handleCancel}
            onTitleChange={handleTitleChange}
            canEdit={canManageTodos}
            archiveAction={
              <TodoArchiveAction
                archived={Boolean(todo.archived_at)}
                canManage={canManageTodos}
                completed={todo.status === 'completed'}
                isPending={isArchiving}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
              />
            }
          />
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <TodoDetailEdit
              formData={formData}
              onUpdate={handleFormUpdate}
              isTutorialTodo={Boolean(todo.tutorial_run_id)}
            />
          ) : (
            <TodoDetailView todo={displayTodo} />
          )}
        </CardContent>
      </Card>

      {!isEditing ? (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <CommentThread
              comments={discussion.comments}
              currentUserId={discussion.currentUserId}
              onAddComment={discussion.onAddComment}
              onVote={discussion.onVote}
              isSubmitting={discussion.isSubmitting}
              linkAuthors
            />
          </CardContent>
        </Card>
      ) : null}

      {todo.tutorial_run_id ? (
        <Card className="mt-6" data-tutorial-anchor="tutorial-help-links">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
            <Link to="/messages" className="flex items-center gap-2 text-sm hover:underline">
              <Bot className="h-4 w-4" />
              {t('features.todos.helpLinks.assistant')}
            </Link>
            <Link
              to="/user/$id/settings"
              params={{ id: todo.creator_id }}
              className="flex items-center gap-2 text-sm hover:underline"
            >
              <RotateCcw className="h-4 w-4" />
              {t('features.todos.helpLinks.tutorial')}
            </Link>
            <Link to="/docs" className="flex items-center gap-2 text-sm hover:underline">
              <BookOpen className="h-4 w-4" />
              {t('features.todos.helpLinks.docs')}
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
