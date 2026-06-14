import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  CalendarChronologicalListView,
  CalendarExportButton,
  CalendarFilterBar,
  CalendarHeader,
  type CalendarHeaderView,
} from './index';

interface DemoCalendarItem {
  id: string;
  title: string;
  startsAt: number;
}

const demoItems: DemoCalendarItem[] = [
  {
    id: 'assembly',
    title: 'General assembly',
    startsAt: new Date().setHours(10, 0, 0, 0),
  },
  {
    id: 'committee',
    title: 'Budget committee',
    startsAt: new Date().setDate(new Date().getDate() + 1),
  },
];

function CalendarComponentsPreview() {
  const [viewMode, setViewMode] = useState<CalendarHeaderView>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  return (
    <div className="max-w-3xl p-6">
      <CalendarHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentViewTitle="June 14 - June 20, 2026"
        onPrevious={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))}
        onNext={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))}
        onToday={() => setSelectedDate(new Date())}
        title="Calendar"
        actions={<CalendarExportButton onExport={() => undefined} />}
      />

      <CalendarFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      <CalendarChronologicalListView
        items={demoItems}
        selectedDate={selectedDate}
        getItemDate={item => item.startsAt}
        getItemKey={item => item.id}
        emptyText="No events"
        renderItem={item => (
          <div className="bg-card rounded-md border p-3 text-sm shadow-sm">
            <div className="font-medium">{item.title}</div>
            <div className="text-muted-foreground">{new Date(item.startsAt).toLocaleString()}</div>
          </div>
        )}
      />
    </div>
  );
}

const meta: Meta<typeof CalendarComponentsPreview> = {
  component: CalendarComponentsPreview,
  title: 'Components/Shared/CalendarComponents',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CalendarComponentsPreview>;

export const Default: Story = {};
