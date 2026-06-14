'use client';

import {
  useGroupEventsListController,
  type EventByGroupRow,
} from '../hooks/useGroupEventsListController';
import { GroupEventsListView } from './GroupEventsListView';

interface GroupEventsListProps {
  groupId: string;
  groupName?: string;
  onEventClick?: (eventId: string, eventData: EventByGroupRow) => void;
}

export function GroupEventsList({ groupId, groupName, onEventClick }: GroupEventsListProps) {
  return (
    <GroupEventsListView
      groupId={groupId}
      groupName={groupName}
      onEventClick={onEventClick}
      {...useGroupEventsListController({ groupId })}
    />
  );
}
