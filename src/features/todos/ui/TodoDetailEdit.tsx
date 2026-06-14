import {
  FormControlInput,
  FormControlTextarea,
  FormControlSelect,
  FormControlSelectContent,
  FormControlSelectItem,
  FormControlSelectTrigger,
  FormControlSelectValue,
} from '@/features/shared/ui/form';
import { Circle, Clock, CheckCircle2, XCircle, Flag, AlertCircle } from 'lucide-react';
import { TodoFormData, TodoStatus, TodoPriority } from '../types/todo.types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface TodoDetailEditProps {
  formData: TodoFormData;
  onUpdate: (updates: Partial<TodoFormData>) => void;
}

export function TodoDetailEdit({ formData, onUpdate }: TodoDetailEditProps) {
  return (
    <div className="space-y-6">
      {/* Status and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            {translateText('generated.inline.0688_status_bae7d5be')}
          </label>
          <FormControlSelect
            value={formData.status}
            onValueChange={(v: TodoStatus) => onUpdate({ status: v })}
          >
            <FormControlSelectTrigger>
              <FormControlSelectValue />
            </FormControlSelectTrigger>
            <FormControlSelectContent>
              <FormControlSelectItem value="pending">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4" />
                  {translateText('generated.inline.0370_pending_96f608c1')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="in_progress">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {translateText('generated.inline.1168_in_progress_f61eadaf')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="completed">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {translateText('generated.inline.0057_completed_1798b3ba')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="cancelled">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {translateText('generated.inline.1169_cancelled_a1bf92ef')}
                </div>
              </FormControlSelectItem>
            </FormControlSelectContent>
          </FormControlSelect>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            {translateText('generated.inline.0637_priority_886cbff9')}
          </label>
          <FormControlSelect
            value={formData.priority}
            onValueChange={(v: TodoPriority) => onUpdate({ priority: v })}
          >
            <FormControlSelectTrigger>
              <FormControlSelectValue />
            </FormControlSelectTrigger>
            <FormControlSelectContent>
              <FormControlSelectItem value="low">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-blue-500" />
                  {translateText('generated.inline.0638_low_a124947c')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="medium">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-yellow-500" />
                  {translateText('generated.inline.0639_medium_d404968e')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="high">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-orange-500" />
                  {translateText('generated.inline.0640_high_b1a5954a')}
                </div>
              </FormControlSelectItem>
              <FormControlSelectItem value="urgent">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  {translateText('generated.inline.0641_urgent_ecb26f46')}
                </div>
              </FormControlSelectItem>
            </FormControlSelectContent>
          </FormControlSelect>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {translateText('generated.inline.0030_description_55f8ebc8')}
        </label>
        <FormControlTextarea
          value={formData.description}
          onChange={e => onUpdate({ description: e.target.value })}
          placeholder={translateText('generated.inline.1170_add_a_description_8c1d830e')}
          rows={6}
        />
      </div>

      {/* Due Date */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {translateText('generated.inline.1171_due_date_a1b308ec')}
        </label>
        <FormControlInput
          type="date"
          value={formData.dueDate}
          onChange={e => onUpdate({ dueDate: e.target.value })}
        />
      </div>
    </div>
  );
}
