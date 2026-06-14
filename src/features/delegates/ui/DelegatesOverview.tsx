import { BadgeControl } from '@/features/shared/ui/status';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Users, CheckCircle2, Clock } from 'lucide-react';
import { useEventDelegates } from '@/zero/events/useEventState';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface DelegatesOverviewProps {
  eventId: string;
  groupId?: string;
}

export function DelegatesOverview({ eventId, groupId }: DelegatesOverviewProps) {
  void groupId;
  const { event } = useEventDelegates(eventId, groupId);
  const delegates = event?.delegates || [];
  const allocations = event?.delegate_allocations || [];
  const groupsById = new Map<string, { id: string; name: string; memberCount: number }>();

  for (const allocation of allocations) {
    if (!allocation.group?.id) continue;
    groupsById.set(allocation.group.id, {
      id: allocation.group.id,
      name: allocation.group.name || 'Untergruppe',
      memberCount: allocation.group.member_count ?? 0,
    });
  }

  for (const delegate of delegates) {
    if (!delegate.group?.id) continue;
    groupsById.set(delegate.group.id, {
      id: delegate.group.id,
      name: delegate.group.name || 'Untergruppe',
      memberCount: delegate.group.member_count ?? 0,
    });
  }

  const subgroups = [...groupsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  // Group delegates by subgroup
  const delegatesByGroup = subgroups.map(subgroup => {
    const allocation = allocations.find(a => a.group_id === subgroup.id);
    const groupDelegates = delegates.filter(d => d.group_id === subgroup.id);

    const confirmedDelegates = groupDelegates.filter(d => d.status === 'confirmed');
    const nominatedDelegates = groupDelegates.filter(d => d.status === 'nominated');
    const standbyDelegates = groupDelegates.filter(d => d.status === 'standby');

    return {
      subgroup,
      allocation: allocation?.allocated_seats || 0,
      delegates: groupDelegates,
      confirmedDelegates,
      nominatedDelegates,
      standbyDelegates,
    };
  });

  const isDelegatesFinalized = event?.delegate_finalized_at;

  if (subgroups.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {translateText('generated.inline.0366_no_subgroups_found_for_this_group_2ac808e6')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isDelegatesFinalized && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {translateText(
              'generated.inline.0367_delegates_will_be_finalized_when_the_event_st_4a680059'
            )}
          </p>
        </div>
      )}

      {delegatesByGroup.map(
        ({
          subgroup,
          allocation,
          delegates,
          confirmedDelegates,
          nominatedDelegates,
          standbyDelegates,
        }) => (
          <Card key={subgroup.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{subgroup.name}</CardTitle>
                  <CardDescription>
                    {subgroup.memberCount}
                    {translateText('generated.inline.0368_members_0c3cbc60')}
                    {allocation}
                    {translateText('generated.inline.0049_delegate_52934c29')}
                    {allocation !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <BadgeControl variant={isDelegatesFinalized ? 'default' : 'secondary'}>
                  {isDelegatesFinalized ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {translateText('generated.inline.0369_finalized_876126b1')}
                    </>
                  ) : (
                    <>
                      <Clock className="mr-1 h-3 w-3" />
                      {translateText('generated.inline.0370_pending_96f608c1')}
                    </>
                  )}
                </BadgeControl>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Confirmed Delegates */}
              {confirmedDelegates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {translateText('generated.inline.0371_confirmed_delegates_bccbcbb2')}
                    {confirmedDelegates.length})
                  </p>
                  <div className="space-y-2">
                    {confirmedDelegates.map(delegate => (
                      <div
                        key={delegate.id}
                        className="flex items-center gap-3 rounded-lg border bg-green-50 p-3 dark:bg-green-900/20"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={delegate.user?.avatar ?? undefined}
                            alt={
                              [delegate.user?.first_name, delegate.user?.last_name]
                                .filter(Boolean)
                                .join(' ') || 'User'
                            }
                          />
                          <AvatarFallback>
                            {delegate.user?.first_name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">
                            {[delegate.user?.first_name, delegate.user?.last_name]
                              .filter(Boolean)
                              .join(' ') || translateText('generated.inline.0031_unknown_bc7819b3')}
                          </p>
                          {delegate.user?.handle && (
                            <p className="text-muted-foreground text-sm">@{delegate.user.handle}</p>
                          )}
                        </div>
                        <BadgeControl variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {translateText('generated.inline.0372_confirmed_8cc7acb8')}
                        </BadgeControl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nominated Delegates (not yet finalized) */}
              {!isDelegatesFinalized && nominatedDelegates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {translateText('generated.inline.0373_nominated_040171c8')}
                    {nominatedDelegates.length})
                  </p>
                  <div className="space-y-2">
                    {nominatedDelegates.map((delegate, index) => (
                      <div
                        key={delegate.id}
                        className="flex items-center gap-3 rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/20"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={delegate.user?.avatar ?? undefined}
                            alt={
                              [delegate.user?.first_name, delegate.user?.last_name]
                                .filter(Boolean)
                                .join(' ') || 'User'
                            }
                          />
                          <AvatarFallback>
                            {delegate.user?.first_name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">
                            {[delegate.user?.first_name, delegate.user?.last_name]
                              .filter(Boolean)
                              .join(' ') || translateText('generated.inline.0031_unknown_bc7819b3')}
                          </p>
                          {delegate.user?.handle && (
                            <p className="text-muted-foreground text-sm">@{delegate.user.handle}</p>
                          )}
                        </div>
                        <BadgeControl variant="outline">#{index + 1}</BadgeControl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standby Delegates */}
              {standbyDelegates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {translateText('generated.inline.0374_standby_dbbfb68a')}
                    {standbyDelegates.length})
                  </p>
                  <div className="space-y-2">
                    {standbyDelegates.map(delegate => (
                      <div
                        key={delegate.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={delegate.user?.avatar ?? undefined}
                            alt={
                              [delegate.user?.first_name, delegate.user?.last_name]
                                .filter(Boolean)
                                .join(' ') || 'User'
                            }
                          />
                          <AvatarFallback>
                            {delegate.user?.first_name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">
                            {[delegate.user?.first_name, delegate.user?.last_name]
                              .filter(Boolean)
                              .join(' ') || translateText('generated.inline.0031_unknown_bc7819b3')}
                          </p>
                          {delegate.user?.handle && (
                            <p className="text-muted-foreground text-sm">@{delegate.user.handle}</p>
                          )}
                        </div>
                        <BadgeControl variant="secondary">
                          {translateText('generated.inline.0375_standby_88a2d0bb')}
                        </BadgeControl>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No delegates yet */}
              {delegates.length === 0 && (
                <div className="border-muted text-muted-foreground flex items-center gap-2 rounded-lg border p-4 text-center text-sm">
                  <Users className="h-4 w-4" />
                  <p>
                    {translateText('generated.inline.0376_no_delegates_nominated_yet_3f1b5625')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
