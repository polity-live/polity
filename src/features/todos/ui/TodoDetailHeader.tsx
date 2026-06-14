import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
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
}: TodoDetailHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {isEditing ? (
          <Input
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
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0269_save_efc007a3')}
            </Button>
            <Button onClick={onCancel} variant="outline" size="sm" disabled={isSaving}>
              <X className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0065_cancel_77dfd213')}
            </Button>
          </>
        ) : (
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            {translateText('generated.inline.0729_edit_5301648d')}
          </Button>
        )}
      </div>
    </div>
  );
}
