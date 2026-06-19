import { createFileRoute } from '@tanstack/react-router';
import { CreateFormShell } from '@/features/create/ui/CreateFormShell';
import { useCreateElectionCandidateForm } from '@/features/create/hooks/useCreateElectionCandidateForm';
import { useCreatePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/create/election-candidate')({
  component: CreateElectionCandidatePage,
});

function CreateElectionCandidatePage() {
  useCreatePreloads();
  const config = useCreateElectionCandidateForm();
  return <CreateFormShell config={config} />;
}
