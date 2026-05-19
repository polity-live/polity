import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { CardHeader } from '@/features/shared/ui/ui/card';
import { Input } from '@/features/shared/ui/ui/input';
import { ArrowLeft, Check, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';
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
  onRenameConversation: (id: string, name: string | null) => Promise<boolean>;
}

export function ConversationHeader({
  conversation,
  currentUserId,
  isOnline,
  onBack,
  onTogglePin,
  onDeleteClick,
  onMembersClick,
  onRenameConversation,
}: ConversationHeaderProps) {
  const { t } = useTranslation();
  const display = getConversationDisplay(conversation, currentUserId);
  const otherParticipant = getOtherParticipant(conversation, currentUserId);
  const isAiConversation = isAssistantConversation(conversation);
  const userHref =
    !display.isCollective && otherParticipant?.id && !isAiConversation
      ? `/user/${otherParticipant.id}`
      : null;
  const groupHref =
    display.isGroup && conversation.group?.id ? `/group/${conversation.group.id}` : null;
  const eventHref =
    display.isEvent && conversation.event?.id ? `/event/${conversation.event.id}` : null;
  const entityHref = groupHref ?? eventHref ?? userHref;
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(conversation.name?.trim() || display.name);

  useEffect(() => {
    setIsEditingName(false);
    setDraftName(conversation.name?.trim() || display.name);
  }, [conversation.id, conversation.name, display.name]);

  const handleCancelRename = () => {
    setDraftName(conversation.name?.trim() || display.name);
    setIsEditingName(false);
  };

  const handleSaveRename = async () => {
    const trimmedName = draftName.trim();
    const nextName = trimmedName.length > 0 ? trimmedName : null;
    const success = await onRenameConversation(conversation.id, nextName);
    if (success) {
      setIsEditingName(false);
    }
  };

  const avatarContent = (
    <div className="relative h-10 w-10 flex-shrink-0">
      <Avatar className="h-10 w-10 rounded-2xl">
        <AvatarImage src={display.avatar || undefined} />
        <AvatarFallback className="rounded-2xl">
          {display.name?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      {isOnline && !display.isCollective && (
        <span className="border-background absolute -right-0.5 -bottom-0.5 block h-3 w-3 rounded-full border-2 bg-green-500" />
      )}
    </div>
  );

  const titleContent =
    isAiConversation && isEditingName ? (
      <div className="flex items-center gap-2">
        <Input
          value={draftName}
          onChange={event => setDraftName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleSaveRename();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              handleCancelRename();
            }
          }}
          className="h-8 w-[180px] md:w-[260px]"
          placeholder={t('features.messages.ai.renameConversationPlaceholder', 'Conversation name')}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => void handleSaveRename()}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCancelRename}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        {entityHref ? (
          <Link to={entityHref} className="min-w-0 hover:underline">
            <h3 className="truncate font-semibold">{display.name}</h3>
          </Link>
        ) : (
          <h3 className="truncate font-semibold">{display.name}</h3>
        )}
        {isAiConversation && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={event => {
              event.preventDefault();
              setIsEditingName(true);
            }}
            title={t('features.messages.ai.renameConversation', 'Rename AI conversation')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );

  const identityContent = (
    <>
      {entityHref && !isEditingName ? (
        <Link to={entityHref} className="flex-shrink-0">
          {avatarContent}
        </Link>
      ) : (
        avatarContent
      )}
      <div className="ml-3 min-w-0">
        {titleContent}
        {display.isCollective ? (
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
        <div className="flex items-center">{identityContent}</div>
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
        {conversation.type !== 'group' && conversation.type !== 'event' && (
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
