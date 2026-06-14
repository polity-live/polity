import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent, CardHeader } from '@/features/shared/ui/ui/card';
import { ShareButton } from '@/features/shared/ui/action-buttons/ShareButton.tsx';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { TodoDetailHeader } from './ui/TodoDetailHeader';
import { TodoDetailView } from './ui/TodoDetailView';
import { TodoDetailEdit } from './ui/TodoDetailEdit';
import { AccessDenied } from '@/features/auth/ui/AccessDenied';
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
}: TodoDetailPageViewProps) {
  if (!todo) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">{t('features.todos.detail.notFound')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('features.todos.detail.noAccessDescription')}
        </p>
        <Link to="/todos">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('features.todos.detail.backToTodos')}
          </Button>
        </Link>
      </div>
    );
  }

  if (!canAccess) {
    return <AccessDenied />;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Link to="/todos">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('features.todos.detail.backToTodos')}
          </Button>
        </Link>
        <ShareButton
          url={`/todos/${todoId}`}
          title={todo.title || 'Todo'}
          variant="outline"
          size="sm"
        />
      </div>

      <Card>
        <CardHeader>
          <TodoDetailHeader
            isEditing={isEditing}
            isSaving={isSaving}
            title={todo.title ?? ''}
            formTitle={formData.title}
            onEdit={() => setIsEditing(true)}
            onSave={handleSave}
            onCancel={handleCancel}
            onTitleChange={handleTitleChange}
          />
        </CardHeader>

        <CardContent>
          {isEditing ? (
            <TodoDetailEdit formData={formData} onUpdate={handleFormUpdate} />
          ) : (
            <TodoDetailView todo={todo} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
