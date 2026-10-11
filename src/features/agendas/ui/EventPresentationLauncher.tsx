import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ChevronDown, Maximize2 } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu';

export function EventPresentationLauncher({
  eventId,
  canManage = false,
  onOpenLiveFocus,
}: {
  eventId: string;
  canManage?: boolean;
  onOpenLiveFocus: () => void;
}) {
  const label = translateText('features.events.stream.openLiveFocus');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild data-action-scope="presentation">
        <Button
          variant="outline"
          className="shrink-0 gap-1"
          data-action-id="event.show.open"
          aria-label={label}
          title={label}
          onClick={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
        >
          <Maximize2 className="size-4" />
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-64"
        onClick={event => event.stopPropagation()}
      >
        <DropdownMenuItem
          data-action-id="agendas.event-agenda.live-focus.open"
          data-action-kind="interaction"
          onSelect={onOpenLiveFocus}
        >
          {label}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-action-scope="presentation">
          <a
            data-action-id="event.show.studio.open"
            href={`/event/${eventId}/presentation`}
            target="_blank"
            rel="noreferrer"
          >
            {translateText('features.studio.eventLive.studio')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-action-scope="presentation">
          <a
            data-action-id="event.show.agenda.open"
            href={`/event/${eventId}/presentation?mode=agenda`}
            target="_blank"
            rel="noreferrer"
          >
            {translateText('features.studio.eventLive.agenda')}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-action-scope="presentation">
          <a
            data-action-id="event.show.speakers.open"
            href={`/event/${eventId}/presentation?mode=speakers`}
            target="_blank"
            rel="noreferrer"
          >
            {translateText('features.studio.eventLive.speakers')}
          </a>
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem asChild data-action-scope="presentation">
            <a
              data-action-id="event.show.regie.open"
              href={`/event/${eventId}/presentation?regie=true`}
              target="_blank"
              rel="noreferrer"
            >
              {translateText('features.studio.eventLive.openControls')}
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
