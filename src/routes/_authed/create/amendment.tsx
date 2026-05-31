import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateAmendmentForm } from '@/features/create/hooks/useCreateAmendmentForm';

const createAmendmentSearchSchema = z.object({
  groupId: z.string().optional(),
});

export const Route = createFileRoute('/_authed/create/amendment')({
  validateSearch: createAmendmentSearchSchema,
  component: CreateAmendmentPage,
});

function CreateAmendmentPage() {
  const config = useCreateAmendmentForm();
  return <CreateFormShell config={config} />;
}
