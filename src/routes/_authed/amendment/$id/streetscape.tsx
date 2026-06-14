import { createFileRoute } from '@tanstack/react-router';
import { StreetDesignPage } from '@/features/amendments/streetscape/StreetDesignPage';

export const Route = createFileRoute('/_authed/amendment/$id/streetscape')({
  component: AmendmentStreetDesignRoute,
});

function AmendmentStreetDesignRoute() {
  const { id } = Route.useParams();
  return <StreetDesignPage amendmentId={id} />;
}
