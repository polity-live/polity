import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { EventPresentation } from '@/features/agendas/ui/EventPresentation';
export const Route = createFileRoute('/_authed/event/$id/presentation')({
  validateSearch: z.object({
    mode: z.enum(['studio', 'agenda', 'speakers']).optional(),
    regie: z
      .union([z.boolean(), z.literal('true'), z.literal('false')])
      .transform(v => v === true || v === 'true')
      .optional(),
  }),
  component: PresentationPage,
});
function PresentationPage() {
  const { id } = Route.useParams();
  const { mode, regie } = Route.useSearch();
  return <EventPresentation eventId={id} initialMode={mode} regie={regie} />;
}
