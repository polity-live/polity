import { FormControlInput } from '@/features/shared/ui/form';
import { StatusDotIndicator } from '@/features/shared/ui/status';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Check, Pencil, X } from 'lucide-react';
import { Conversation } from '../types/message.types';
import { getConversationDisplay, getOtherParticipant } from '../logic/messageUtils';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { Link } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/features/shared/ui/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/shared/ui/ui/tooltip';

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
import { ConversationHeaderView } from './ConversationHeaderView';
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
        <StatusDotIndicator
          tone="success"
          className="absolute -right-0.5 -bottom-0.5 h-3 w-3 border-2"
        />
      )}
    </div>
  );

  const titleContent =
    isAiConversation && isEditingName ? (
      <div className="flex items-center gap-2">
        <FormControlInput
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
          placeholder={t('features.messages.ai.renameConversationPlaceholder')}
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
          <>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="border-border/70 text-muted-foreground hover:text-foreground h-6 w-6 flex-shrink-0 rounded-full border text-xs font-semibold"
                      aria-label={t('features.messages.ai.information')}
                    >
                      ?
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs space-y-2 text-left">
                  <AiResponseInformation t={t} />
                </TooltipContent>
              </Tooltip>
              <PopoverContent align="start" className="w-80 space-y-3">
                <AiResponseInformation t={t} />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={event => {
                event.preventDefault();
                setIsEditingName(true);
              }}
              title={t('features.messages.ai.renameConversation')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </>
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
          <Button
            type="button"
            variant="link"
            onClick={onMembersClick}
            className="text-muted-foreground hover:text-foreground h-auto p-0 text-sm transition-colors"
          >
            {t('features.messages.conversation.members', { count: display.participantCount })}
          </Button>
        ) : (
          display.handle && <p className="text-muted-foreground text-sm">@{display.handle}</p>
        )}
      </div>
    </>
  );
  return (
    <ConversationHeaderView
      conversation={conversation}
      currentUserId={currentUserId}
      isOnline={isOnline}
      onBack={onBack}
      onTogglePin={onTogglePin}
      onDeleteClick={onDeleteClick}
      onMembersClick={onMembersClick}
      onRenameConversation={onRenameConversation}
      t={t}
      display={display}
      otherParticipant={otherParticipant}
      isAiConversation={isAiConversation}
      userHref={userHref}
      groupHref={groupHref}
      eventHref={eventHref}
      entityHref={entityHref}
      isEditingName={isEditingName}
      setIsEditingName={setIsEditingName}
      draftName={draftName}
      setDraftName={setDraftName}
      handleCancelRename={handleCancelRename}
      handleSaveRename={handleSaveRename}
      avatarContent={avatarContent}
      titleContent={titleContent}
      identityContent={identityContent}
    />
  );
}

function AiResponseInformation({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{t('features.messages.ai.information')}</p>
      <p className="text-xs leading-relaxed">{t('features.messages.ai.helperText')}</p>
      <p className="text-xs leading-relaxed">{t('features.messages.ai.disclaimer')}</p>
    </div>
  );
}
