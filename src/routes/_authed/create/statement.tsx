import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateStatementForm } from '@/features/create/hooks/useCreateStatementForm';

const createStatementSearchSchema = z.object({
  groupId: z.string().optional(),
});

export const Route = createFileRoute('/_authed/create/statement')({
  validateSearch: createStatementSearchSchema,
  component: CreateStatementPage,
});

function CreateStatementPage() {
  const config = useCreateStatementForm();
  return <CreateFormShell config={config} />;
}
