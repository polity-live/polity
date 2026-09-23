import { z } from 'zod';
import { createFileRoute } from '@tanstack/react-router';
import { CityDesignPage } from '@/features/amendments/city-design/CityDesignPage';

export const Route = createFileRoute('/_authed/amendment/$id/citydesign')({
  validateSearch: z.object({
    conversationId: z.string().uuid().optional(),
    branch: z.string().uuid().optional(),
  }),
  component: AmendmentCityDesignRoute,
});

function AmendmentCityDesignRoute() {
  const { id } = Route.useParams();
  const { conversationId, branch } = Route.useSearch();
  return <CityDesignPage amendmentId={id} conversationId={conversationId} branchId={branch} />;
}
