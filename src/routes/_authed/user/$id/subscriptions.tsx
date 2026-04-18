import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUserSubscriptions } from '@/features/payments/hooks/useUserSubscriptions'
import { useSubscriptionsFilters } from '@/features/payments/hooks/useSubscriptionsFilters'
import { SubscriptionTypeFilters } from '@/features/payments/ui/SubscriptionTypeFilters'
import { SubscriptionsTable } from '@/features/payments/ui/SubscriptionsTable'
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar'

export const Route = createFileRoute('/_authed/user/$id/subscriptions')({
  component: UserSubscriptionsPage,
})

function UserSubscriptionsPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { subscriptions, subscribers, unsubscribe } = useUserSubscriptions(id)
  const {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filteredSubscriptions,
    subscriptionCounts,
  } = useSubscriptionsFilters({ subscriptions, subscribers })
  const hasActiveFilters = searchQuery.trim().length > 0 || filterType !== 'all'

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Subscriptions</h1>
      <EntitySearchBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        placeholder="Search subscriptions..."
      />
      <SubscriptionTypeFilters
        filterType={filterType}
        counts={subscriptionCounts}
        onFilterChange={setFilterType}
      />
      <SubscriptionsTable
        subscriptions={filteredSubscriptions}
        onUnsubscribe={unsubscribe}
        onNavigateToUser={(uid: string) => navigate({ to: '/user/$id', params: { id: uid } })}
        onNavigateToGroup={(gid: string) => navigate({ to: '/group/$id', params: { id: gid } })}
        onNavigateToAmendment={(aid: string) => navigate({ to: '/amendment/$id', params: { id: aid } })}
        onNavigateToEvent={(eid: string) => navigate({ to: '/event/$id', params: { id: eid } })}
        emptyMessage={
          hasActiveFilters ? 'No subscriptions match the current filters.' : undefined
        }
        onNavigateToBlog={(bid: string, groupId?: string | null) => {
          if (groupId) {
            navigate({ to: '/group/$id/blog/$entryId', params: { id: groupId, entryId: bid } })
          } else {
            navigate({ to: '/user/$id/blog/$entryId', params: { id, entryId: bid } })
          }
        }}
      />
    </div>
  )
}
