import { Conversation } from '../types/message.types';

interface MessageInputProps {
  conversation: Conversation;
  currentUserId?: string;
  onSendMessage: (content: string, contextJson: string) => Promise<boolean>;
}
import { useMessageInputController } from './useMessageInputController';
import { MessageInputView } from './MessageInputView';

export function MessageInput({ conversation, currentUserId, onSendMessage }: MessageInputProps) {
  const viewProps = useMessageInputController({ conversation, currentUserId, onSendMessage });

  if (!viewProps) {
    return null;
  }

  return <MessageInputView {...viewProps} />;
}
