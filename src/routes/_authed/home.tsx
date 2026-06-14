import { createFileRoute } from '@tanstack/react-router';
import { ModernTimeline } from '@/features/timeline';

export const Route = createFileRoute('/_authed/home')({
  component: HomeRoute,
});

function HomeRoute() {
  return <ModernTimeline />;
}
