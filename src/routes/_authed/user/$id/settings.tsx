import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { UserEdit } from '@/features/users/ui/UserEdit'

const settingsSearchSchema = z.object({
  tab: z.string().optional(),
})

export const Route = createFileRoute('/_authed/user/$id/settings')({
  validateSearch: settingsSearchSchema,
  component: UserSettingsPage,
})

function UserSettingsPage() {
  const { id } = Route.useParams()
  const { tab } = Route.useSearch()
  return <UserEdit userId={id} defaultTab={tab} />
}
