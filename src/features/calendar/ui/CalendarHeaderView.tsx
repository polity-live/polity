import { Button } from '@/features/shared/ui/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  Calendar as CalendarIcon,
  List,
  Grid3x3,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import type { CalendarView } from '../types/calendar.types';
import { useTranslation } from '@/features/shared/hooks/use-translation';

interface CalendarHeaderViewProps {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  currentViewTitle: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent: () => void;
}

export const CalendarHeaderView = ({
  view,
  setView,
  currentViewTitle,
  onPrevious,
  onNext,
  onToday,
  onCreateEvent,
}: CalendarHeaderViewProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('features.calendar.title')}</h1>
        </div>
        <Button onClick={onCreateEvent} data-action-id="calendar.header.event.create">
          <Plus className="mr-2 h-4 w-4" />
          {t('features.calendar.actions.createEvent')}
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onPrevious}
            data-action-id="calendar.header.period.previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onToday} data-action-id="calendar.header.period.today">
            {t('features.calendar.today')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNext}
            data-action-id="calendar.header.period.next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold">{currentViewTitle}</h2>
        </div>

        <Tabs value={view} onValueChange={v => setView(v as CalendarView)}>
          <TabsList>
            <TabsTrigger value="day" data-action-id="calendar.header.view.day">
              <List className="mr-2 h-4 w-4" />
              {t('features.calendar.views.day')}
            </TabsTrigger>
            <TabsTrigger value="week" data-action-id="calendar.header.view.week">
              <Grid3x3 className="mr-2 h-4 w-4" />
              {t('features.calendar.views.week')}
            </TabsTrigger>
            <TabsTrigger value="month" data-action-id="calendar.header.view.month">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {t('features.calendar.views.month')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </>
  );
};
