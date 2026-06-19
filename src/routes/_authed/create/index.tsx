import { createFileRoute } from '@tanstack/react-router';
import { CreateDashboard } from '@/features/create/ui/CreateDashboard';
import { useCreatePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/create/')({
  component: CreateIndexPage,
});

function CreateIndexPage() {
  useCreatePreloads();
  return <CreateDashboard />;
}
