import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { createFileRoute } from '@tanstack/react-router';
import { useUserSubscriptions } from '@/features/payments/hooks/useUserSubscriptions';
import { useSubscriptionsFilters } from '@/features/payments/hooks/useSubscriptionsFilters';
import { SubscriptionTypeFilters } from '@/features/payments/ui/SubscriptionTypeFilters';
import { SubscriptionsTable } from '@/features/payments/ui/SubscriptionsTable';
import { EntitySearchBar } from '@/features/shared/ui/ui/entity-search-bar';

export const Route = createFileRoute('/_authed/user/$id/subscriptions')({
  component: UserSubscriptionsPage,
});

function UserSubscriptionsPage() {
  const { id } = Route.useParams();
  const { subscriptions, subscribers, unsubscribe } = useUserSubscriptions(id);
  const {
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filteredSubscriptions,
    subscriptionCounts,
  } = useSubscriptionsFilters({ subscriptions, subscribers });
  const hasActiveFilters = searchQuery.trim().length > 0 || filterType !== 'all';

  return (
    <>
      <h1 className="sr-only">{translateText('generated.inline.1271_subscriptions_5697fd85')}</h1>

      <div className="space-y-6">
        <div className="flex min-w-0 flex-col gap-3">
          <EntitySearchBar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            placeholder={translateText('generated.inline.1272_search_subscriptions_54112067')}
            className="w-full min-w-0"
          />
          <div className="w-full min-w-0">
            <SubscriptionTypeFilters
              filterType={filterType}
              counts={subscriptionCounts}
              onFilterChange={setFilterType}
            />
          </div>
        </div>
        <SubscriptionsTable
          subscriptions={filteredSubscriptions}
          onUnsubscribe={unsubscribe}
          getSubscriptionHref={subscription => {
            if (subscription.user?.id) return `/user/${subscription.user.id}`;
            if (subscription.group?.id) return `/group/${subscription.group.id}`;
            if (subscription.amendment?.id) return `/amendment/${subscription.amendment.id}`;
            if (subscription.event?.id) return `/event/${subscription.event.id}`;
            if (subscription.blog?.id) {
              return subscription.blog.group_id
                ? `/group/${subscription.blog.group_id}/blog/${subscription.blog.id}`
                : `/user/${id}/blog/${subscription.blog.id}`;
            }
            return null;
          }}
          emptyMessage={
            hasActiveFilters ? translateText('pages.user.subscriptions.noFilterResults') : undefined
          }
        />
      </div>
    </>
  );
}
