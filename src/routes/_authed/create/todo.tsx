import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateTodoForm } from '@/features/create/hooks/useCreateTodoForm';

const createTodoSearchSchema = z.object({
  groupId: z.string().optional(),
  returnSection: z.literal('todos').optional(),
});

export const Route = createFileRoute('/_authed/create/todo')({
  validateSearch: createTodoSearchSchema,
  component: CreateTodoPage,
});

function CreateTodoPage() {
  const config = useCreateTodoForm();
  return <CreateFormShell config={config} />;
}
