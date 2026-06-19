import { createFileRoute } from '@tanstack/react-router';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateAmendmentForm } from '@/features/create/hooks/useCreateAmendmentForm';
import { createAmendmentSearchSchema } from '@/features/create/logic/createAmendmentSearch';
import { useCreatePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/create/amendment')({
  validateSearch: createAmendmentSearchSchema,
  component: CreateAmendmentPage,
});

function CreateAmendmentPage() {
  useCreatePreloads();
  const config = useCreateAmendmentForm();
  return <CreateFormShell config={config} />;
}
