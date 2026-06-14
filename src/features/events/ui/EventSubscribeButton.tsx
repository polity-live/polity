'use client';

import { useSubscribeEvent } from '../hooks/useSubscribeEvent';

interface EventSubscribeButtonProps {
  eventId: string;
  onSubscribeChange?: (isSubscribed: boolean) => void;
}
import { EventSubscribeButtonView } from './EventSubscribeButtonView';
export function EventSubscribeButton({ eventId, onSubscribeChange }: EventSubscribeButtonProps) {
  const { isSubscribed, toggleSubscribe, isLoading } = useSubscribeEvent(eventId);

  const handleClick = async () => {
    await toggleSubscribe();
    onSubscribeChange?.(!isSubscribed);
  };
  return (
    <EventSubscribeButtonView
      eventId={eventId}
      onSubscribeChange={onSubscribeChange}
      isSubscribed={isSubscribed}
      toggleSubscribe={toggleSubscribe}
      isLoading={isLoading}
      handleClick={handleClick}
    />
  );
}
