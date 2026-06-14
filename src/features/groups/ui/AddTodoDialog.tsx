'use client';

import {
  FormControlInput,
  FormControlTextarea,
  FormControlLabel,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Plus } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AddTodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
  }) => void;
}

export function AddTodoDialog({ open, onOpenChange, onSubmit }: AddTodoDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, priority, dueDate });
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0632_add_task_44e578a5')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent>
        <form onSubmit={handleSubmit}>
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
                onChange={e => setTitle(e.target.value)}
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
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="todo-priority">
                {translateText('generated.inline.0637_priority_886cbff9')}
              </FormControlLabel>
              <FormControlSelect value={priority} onValueChange={setPriority}>
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
            <div className="space-y-2">
              <FormControlLabel htmlFor="todo-dueDate">
                {translateText('generated.inline.0642_due_date_optional_5908e2f2')}
              </FormControlLabel>
              <FormControlInput
                id="todo-dueDate"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
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
