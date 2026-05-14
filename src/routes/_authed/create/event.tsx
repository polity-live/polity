import { createFileRoute } from '@tanstack/react-router';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateEventForm } from '@/features/create/hooks/useCreateEventForm';
import { createEventSearchSchema } from '@/features/create/logic/createEventSearch';

export const Route = createFileRoute('/_authed/create/event')({
  validateSearch: createEventSearchSchema,
  component: CreateEventPage,
});

function CreateEventPage() {
  const config = useCreateEventForm();
  return <CreateFormShell config={config} />;
}
