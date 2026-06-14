import { BadgeControl } from '@/features/shared/ui/status';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Calendar, Tag, Users, Building2, AlertTriangle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Todo, TodoStatus, TodoPriority } from '../types/todo.types';
import { formatTodoDate, formatTodoDateTime, isOverdue } from '../utils/todoFormatters';
import { TodoStatusIcon } from './TodoStatusIcon';
import { TodoPriorityBadge, TodoPriorityIcon } from './TodoPriorityBadge';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface TodoDetailViewProps {
  todo: Todo;
}

export function TodoDetailView({ todo }: TodoDetailViewProps) {
  const todoIsOverdue = isOverdue(todo.due_date ?? undefined, todo.status ?? '');

  return (
    <div className="space-y-6">
      {/* Status and Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            {translateText('generated.inline.0688_status_bae7d5be')}
          </label>
          <div className="flex items-center gap-2">
            <TodoStatusIcon status={(todo.status ?? 'pending') as TodoStatus} />
            <span className="capitalize">{(todo.status ?? '').replace('_', ' ')}</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            {translateText('generated.inline.0637_priority_886cbff9')}
          </label>
          <div className="flex items-center gap-2">
            <TodoPriorityIcon priority={(todo.priority ?? 'medium') as TodoPriority} />
            <TodoPriorityBadge priority={(todo.priority ?? 'medium') as TodoPriority} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {translateText('generated.inline.0030_description_55f8ebc8')}
        </label>
        <p className="text-muted-foreground text-sm">
          {todo.description ||
            translateText('generated.inline.0145_no_description_provided_2145e21d')}
        </p>
      </div>

      {/* Due Date */}
      <div>
        <label className="mb-2 block text-sm font-medium">
          {translateText('generated.inline.1171_due_date_a1b308ec')}
        </label>
        {todo.due_date ? (
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span className={todoIsOverdue ? 'text-destructive font-medium' : ''}>
              {formatTodoDate(todo.due_date)}
            </span>
            {todoIsOverdue && (
              <BadgeControl variant="destructive" className="ml-2">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {translateText('generated.inline.1173_overdue_07217c77')}
              </BadgeControl>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {translateText('generated.inline.1174_no_due_date_set_7ae77ef5')}
          </p>
        )}
      </div>

      {/* Creator */}
      {todo.creator && (
        <div>
          <label className="mb-2 block text-sm font-medium">
            {translateText('generated.inline.1175_created_by_43de2bcd')}
          </label>
          <Link
            to="/user/$id"
            params={{ id: todo.creator.id }}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={todo.creator.avatar ?? undefined} />
              <AvatarFallback>{todo.creator.email?.[0]?.toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
            <span>
              {todo.creator.email?.split('@')[0] ||
                translateText('generated.inline.0031_unknown_bc7819b3')}
            </span>
          </Link>
        </div>
      )}

      {/* Assigned Users */}
      {todo.assignments && todo.assignments.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-medium">
            <Users className="mr-2 inline h-4 w-4" />
            {translateText('generated.inline.1176_assigned_to_d00c2e68')}
          </label>
          <div className="space-y-2">
            {todo.assignments.map((assignment, idx) => (
              <Link
                key={idx}
                to="/user/$id"
                params={{ id: assignment.user?.id ?? '' }}
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={assignment.user?.avatar ?? undefined} />
                  <AvatarFallback>
                    {assignment.user?.email?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span>
                  {assignment.user?.email?.split('@')[0] ||
                    translateText('generated.inline.0031_unknown_bc7819b3')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Group */}
      {todo.group && (
        <div>
          <label className="mb-2 block text-sm font-medium">
            <Building2 className="mr-2 inline h-4 w-4" />
            {translateText('generated.inline.0608_group_171a0606')}
          </label>
          <Link
            to="/group/$id"
            params={{ id: todo.group.id }}
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={todo.group.image_url ?? undefined} />
              <AvatarFallback>{todo.group.name?.[0]?.toUpperCase() || 'G'}</AvatarFallback>
            </Avatar>
            <span>{todo.group.name}</span>
          </Link>
        </div>
      )}

      {/* Tags */}
      {todo.tags && todo.tags.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-medium">
            <Tag className="mr-2 inline h-4 w-4" />
            {translateText('generated.inline.1177_tags_848eed0f')}
          </label>
          <div className="flex flex-wrap gap-2">
            {todo.tags.map((tag, idx) => (
              <BadgeControl key={idx} variant="secondary">
                {tag}
              </BadgeControl>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-muted-foreground border-t pt-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div>
            {translateText('generated.inline.0084_created_0c78dab1')}
            {todo.created_at ? formatTodoDateTime(todo.created_at) : 'N/A'}
          </div>
          <div>
            {translateText('generated.inline.0413_updated_702cad2f')}
            {todo.updated_at ? formatTodoDateTime(todo.updated_at) : 'N/A'}
          </div>
          {todo.completed_at && (
            <div className="col-span-2">
              {translateText('generated.inline.1178_completed_208409ff')}
              {formatTodoDateTime(todo.completed_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
