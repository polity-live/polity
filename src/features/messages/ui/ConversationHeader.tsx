import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { CardHeader } from '@/features/shared/ui/ui/card';
import { ArrowLeft, Pin, PinOff, Trash2 } from 'lucide-react';
import { Conversation } from '../types/message.types';
import { getConversationDisplay, getOtherParticipant } from '../logic/messageUtils';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Link } from '@tanstack/react-router';

interface ConversationHeaderProps {
  conversation: Conversation;
  currentUserId?: string;
  isOnline: boolean;
  onBack: () => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDeleteClick: (id: string) => void;
  onMembersClick: () => void;
}

export function ConversationHeader({
  conversation,
  currentUserId,
  isOnline,
  onBack,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
}: ConversationHeaderProps) {
  const { t } = useTranslation();
  const display = getConversationDisplay(conversation, currentUserId);
  const otherParticipant = getOtherParticipant(conversation, currentUserId);
  const userHref = !display.isGroup && otherParticipant?.id ? `/user/${otherParticipant.id}` : null;

  const identityContent = (
    <>
      <div className="relative h-10 w-10 flex-shrink-0">
        <Avatar className="h-10 w-10 rounded-2xl">
          <AvatarImage src={display.avatar || undefined} />
          <AvatarFallback className="rounded-2xl">
            {display.name?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        {isOnline && !display.isGroup && (
          <span className="border-background absolute -right-0.5 -bottom-0.5 block h-3 w-3 rounded-full border-2 bg-green-500" />
        )}
      </div>
      <div className="ml-3">
        <h3 className="font-semibold">{display.name}</h3>
        {display.isGroup ? (
          <button
            onClick={onMembersClick}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors hover:underline"
          >
            {t('features.messages.conversation.members', { count: display.participantCount })}
          </button>
        ) : (
          display.handle && <p className="text-muted-foreground text-sm">@{display.handle}</p>
        )}
      </div>
    </>
  );

  return (
    <CardHeader className="flex-shrink-0 flex-row items-center justify-between space-y-0 border-b">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {userHref ? (
          <Link to={userHref} className="flex items-center">
            {identityContent}
          </Link>
        ) : (
          <div className="flex items-center">{identityContent}</div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-1">
        {/* Only show pin for accepted conversations */}
        {conversation.status === 'accepted' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTogglePin(conversation.id, conversation.pinned || false)}
            title={
              conversation.pinned
                ? t('features.messages.conversation.unpin')
                : t('features.messages.conversation.pin')
            }
          >
            {conversation.pinned ? (
              <PinOff className="text-primary h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </Button>
        )}
        {/* Show delete for direct messages, not group chats or Aria & Kai conversation */}
        {conversation.type !== 'group' && !isAssistantConversation(conversation) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeleteClick(conversation.id)}
            title={
              conversation.status === 'pending'
                ? t('features.messages.conversation.cancelRequest')
                : t('features.messages.conversation.delete')
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </CardHeader>
  );
}
