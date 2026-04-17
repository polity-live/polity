import { createFileRoute } from '@tanstack/react-router'
import { UserNetworkFlow } from '@/features/network/ui/UserNetworkFlow'

export const Route = createFileRoute('/_authed/user/$id/network')({
  component: UserNetworkPage,
})

function UserNetworkPage() {
  const { id } = Route.useParams()

  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[24rem]">
      <UserNetworkFlow userId={id} />
    </div>
  )
}
