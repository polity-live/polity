import { createFileRoute } from '@tanstack/react-router';
import { CityDesignPage } from '@/features/amendments/city-design/CityDesignPage';

export const Route = createFileRoute('/_authed/amendment/$id/citydesign')({
  component: AmendmentCityDesignRoute,
});

function AmendmentCityDesignRoute() {
  const { id } = Route.useParams();
  return <CityDesignPage amendmentId={id} />;
}
