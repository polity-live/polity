import { Tabs, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { ScrollableTabsList } from '@/features/shared/ui/navigation';
import { User, Users, Scale, Calendar, BookOpen } from 'lucide-react';
import type { FilterType, SubscriptionCounts } from '../hooks/useSubscriptionsFilters';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface SubscriptionTypeFiltersProps {
  filterType: FilterType;
  counts: SubscriptionCounts;
  onFilterChange: (type: FilterType) => void;
}

export function SubscriptionTypeFilters({
  filterType,
  counts,
  onFilterChange,
}: SubscriptionTypeFiltersProps) {
  return (
    <Tabs value={filterType} onValueChange={value => onFilterChange(value as FilterType)}>
      <ScrollableTabsList>
        <TabsTrigger
          data-action-id="payments.subscription-filter.all"
          value="all"
          className="flex items-center gap-2"
        >
          {translateText('generated.inline.1017_all_04a9acfe')}
          {counts.all})
        </TabsTrigger>
        <TabsTrigger
          data-action-id="payments.subscription-filter.users"
          value="users"
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          {translateText('generated.inline.1018_users_b5600c53')}
          {counts.users})
        </TabsTrigger>
        <TabsTrigger
          data-action-id="payments.subscription-filter.groups"
          value="groups"
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          {translateText('generated.inline.1019_groups_d288b2b2')}
          {counts.groups})
        </TabsTrigger>
        <TabsTrigger
          data-action-id="payments.subscription-filter.amendments"
          value="amendments"
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4" />
          {translateText('generated.inline.1020_amendments_cbfa89b3')}
          {counts.amendments})
        </TabsTrigger>
        <TabsTrigger
          data-action-id="payments.subscription-filter.events"
          value="events"
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          {translateText('generated.inline.1021_events_7e88b804')}
          {counts.events})
        </TabsTrigger>
        <TabsTrigger
          data-action-id="payments.subscription-filter.blogs"
          value="blogs"
          className="flex items-center gap-2"
        >
          <BookOpen className="h-4 w-4" />
          {translateText('generated.inline.1022_blogs_6d9cfa32')}
          {counts.blogs})
        </TabsTrigger>
      </ScrollableTabsList>
    </Tabs>
  );
}
