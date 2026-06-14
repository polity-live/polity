'use client';

import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Progress } from '@/features/shared/ui/ui/progress';
import { ChevronLeft, ChevronRight, CheckCircle2, Play, Loader2 } from 'lucide-react';
export interface AgendaNavigationControlsViewProps {
  canNavigate: any;
  completeCurrentItem: any;
  currentAgendaItem: any;
  currentIndex: any;
  eventId: any;
  hasNextItem: any;
  hasPreviousItem: any;
  isLoading: any;
  moveToNextItem: any;
  moveToPreviousItem: any;
  progressPercentage: any;
  t: any;
  totalItems: any;
}

export function AgendaNavigationControlsView({
  completeCurrentItem,
  currentAgendaItem,
  currentIndex,
  hasNextItem,
  hasPreviousItem,
  isLoading,
  moveToNextItem,
  moveToPreviousItem,
  progressPercentage,
  t,
  totalItems,
}: AgendaNavigationControlsViewProps) {
  return (
    <Card surface="primarySoft">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('features.events.navigation.progress')}
            </span>
            <BadgeControl variant="secondary">
              {currentIndex + 1} / {totalItems}
            </BadgeControl>
          </div>
          <Progress value={progressPercentage} className="h-2" />

          {/* Current item display */}
          {currentAgendaItem ? (
            <div className="flex items-center gap-2">
              <Play className="text-primary h-4 w-4" />
              <span className="truncate font-medium">
                {t('features.events.navigation.currentItem')}: {currentAgendaItem.title}
              </span>
              <BadgeControl
                variant={
                  currentAgendaItem.status === 'in-progress'
                    ? 'default'
                    : currentAgendaItem.status === 'completed'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {currentAgendaItem.status}
              </BadgeControl>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              {t('features.events.navigation.notActivated')}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={moveToPreviousItem}
              disabled={!hasPreviousItem || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              {t('features.events.navigation.previous')}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={completeCurrentItem}
              disabled={!currentAgendaItem || isLoading}
              className="max-w-[200px] flex-1"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {t('features.events.navigation.complete')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={moveToNextItem}
              disabled={!hasNextItem || isLoading}
            >
              {t('features.events.navigation.next')}
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
