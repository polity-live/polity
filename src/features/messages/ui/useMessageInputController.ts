import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Conversation } from '../types/message.types';
import { getOtherParticipant, isConversationRequester } from '../logic/messageUtils';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import {
  ASSISTANT_ATTACHMENT_TYPE_OPTIONS,
  getSuggestionAnchorPosition,
  parseActiveMentionQuery,
  replaceTextRange,
  type SuggestionAnchorPosition,
} from '../logic/assistantComposer';
import { useMessageAttachments } from '../hooks/useMessageAttachments';

interface MessageInputProps {
  conversation: Conversation;
  currentUserId?: string;
  onSendMessage: (content: string, contextJson: string) => Promise<boolean>;
}
export function useMessageInputController({
  conversation,
  currentUserId,
  onSendMessage,
}: MessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const otherUser = getOtherParticipant(conversation, currentUserId);
  const otherParticipantName =
    [otherUser?.first_name, otherUser?.last_name].filter(Boolean).join(' ') ||
    t('common.labels.unspecifiedUser');
  const isPendingDirectConversation =
    conversation.type === 'direct' && conversation.status === 'pending';
  const isCurrentUserRequester = isConversationRequester(conversation, currentUserId);

  if (isPendingDirectConversation && !isCurrentUserRequester) {
    return null;
  }
  return {
    conversation,
    currentUserId,
    onSendMessage,
    t,
    textareaRef,
    attachments,
    messageText,
    setMessageText,
    caretPosition,
    setCaretPosition,
    suggestionAnchorPosition,
    setSuggestionAnchorPosition,
    textareaScrollVersion,
    setTextareaScrollVersion,
    mentionQuery,
    selectedAttachmentKeys,
    attachmentTypeSuggestions,
    attachmentSuggestions,
    hasSuggestionPanel,
    updateCaretPosition,
    moveCaret,
    applyMessageReplacement,
    handleAttachmentTypeSelect,
    handleAttachmentSelect,
    handleSendMessage,
    otherUser,
    otherParticipantName,
    isPendingDirectConversation,
    isConversationRequester: isCurrentUserRequester,
  };
}
