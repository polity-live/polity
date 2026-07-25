import { createFileRoute, Outlet } from '@tanstack/react-router';
import { DocsShell } from '@/features/docs/ui/DocsShell';

export const Route = createFileRoute('/docs')({
  component: DocsLayout,
});

function DocsLayout() {
  return (
    <DocsShell>
      <Outlet />
    </DocsShell>
  );
}
