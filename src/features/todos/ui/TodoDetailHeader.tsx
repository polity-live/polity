import { FormControlInput } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Edit, Save, X } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface TodoDetailHeaderProps {
  isEditing: boolean;
  isSaving: boolean;
  title: string;
  formTitle?: string;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTitleChange?: (title: string) => void;
  canEdit?: boolean;
  archiveAction?: React.ReactNode;
}

export function TodoDetailHeader({
  isEditing,
  isSaving,
  title,
  formTitle,
  onEdit,
  onSave,
  onCancel,
  onTitleChange,
  canEdit = true,
  archiveAction,
}: TodoDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {isEditing ? (
          <FormControlInput
            value={formTitle}
            onChange={e => onTitleChange?.(e.target.value)}
            className="text-2xl font-bold"
            placeholder={translateText('generated.inline.1172_todo_title_c5e8306a')}
          />
        ) : (
          <h1 className="text-3xl font-bold">{title}</h1>
        )}
      </div>
      <div className="flex gap-2">
        {isEditing ? (
          <>
            <Button
              onClick={onSave}
              disabled={isSaving}
              size="sm"
              data-action-id="todos.detail-header.save"
            >
              <Save className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0269_save_efc007a3')}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              size="sm"
              disabled={isSaving}
              data-action-id="todos.detail-header.cancel"
            >
              <X className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
          </>
        ) : (
          <>
            {archiveAction}
            {canEdit ? (
              <Button
                onClick={onEdit}
                variant="outline"
                size="sm"
                data-action-id="todos.detail-header.edit"
              >
                <Edit className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0729_edit_5301648d')}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
