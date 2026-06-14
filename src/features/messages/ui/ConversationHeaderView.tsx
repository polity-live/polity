import { Button } from '@/features/shared/ui/ui/button';
import { CardHeader } from '@/features/shared/ui/ui/card';
import { ArrowLeft, Pin, PinOff, Trash2 } from 'lucide-react';
export interface ConversationHeaderViewProps {
  conversation: any;
  currentUserId: any;
  isOnline: any;
  onBack: any;
  onTogglePin: any;
  onDeleteClick: any;
  onMembersClick: any;
  onRenameConversation: any;
  t: any;
  display: any;
  otherParticipant: any;
  isAiConversation: any;
  userHref: any;
  groupHref: any;
  eventHref: any;
  entityHref: any;
  isEditingName: any;
  setIsEditingName: any;
  draftName: any;
  setDraftName: any;
  handleCancelRename: any;
  handleSaveRename: any;
  avatarContent: any;
  titleContent: any;
  identityContent: any;
}

export function ConversationHeaderView({
  conversation,
  onBack,
  onTogglePin,
  onDeleteClick,
  t,
  identityContent,
}: ConversationHeaderViewProps) {
  return (
    <CardHeader separator className="flex-shrink-0 flex-row items-center justify-between space-y-0">
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
