import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useTodoDetailPage } from './hooks/useTodoDetailPage';

interface TodoDetailPageProps {
  todoId: string;
}
import { TodoDetailPageView } from './TodoDetailPageView';
export function TodoDetailPage({ todoId }: TodoDetailPageProps) {
  const { t } = useTranslation();
  const {
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
    activity,
    canManageTodos,
    isArchiving,
    handleArchive,
    handleUnarchive,
  } = useTodoDetailPage(todoId);
  return (
    <TodoDetailPageView
      todoId={todoId}
      t={t}
      todo={todo}
      canAccess={canAccess}
      isEditing={isEditing}
      isSaving={isSaving}
      formData={formData}
      setIsEditing={setIsEditing}
      handleSave={handleSave}
      handleCancel={handleCancel}
      handleTitleChange={handleTitleChange}
      handleFormUpdate={handleFormUpdate}
      discussion={discussion}
      activity={activity}
      canManageTodos={canManageTodos}
      isArchiving={isArchiving}
      handleArchive={handleArchive}
      handleUnarchive={handleUnarchive}
    />
  );
}
