'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/features/shared/ui/ui/carousel';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Mic, Plus, Users, CheckCircle2, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { getSpeakerGenderLabel } from '../logic/speakerListGenderQuota';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
function formatClockTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatGenderBadgeLabel(t: any, gender?: string | null) {
  const labelKey =
    gender === 'male'
      ? 'male'
      : gender === 'female'
        ? 'female'
        : gender === 'diverse'
          ? 'diverse'
          : 'unspecified';

  return t(
    `features.events.agenda.genderQuota.genderLabels.${labelKey}`,
    getSpeakerGenderLabel(gender)
  );
}
export interface AgendaSpeakerListSectionViewProps {
  speakers: any[];
  isUserInSpeakerList: any;
  canManageSpeakers: any;
  isAddingSpeaker: any;
  isRemovingSpeaker: any;
  userId: any;
  agendaStartTime: any;
  showGender: any;
  onAddToSpeakerList: any;
  onRemoveFromSpeakerList: any;
  onMarkCompleted: any;
  className: any;
  t: any;
  expanded: any;
  setExpanded: any;
  carouselApi: any;
  setCarouselApi: any;
  now: any;
  setNow: any;
  sortedSpeakers: any;
  currentSpeakerIndex: any;
  currentSpeaker: any;
  queueStartTime: any;
  speakerQueue: any[];
  userSpeaker: any;
  showMembershipState: any;
  renderRelativeTime: any;
  renderTimingLabel: any;
  agendaItemId?: string;
}

export function AgendaSpeakerListSectionView({
  speakers,
  canManageSpeakers,
  isAddingSpeaker,
  isRemovingSpeaker,
  userId,
  showGender,
  onAddToSpeakerList,
  onRemoveFromSpeakerList,
  onMarkCompleted,
  className,
  t,
  expanded,
  setExpanded,
  setCarouselApi,
  speakerQueue,
  userSpeaker,
  showMembershipState,
  renderRelativeTime,
  renderTimingLabel,
  agendaItemId,
}: AgendaSpeakerListSectionViewProps) {
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button
                data-action-id="agendas.speakers.section.toggle"
                data-action-kind="selection"
                variant="ghost"
                presentation="transparentGhost"
              >
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mic className="h-5 w-5" />
                  {t('features.events.agenda.speakerList')} ({speakers.length})
                  {expanded ? (
                    <ChevronUp className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-4 w-4" />
                  )}
                </CardTitle>
              </Button>
            </CollapsibleTrigger>
            <BadgeControl variant="outline">
              {t('features.events.agenda.speakerCount', { count: speakers.length })}
            </BadgeControl>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {speakerQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  {t('features.events.agenda.speakerListEmpty')}
                </p>
              </div>
            ) : agendaItemId ? (
              <PolityZeroListView<
                any,
                { order_index: number; id: string },
                { agendaItemId: string }
              >
                context={{ agendaItemId }}
                historyKey={`agenda-${agendaItemId}-speakers`}
                estimateSize={116}
                getRowKey={speaker => speaker.id}
                toStartRow={speaker => ({ order_index: speaker.order_index, id: speaker.id })}
                getPageQuery={({ limit, start, dir, settled }) => ({
                  query: queries.agendas.speakerPage({ agendaItemId, limit, start, dir }) as never,
                  options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                })}
                getSingleQuery={({ id, settled }) => ({
                  query: queries.agendas.speakerById({ id }) as never,
                  options: { ttl: settled ? ('5m' as const) : ('none' as const) },
                })}
                renderRow={row => {
                  const speaker = speakerQueue.find(candidate => candidate.id === row.id) ?? row;
                  const speakerName =
                    speaker.user?.name || speaker.user?.email || t('common.unspecified');
                  return (
                    <Card
                      className={cn('border', speaker.isCurrent && 'border-primary bg-primary/5')}
                    >
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <Link
                          to="/user/$id"
                          params={{ id: speaker.user?.id ?? '' }}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={speaker.user?.avatar} />
                            <AvatarFallback>{speakerName[0]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{speakerName}</p>
                            <p className="text-muted-foreground text-sm">
                              {t('features.events.agenda.speakerPosition', {
                                count: speaker.order ?? row.order_index,
                              })}
                            </p>
                          </div>
                        </Link>
                        {canManageSpeakers && speaker.isCurrent && onMarkCompleted ? (
                          <Button
                            data-action-id="agendas.speakers.current.complete"
                            data-action-kind="async-action"
                            size="icon"
                            variant="outline"
                            onClick={() => onMarkCompleted(speaker.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                }}
                renderSkeleton={() => <Skeleton className="h-28 w-full rounded-xl" />}
                renderEmpty={() => null}
                className="max-h-[36rem] overflow-auto"
              />
            ) : (
              <div className="px-10">
                <Carousel
                  setApi={setCarouselApi}
                  className="w-full"
                  opts={{ align: 'start', dragFree: true }}
                >
                  <CarouselContent className="-ml-3 md:-ml-4">
                    {speakerQueue.map((speaker: any) => {
                      const speakerName =
                        speaker.user?.name || speaker.user?.email || t('common.unspecified');
                      return (
                        <CarouselItem
                          key={speaker.id}
                          className="basis-[86%] pl-3 sm:basis-[55%] md:basis-[44%] md:pl-4 lg:basis-[32%]"
                        >
                          <Card
                            className={cn(
                              'h-full border transition-colors',
                              speaker.isPast && 'opacity-60',
                              speaker.isCurrent && 'border-primary bg-primary/5',
                              speaker.isCurrentUser && 'ring-primary/25 ring-2'
                            )}
                          >
                            <CardContent className="flex h-full flex-col gap-4 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <Link
                                  to="/user/$id"
                                  params={{ id: speaker.user?.id ?? '' }}
                                  className="flex min-w-0 items-center gap-3"
                                >
                                  <Avatar className="border-border/60 h-14 w-14 border">
                                    <AvatarImage src={speaker.user?.avatar} />
                                    <AvatarFallback>
                                      {speakerName[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="truncate font-medium hover:underline">
                                        {speakerName}
                                      </p>
                                      {speaker.isCurrent && (
                                        <BadgeControl variant="default">
                                          {t('features.events.agenda.currentSpeaker')}
                                        </BadgeControl>
                                      )}
                                      {speaker.isCurrentUser && (
                                        <BadgeControl variant="secondary">
                                          {t('features.events.agenda.alreadyOnList')}
                                        </BadgeControl>
                                      )}
                                      {showGender && (
                                        <BadgeControl variant="outline">
                                          {formatGenderBadgeLabel(t, speaker.user?.gender)}
                                        </BadgeControl>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                      {t('features.events.agenda.speakerPosition', {
                                        count: speaker.order,
                                      })}
                                    </p>
                                  </div>
                                </Link>

                                {canManageSpeakers && speaker.isCurrent && onMarkCompleted && (
                                  <Button
                                    data-action-id="agendas.speakers.current.complete"
                                    data-action-kind="async-action"
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => onMarkCompleted(speaker.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              <div className="mt-auto space-y-3">
                                <div className="bg-muted/60 rounded-lg p-3">
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-muted-foreground">
                                      {renderTimingLabel(speaker)}
                                    </span>
                                    <span className="font-medium">
                                      {renderRelativeTime(speaker)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-muted-foreground">
                                      {t('features.events.agenda.estimatedStartLabel')}
                                    </span>
                                    <span className="font-medium">
                                      {formatClockTime(speaker.estimatedStartTime)}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {speaker.time} {t('common.minutes')}
                                  </span>
                                  {speaker.completed && (
                                    <BadgeControl variant="outline">
                                      {t('features.events.agenda.completedSpeaker')}
                                    </BadgeControl>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                  <CarouselPrevious className="left-1 h-9 w-9" />
                  <CarouselNext className="right-1 h-9 w-9" />
                </Carousel>
              </div>
            )}

            {showMembershipState ? (
              <div className="bg-primary/5 rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{t('features.events.agenda.alreadyOnList')}</p>
                    {userSpeaker ? (
                      <>
                        <p className="text-muted-foreground text-sm">
                          {userSpeaker.isCurrent
                            ? t('features.events.agenda.userSpeakerCurrentSummary', {
                                time: renderRelativeTime(userSpeaker),
                              })
                            : t('features.events.agenda.userSpeakerQueueSummary', {
                                position: userSpeaker.order,
                                time: renderRelativeTime(userSpeaker),
                              })}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {t('features.events.agenda.estimatedStartLabel')}{' '}
                          {formatClockTime(userSpeaker.estimatedStartTime)}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t('features.events.agenda.userSpeakerPendingSummary')}
                      </p>
                    )}
                  </div>

                  {onRemoveFromSpeakerList && (
                    <Button
                      data-action-id="agendas.speakers.membership.leave"
                      data-action-kind="async-action"
                      onClick={onRemoveFromSpeakerList}
                      loading={isRemovingSpeaker}
                      loadingLabel={t('features.events.agenda.leavingSpeakerList')}
                      variant="outline"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t('features.events.agenda.leaveSpeakerList')}
                    </Button>
                  )}
                </div>
              </div>
            ) : onAddToSpeakerList ? (
              <Button
                data-action-id="agendas.speakers.membership.join"
                data-action-kind="async-action"
                onClick={onAddToSpeakerList}
                disabled={!userId}
                loading={isAddingSpeaker}
                loadingLabel={t('features.events.agenda.joiningSpeakerList')}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('features.events.agenda.joinSpeakerList')}
              </Button>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
