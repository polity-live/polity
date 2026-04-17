import { createFileRoute } from '@tanstack/react-router'
import { EventNetworkFlow } from '@/features/network/ui/EventNetworkFlow'

export const Route = createFileRoute('/_authed/event/$id/network')({
  component: EventNetworkPage,
})

function EventNetworkPage() {
  const { id } = Route.useParams()
  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[24rem]">
      <EventNetworkFlow eventId={id} />
    </div>
  )
}
