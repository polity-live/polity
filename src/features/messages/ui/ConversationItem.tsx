import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import { Pin, Trash2 } from 'lucide-react';
import { Conversation } from '../types/message.types';
import { getConversationDisplay, getUnreadCount, formatTime } from '../logic/messageUtils';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId?: string;
  isOnline: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ConversationItem({
  conversation,
  currentUserId,
  isOnline,
  isSelected,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const display = getConversationDisplay(conversation, currentUserId);
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const unreadCount = getUnreadCount(conversation, currentUserId);
  const canDelete =
    conversation.type !== 'group' &&
    conversation.type !== 'event' &&
    typeof onDelete === 'function';

  return (
    <div className="group flex items-start gap-2">
      <button
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'hover:bg-accent flex min-w-0 flex-1 items-start gap-3 rounded-lg p-3 text-left transition-colors',
          isSelected && 'bg-accent'
        )}
      >
        <div className="relative h-12 w-12 flex-shrink-0">
          <Avatar className="h-12 w-12 rounded-2xl">
            <AvatarImage src={display.avatar || undefined} />
            <AvatarFallback className="rounded-2xl">
              {display.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {isOnline && !display.isCollective && (
            <span className="border-background absolute -right-0.5 -bottom-0.5 block h-3.5 w-3.5 rounded-full border-2 bg-green-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {conversation.pinned && <Pin className="text-primary h-3.5 w-3.5 flex-shrink-0" />}
              <p className="truncate font-semibold">{display.name}</p>
              {display.isCollective && (
                <Badge variant="secondary" className="ml-1 flex-shrink-0 text-xs">
                  {display.participantCount}
                </Badge>
              )}
            </div>
            {lastMessage && (
              <span className="text-muted-foreground flex-shrink-0 pt-0.5 text-xs whitespace-nowrap">
                {formatTime(lastMessage.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {lastMessage && (
              <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                {(lastMessage.content ?? '').length > 40
                  ? `${(lastMessage.content ?? '').substring(0, 40)}...`
                  : lastMessage.content}
              </p>
            )}
            {unreadCount > 0 && (
              <Badge
                variant="default"
                className="ml-2 h-5 min-w-[20px] flex-shrink-0 rounded-full px-1.5 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </button>

      {canDelete && onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-3 h-8 w-8 flex-shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(conversation.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
