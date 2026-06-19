import { createFileRoute } from '@tanstack/react-router';
import { ModernTimeline } from '@/features/timeline';
import { useHomePreloads } from '@/zero/preloads';

export const Route = createFileRoute('/_authed/home')({
  component: HomeRoute,
});

function HomeRoute() {
  useHomePreloads();
  return <ModernTimeline />;
}
