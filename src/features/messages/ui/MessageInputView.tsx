import { BadgeControl } from '@/features/shared/ui/status';
import { FileUploadTrigger, FormControlTextarea } from '@/features/shared/ui/form';
import { AtSign, LoaderCircle, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { MESSAGE_ATTACHMENT_ACCEPT } from '../logic/uploadAttachmentCard';
import { ChatComposer, chatComposerTextareaClassName } from './ChatComposer';
export interface MessageInputViewProps {
  conversation?: any;
  currentUserId?: any;
  onSendMessage?: any;
  t: any;
  textareaRef: any;
  attachments: any;
  messageText: any;
  setMessageText: any;
  caretPosition: any;
  setCaretPosition: any;
  suggestionAnchorPosition: any;
  setSuggestionAnchorPosition: any;
  textareaScrollVersion: any;
  setTextareaScrollVersion: any;
  mentionQuery: any;
  selectedAttachmentKeys: any;
  attachmentTypeSuggestions: any[];
  attachmentSuggestions: any[];
  hasSuggestionPanel: any;
  updateCaretPosition: any;
  moveCaret: any;
  applyMessageReplacement: any;
  handleAttachmentTypeSelect: any;
  handleAttachmentSelect: any;
  handleSendMessage: any;
  otherUser: any;
  otherParticipantName: any;
  isPendingDirectConversation: any;
  isConversationRequester: any;
}

export function MessageInputView({
  conversation,
  t,
  textareaRef,
  attachments,
  messageText,
  setMessageText,
  setCaretPosition,
  suggestionAnchorPosition,
  setTextareaScrollVersion,
  attachmentTypeSuggestions,
  attachmentSuggestions,
  hasSuggestionPanel,
  updateCaretPosition,
  handleAttachmentTypeSelect,
  handleAttachmentSelect,
  handleSendMessage,
  otherParticipantName,
  isPendingDirectConversation,
  isConversationRequester,
}: MessageInputViewProps) {
  if (isPendingDirectConversation && isConversationRequester) {
    return (
      <CardContent separator className="flex-shrink-0 p-4" data-swipe-lock>
        <div className="text-muted-foreground text-center text-sm">
          {t('features.messages.conversation.waitingForAccept', { name: otherParticipantName })}
        </div>
      </CardContent>
    );
  }

  if (conversation.status === 'rejected') {
    return (
      <CardContent separator className="flex-shrink-0 p-4" data-swipe-lock>
        <div className="text-muted-foreground text-center text-sm">
          {t('features.messages.conversation.rejected')}
        </div>
      </CardContent>
    );
  }

  return (
    <ChatComposer
      value={messageText}
      textareaRef={textareaRef}
      onSubmit={event => {
        event.preventDefault();
        void handleSendMessage();
      }}
      chips={
        <>
          {attachments.selectedAttachments.map((attachment: any) => (
            <BadgeControl
              key={`${attachment.entityType}:${attachment.entityId}`}
              variant="outline"
              className="gap-1 pr-1 text-xs"
            >
              {attachment.entityType === 'document' ? (
                <Paperclip className="h-3 w-3" />
              ) : (
                <AtSign className="h-3 w-3" />
              )}
              {attachment.title}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-md"
                onClick={() =>
                  attachments.removeAttachment(attachment.entityType, attachment.entityId)
                }
                aria-label={t('features.messages.compose.removeAttachment')}
                data-action-id="messages.composer.attachment.remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </BadgeControl>
          ))}
          {attachments.isUploadingAttachments && attachments.uploadingAttachmentName ? (
            <BadgeControl variant="secondary" size="xs" className="gap-1">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              {t('features.messages.compose.uploading')}:{attachments.uploadingAttachmentName}
            </BadgeControl>
          ) : null}
        </>
      }
      toolbar={
        <>
          <FileUploadTrigger
            data-action-id="messages.composer.file.upload"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md"
            disabled={attachments.isUploadingAttachments}
            title={t('features.messages.compose.uploadFiles')}
            aria-label={t('features.messages.compose.uploadFiles')}
            inputProps={{ multiple: true, accept: MESSAGE_ATTACHMENT_ACCEPT }}
            onFilesSelected={files => void attachments.addUploadedFiles(Array.from(files))}
          >
            {attachments.isUploadingAttachments ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </FileUploadTrigger>
          <span className="text-muted-foreground hidden min-w-0 flex-1 truncate text-xs sm:block">
            {t('features.messages.compose.attachmentHelperText')}
          </span>
          <Button
            type="submit"
            size="icon"
            className="ml-auto h-8 w-8 rounded-md"
            disabled={
              (!messageText.trim() && attachments.selectedAttachments.length === 0) ||
              attachments.isUploadingAttachments
            }
            aria-label={t('common.send')}
            data-action-id="messages.composer.send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="relative">
        <FormControlTextarea
          data-action-id="messages.composer.text.change"
          ref={textareaRef}
          placeholder={t('features.messages.compose.messagePlaceholder')}
          value={messageText}
          onChange={event => {
            setMessageText(event.target.value);
            setCaretPosition(event.target.selectionStart ?? event.target.value.length);
          }}
          onClick={updateCaretPosition}
          onKeyUp={updateCaretPosition}
          onSelect={updateCaretPosition}
          onScroll={() => setTextareaScrollVersion((currentValue: number) => currentValue + 1)}
          className={chatComposerTextareaClassName}
          onKeyDown={async event => {
            if (event.key === 'Escape') {
              setCaretPosition(textareaRef.current?.selectionStart ?? 0);
              return;
            }

            if (event.key !== 'Enter' || event.shiftKey) {
              return;
            }

            event.preventDefault();

            if (attachmentSuggestions.length > 0) {
              handleAttachmentSelect(attachmentSuggestions[0]);
              return;
            }

            if (attachmentTypeSuggestions.length > 0) {
              handleAttachmentTypeSelect(attachmentTypeSuggestions[0].entityType);
              return;
            }

            await handleSendMessage();
          }}
        />

        {hasSuggestionPanel && suggestionAnchorPosition && (
          <Card
            className="absolute z-30 border shadow-lg"
            style={{
              left: suggestionAnchorPosition.left,
              top: suggestionAnchorPosition.top,
              width: suggestionAnchorPosition.width,
              transform: 'translateY(calc(-100% - 8px))',
            }}
          >
            <CardContent className="p-2">
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {attachmentTypeSuggestions.length > 0 && (
                  <>
                    <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                      {t('features.messages.ai.attachTypes')}
                    </p>
                    {attachmentTypeSuggestions.map((option: any) => (
                      <Button
                        key={option.entityType}
                        type="button"
                        variant="ghost"
                        onClick={() => handleAttachmentTypeSelect(option.entityType)}
                        data-action-id="messages.composer.suggestion.attachment-type.select"
                        className="h-auto w-full justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                      >
                        <AtSign className="text-muted-foreground h-4 w-4" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{option.label}</span>
                          <span className="text-muted-foreground block text-xs">
                            {option.token}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </>
                )}

                {attachmentSuggestions.length > 0 && (
                  <>
                    <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                      {t('features.messages.ai.attachments')}
                    </p>
                    {attachmentSuggestions.map((option: any) => (
                      <Button
                        key={option.key}
                        type="button"
                        variant="ghost"
                        onClick={() => handleAttachmentSelect(option)}
                        data-action-id="messages.composer.suggestion.attachment.select"
                        className="h-auto w-full items-start justify-start gap-3 px-2 py-2 text-left whitespace-normal"
                      >
                        <AtSign className="text-muted-foreground mt-0.5 h-4 w-4" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{option.label}</span>
                          {option.subtitle && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {option.subtitle}
                            </span>
                          )}
                        </span>
                        <BadgeControl variant="outline" size="tiny" textTransform="uppercase">
                          {option.entityType}
                        </BadgeControl>
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ChatComposer>
  );
}
