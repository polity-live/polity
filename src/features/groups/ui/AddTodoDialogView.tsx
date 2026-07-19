import { Plus } from 'lucide-react';

import {
  FormControlInput,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
  FormControlTextarea,
} from '@/features/shared/ui/form';
import { TodoDeadlineInput } from '@/features/create/ui/inputs/TodoDeadlineInput';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';

interface AddTodoDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  priority: string;
  dueDate: string;
  dueTime: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onDueTimeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export function AddTodoDialogView({
  open,
  onOpenChange,
  title,
  description,
  priority,
  dueDate,
  dueTime,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onDueDateChange,
  onDueTimeChange,
  onSubmit,
}: AddTodoDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0632_add_task_44e578a5')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0633_add_new_task_23c82a1c')}
            </DialogTitle>
            <DialogDescription>
              {translateText('generated.inline.0634_create_a_new_task_for_this_group_0de7c3e2')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <FormControlLabel htmlFor="todo-title">
                {translateText('generated.inline.0028_title_768e0c1c')}
              </FormControlLabel>
              <FormControlInput
                id="todo-title"
                placeholder={translateText('generated.inline.0635_task_title_624d94d8')}
                value={title}
                onChange={event => onTitleChange(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="todo-description">
                {translateText('generated.inline.0030_description_55f8ebc8')}
              </FormControlLabel>
              <FormControlTextarea
                id="todo-description"
                placeholder={translateText(
                  'generated.inline.0636_task_description_optional_e457f179'
                )}
                value={description}
                onChange={event => onDescriptionChange(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="todo-priority">
                {translateText('generated.inline.0637_priority_886cbff9')}
              </FormControlLabel>
              <FormControlSelect value={priority} onValueChange={onPriorityChange}>
                <FormControlSelectTrigger id="todo-priority">
                  <FormControlSelectValue />
                </FormControlSelectTrigger>
                <FormControlSelectContent>
                  <FormControlSelectItem value="low">
                    {translateText('generated.inline.0638_low_a124947c')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="medium">
                    {translateText('generated.inline.0639_medium_d404968e')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="high">
                    {translateText('generated.inline.0640_high_b1a5954a')}
                  </FormControlSelectItem>
                  <FormControlSelectItem value="urgent">
                    {translateText('generated.inline.0641_urgent_ecb26f46')}
                  </FormControlSelectItem>
                </FormControlSelectContent>
              </FormControlSelect>
            </div>
            <TodoDeadlineInput
              dueDate={dueDate}
              dueTime={dueTime}
              onChange={values => {
                onDueDateChange(values.dueDate);
                onDueTimeChange(values.dueTime);
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit">
              {translateText('generated.inline.0632_add_task_44e578a5')}
            </Button>
          </DialogFooter>
        </form>
      </ScrollableDialogContent>
    </Dialog>
  );
}
