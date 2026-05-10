import { useChat as useBaseChat } from '@ai-sdk/react';
import { usePluginOption } from 'platejs/react';

import { aiChatPlugin } from '@/features/shared/ui/kit-platejs/ai-kit.tsx';
import { useAuth } from '@/providers/auth-provider';

interface EditorCommandMessage {
  role: 'assistant' | 'system' | 'user';
  content: string;
}

function getMessageTextContent(
  content: string | { text?: string; type?: string }[] | undefined
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(part => {
      if (typeof part.text === 'string') {
        return part.text;
      }

      return '';
    })
    .join('');
}

function buildEditorCommandBody(
  messages: readonly {
    role: string;
    content?: string | { text?: string; type?: string }[];
  }[]
): { messages: EditorCommandMessage[] } {
  return {
    messages: messages.flatMap(message => {
      if (message.role !== 'assistant' && message.role !== 'system' && message.role !== 'user') {
        return [];
      }

      const content = getMessageTextContent(message.content);

      if (!content) {
        return [];
      }

      return [
        {
          role: message.role,
          content,
        },
      ];
    }),
  };
}

export const useChat = () => {
  const options = usePluginOption(aiChatPlugin, 'chatOptions');
  const { session } = useAuth();

  return useBaseChat({
    ...options,
    id: 'editor',
    headers: session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : undefined,
    experimental_prepareRequestBody: ({ messages }) => buildEditorCommandBody(messages),
  });
};
