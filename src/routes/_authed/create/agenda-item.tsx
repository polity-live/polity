import { createFileRoute } from '@tanstack/react-router';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateAgendaItemForm } from '@/features/create/hooks/useCreateAgendaItemForm';
import { useCreatePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/create/agenda-item')({
  component: CreateAgendaItemPage,
});

function CreateAgendaItemPage() {
  useCreatePreloads();
  const config = useCreateAgendaItemForm();
  return <CreateFormShell config={config} />;
}
