import { featureThemeClassName } from '@/features/shared/theme';
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
import { translate as translateText } from '@/features/shared/hooks/use-translation';
export interface DelegatesOverviewViewProps {
  eventId: any;
  groupId: any;
  event: any;
  delegates: any;
  allocations: any;
  groupsById: any;
  subgroups: any;
  delegatesByGroup: any;
  isDelegatesFinalized: any;
}

export function DelegatesOverviewView({
  subgroups,
  delegatesByGroup,
  isDelegatesFinalized,
}: DelegatesOverviewViewProps) {
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
        <div className={featureThemeClassName('delegateDelegatesOverviewWarningSurface')}>
          <Clock className={featureThemeClassName('delegateDelegatesOverviewWarningIcon')} />
          <p className={featureThemeClassName('delegateDelegatesOverviewWarningText')}>
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
        }: any) => (
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
                    {confirmedDelegates.map((delegate: any) => (
                      <div
                        key={delegate.id}
                        className={featureThemeClassName('delegateDelegatesOverviewSuccessSurface')}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={delegate.user?.avatar ?? undefined}
                            alt={
                              [delegate.user?.first_name, delegate.user?.last_name]
                                .filter(Boolean)
                                .join(' ') || translateText('common.entities.user')
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
                        <BadgeControl variant="default" tone="successStrong">
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
                    {nominatedDelegates.map((delegate: any, index: number) => (
                      <div
                        key={delegate.id}
                        className={featureThemeClassName('delegateDelegatesOverviewInfoSurface')}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={delegate.user?.avatar ?? undefined}
                            alt={
                              [delegate.user?.first_name, delegate.user?.last_name]
                                .filter(Boolean)
                                .join(' ') || translateText('common.entities.user')
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
                    {standbyDelegates.map((delegate: any) => (
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
                                .join(' ') || translateText('common.entities.user')
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
