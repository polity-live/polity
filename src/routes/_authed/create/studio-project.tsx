import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateStudioProjectForm } from '@/features/create/hooks/useCreateStudioProjectForm';

export const Route = createFileRoute('/_authed/create/studio-project')({
  validateSearch: z.object({ groupId: z.string().uuid().optional() }),
  component: CreateStudioProjectPage,
});

function CreateStudioProjectPage() {
  const { groupId } = Route.useSearch();
  return <StudioProjectForm groupId={groupId ?? null} />;
}

function StudioProjectForm({ groupId }: { groupId: string | null }) {
  const config = useCreateStudioProjectForm(groupId);
  return <CreateFormShell config={config} />;
}
