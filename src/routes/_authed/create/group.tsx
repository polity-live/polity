import { createFileRoute } from '@tanstack/react-router';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateGroupForm } from '@/features/create/hooks/useCreateGroupForm';
import { useCreatePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/create/group')({
  component: CreateGroupPage,
});

function CreateGroupPage() {
  useCreatePreloads();
  const config = useCreateGroupForm();
  return <CreateFormShell config={config} />;
}
