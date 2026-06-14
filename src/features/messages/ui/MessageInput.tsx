import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AtSign, LoaderCircle, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Conversation } from '../types/message.types';
import { getOtherParticipant } from '../logic/messageUtils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  ASSISTANT_ATTACHMENT_TYPE_OPTIONS,
  getSuggestionAnchorPosition,
  parseActiveMentionQuery,
  replaceTextRange,
  type SuggestionAnchorPosition,
} from '../logic/assistantComposer';
import { useMessageAttachments } from '../hooks/useMessageAttachments';
import { MESSAGE_ATTACHMENT_ACCEPT } from '../logic/uploadAttachmentCard';

interface MessageInputProps {
  conversation: Conversation;
  currentUserId?: string;
  onSendMessage: (content: string, contextJson: string) => Promise<boolean>;
}

export function MessageInput({ conversation, currentUserId, onSendMessage }: MessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = useMessageAttachments(conversation.id);
  const [messageText, setMessageText] = useState('');
  const [caretPosition, setCaretPosition] = useState(0);
  const [suggestionAnchorPosition, setSuggestionAnchorPosition] =
    useState<SuggestionAnchorPosition | null>(null);
  const [textareaScrollVersion, setTextareaScrollVersion] = useState(0);

  const mentionQuery = useMemo(
    () => parseActiveMentionQuery(messageText, caretPosition),
    [messageText, caretPosition]
  );

  const selectedAttachmentKeys = useMemo(
    () =>
      new Set(
        attachments.selectedAttachments.map(
          attachment => `${attachment.entityType}:${attachment.entityId}`
        )
      ),
    [attachments.selectedAttachments]
  );

  const attachmentTypeSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    const typedType = mentionQuery.raw.slice(1).split('@')[0].trim().toLowerCase();

    return ASSISTANT_ATTACHMENT_TYPE_OPTIONS.filter(
      option =>
        !mentionQuery.entityType &&
        (typedType.length === 0 ||
          option.entityType.includes(typedType) ||
          option.label.toLowerCase().includes(typedType))
    );
  }, [mentionQuery]);

  const attachmentSuggestions = useMemo(() => {
    if (!mentionQuery) {
      return [];
    }

    return attachments.attachmentOptions
      .filter(option => {
        if (selectedAttachmentKeys.has(option.key)) {
          return false;
        }

        if (mentionQuery.entityType && option.entityType !== mentionQuery.entityType) {
          return false;
        }

        if (!mentionQuery.searchText) {
          return Boolean(mentionQuery.entityType);
        }

        return option.searchText.includes(mentionQuery.searchText);
      })
      .slice(0, 8);
  }, [attachments.attachmentOptions, mentionQuery, selectedAttachmentKeys]);

  const hasSuggestionPanel =
    attachmentSuggestions.length > 0 || attachmentTypeSuggestions.length > 0;

  useLayoutEffect(() => {
    if (!hasSuggestionPanel || !mentionQuery || !textareaRef.current) {
      setSuggestionAnchorPosition(null);
      return;
    }

    const updateSuggestionAnchor = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setSuggestionAnchorPosition(null);
        return;
      }

      setSuggestionAnchorPosition(
        getSuggestionAnchorPosition(textarea, messageText, mentionQuery.start)
      );
    };

    updateSuggestionAnchor();
    window.addEventListener('resize', updateSuggestionAnchor);

    return () => {
      window.removeEventListener('resize', updateSuggestionAnchor);
    };
  }, [hasSuggestionPanel, mentionQuery, messageText, textareaScrollVersion]);

  const updateCaretPosition = () => {
    const nextCaretPosition = textareaRef.current?.selectionStart ?? 0;
    setCaretPosition(nextCaretPosition);
  };

  const moveCaret = (nextPosition: number) => {
    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }

      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextPosition, nextPosition);
      setCaretPosition(nextPosition);
    });
  };

  const applyMessageReplacement = (
    start: number,
    end: number,
    nextValue: string,
    nextCaret: number
  ) => {
    setMessageText(currentValue => replaceTextRange(currentValue, start, end, nextValue));
    moveCaret(nextCaret);
  };

  const handleAttachmentTypeSelect = (
    entityType: (typeof ASSISTANT_ATTACHMENT_TYPE_OPTIONS)[number]['entityType']
  ) => {
    if (!mentionQuery) {
      return;
    }

    const replacement = `@${entityType}@`;
    applyMessageReplacement(
      mentionQuery.start,
      mentionQuery.end,
      replacement,
      mentionQuery.start + replacement.length
    );
  };

  const handleAttachmentSelect = (option: (typeof attachments.attachmentOptions)[number]) => {
    if (!mentionQuery) {
      return;
    }

    attachments.addAttachment(option);

    const replacement =
      messageText.slice(mentionQuery.end).startsWith(' ') || mentionQuery.start === 0 ? '' : ' ';
    applyMessageReplacement(
      mentionQuery.start,
      mentionQuery.end,
      replacement,
      mentionQuery.start + replacement.length
    );
  };

  const handleSendMessage = async () => {
    const trimmedMessage = messageText.trim();
    const hasAttachments = attachments.selectedAttachments.length > 0;

    if ((!trimmedMessage && !hasAttachments) || attachments.isUploadingAttachments) {
      return;
    }

    const didSend = await onSendMessage(
      trimmedMessage,
      JSON.stringify(attachments.selectedAttachments)
    );

    if (!didSend) {
      return;
    }

    setMessageText('');
    setCaretPosition(0);
    attachments.clearAttachments();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    await attachments.addUploadedFiles(files);
  };

  const otherUser = getOtherParticipant(conversation, currentUserId);
  const otherParticipantName =
    [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
    t('common.labels.unspecifiedUser');
  const isPendingDirectConversation =
    conversation.type === 'direct' && conversation.status === 'pending';
  const isConversationRequester = conversation.requested_by?.id === currentUserId;

  if (isPendingDirectConversation && !isConversationRequester) {
    return null;
  }

  return (
    <CardContent className="flex-shrink-0 border-t p-4">
      {isPendingDirectConversation && isConversationRequester ? (
        <div className="text-muted-foreground text-center text-sm">
          {t('features.messages.conversation.waitingForAccept', { name: otherParticipantName })}
        </div>
      ) : conversation.status === 'rejected' ? (
        <div className="text-muted-foreground text-center text-sm">
          {t('features.messages.conversation.rejected')}
        </div>
      ) : (
        <form
          onSubmit={event => {
            event.preventDefault();
            void handleSendMessage();
          }}
          className="space-y-3"
        >
          {attachments.selectedAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.selectedAttachments.map(attachment => (
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
                    className="h-5 w-5 rounded-full"
                    onClick={() =>
                      attachments.removeAttachment(attachment.entityType, attachment.entityId)
                    }
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </BadgeControl>
              ))}
            </div>
          )}

          {attachments.isUploadingAttachments && attachments.uploadingAttachmentName && (
            <BadgeControl variant="secondary" className="gap-1 text-xs">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              {t('features.messages.compose.uploading')}:{attachments.uploadingAttachmentName}
            </BadgeControl>
          )}

          <div className="relative">
            <FormControlTextarea
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
              onScroll={() => setTextareaScrollVersion(currentValue => currentValue + 1)}
              className="min-h-[96px] resize-y"
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
                        {attachmentTypeSuggestions.map(option => (
                          <button
                            key={option.entityType}
                            type="button"
                            onClick={() => handleAttachmentTypeSelect(option.entityType)}
                            className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                          >
                            <AtSign className="text-muted-foreground h-4 w-4" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{option.label}</span>
                              <span className="text-muted-foreground block text-xs">
                                {option.token}
                              </span>
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {attachmentSuggestions.length > 0 && (
                      <>
                        <p className="text-muted-foreground px-2 py-1 text-xs font-medium">
                          {t('features.messages.ai.attachments')}
                        </p>
                        {attachmentSuggestions.map(option => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => handleAttachmentSelect(option)}
                            className="hover:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-left"
                          >
                            <AtSign className="text-muted-foreground mt-0.5 h-4 w-4" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {option.label}
                              </span>
                              {option.subtitle && (
                                <span className="text-muted-foreground block truncate text-xs">
                                  {option.subtitle}
                                </span>
                              )}
                            </span>
                            <BadgeControl variant="outline" className="text-[10px] uppercase">
                              {option.entityType}
                            </BadgeControl>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <AtSign className="h-3.5 w-3.5" />
              {t('features.messages.compose.attachmentHelperText')}
            </p>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={MESSAGE_ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={event => {
                  void handleFileChange(event);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.isUploadingAttachments}
                title={t('features.messages.compose.uploadFiles')}
              >
                {attachments.isUploadingAttachments ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="submit"
                size="icon"
                disabled={
                  (!messageText.trim() && attachments.selectedAttachments.length === 0) ||
                  attachments.isUploadingAttachments
                }
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      )}
    </CardContent>
  );
}
