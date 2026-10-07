import * as React from 'react';
import { Chat, useChat as useBaseChat } from '@ai-sdk/react';
import { DefaultChatTransport, type ChatRequestOptions } from 'ai';
import type { AIChatPluginConfig } from '@platejs/ai/react';
import type { PlateEditor } from 'platejs/react';
import { useAuth } from '@/providers/auth-provider';
import { useAiEditorDocumentId } from './ai-editor-trace-context';
import {
  editorContextSystemMessage,
  getEditorPromptContext,
  resolveEditorPrompt,
} from './ai-editor-context';

export interface PlateEditorChatOptions {
  api?: string;
  body?: Record<string, unknown>;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
}

const DEFAULT_EDITOR_CHAT_OPTIONS: PlateEditorChatOptions = {
  api: '/api/ai/command',
  body: {},
};

export interface EditorCommandMessage {
  role: 'assistant' | 'system' | 'user';
  content: string;
}

export interface LegacyChatMessage {
  content?: string | { text?: string; type?: string }[];
  id?: string;
  parts?: EditorUIMessage['parts'];
  role: string;
}

type LegacyAppendOptions = ChatRequestOptions;
type EditorUIMessage = AIChatPluginConfig['options']['chat']['messages'][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getSystemMessageFromBody(body: unknown): EditorCommandMessage | null {
  if (!isRecord(body) || typeof body.system !== 'string') {
    return null;
  }

  const content = body.system.trim();
  return content ? { role: 'system', content } : null;
}

export function getMessageTextContent(message: LegacyChatMessage): string {
  const { content, parts } = message;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  if (Array.isArray(parts)) {
    return parts
      .map(part => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

export function toLegacyMessage(message: EditorUIMessage): LegacyChatMessage {
  return {
    ...message,
    content: getMessageTextContent(message),
  };
}

export function toUiMessage(message: LegacyChatMessage, index: number): EditorUIMessage {
  return {
    id: message.id ?? `editor-message-${index}`,
    role:
      message.role === 'assistant' || message.role === 'system' || message.role === 'user'
        ? message.role
        : 'user',
    parts: Array.isArray(message.parts)
      ? [...message.parts]
      : [{ type: 'text', text: getMessageTextContent(message) }],
  };
}

export function buildEditorCommandBody(
  messages: readonly LegacyChatMessage[],
  body?: unknown,
  editor?: PlateEditor
): { messages: EditorCommandMessage[] } {
  const context = editor ? getEditorPromptContext(editor, body) : undefined;
  const system = [
    getSystemMessageFromBody(body)?.content,
    context ? editorContextSystemMessage(context) : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  const editorMessages: EditorCommandMessage[] = messages.flatMap(message => {
    if (message.role !== 'assistant' && message.role !== 'system' && message.role !== 'user') {
      return [];
    }

    const content = getMessageTextContent(message);

    if (!content) {
      return [];
    }

    return [
      {
        role: message.role,
        content,
      },
    ];
  });

  return {
    messages: system ? [{ role: 'system', content: system }, ...editorMessages] : editorMessages,
  };
}

export function getAppendText(message?: LegacyChatMessage | { text?: string }): string {
  if (!message) {
    return '';
  }

  if ('text' in message && typeof message.text === 'string') {
    return message.text;
  }

  return 'role' in message ? getMessageTextContent(message) : '';
}

export const useChat = (editor?: PlateEditor) => {
  const options = DEFAULT_EDITOR_CHAT_OPTIONS;
  const { session } = useAuth();
  const documentId = useAiEditorDocumentId();

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport<EditorUIMessage>({
        api: options.api,
        body: options.body,
        credentials: options.credentials,
        headers: {
          ...options.headers,
          ...(documentId ? { 'X-AI-Document-Id': documentId } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        prepareSendMessagesRequest: ({ messages, body, headers, credentials, api }) => ({
          api,
          body: buildEditorCommandBody(messages.map(toLegacyMessage), body, editor),
          credentials,
          headers,
        }),
      }),
    [
      options.api,
      options.body,
      options.credentials,
      options.headers,
      session?.access_token,
      documentId,
      editor,
    ]
  );

  const chatInstance = React.useMemo(
    () =>
      new Chat<EditorUIMessage>({
        id: 'editor',
        transport,
      }),
    [transport]
  );

  const chat = useBaseChat<EditorUIMessage>({ chat: chatInstance });
  const sendMessage: typeof chat.sendMessage = React.useCallback(
    (message, requestOptions) => {
      // Store expanded presets in SDK history so later turns don't reinterpret old placeholders.
      if (editor && message && 'text' in message && typeof message.text === 'string') {
        return chat.sendMessage(
          {
            ...message,
            text: resolveEditorPrompt(
              message.text,
              getEditorPromptContext(editor, requestOptions?.body)
            ),
          },
          requestOptions
        );
      }
      return chat.sendMessage(message, requestOptions);
    },
    [chat.sendMessage, editor]
  );
  // Plate consumes native SDK messages and methods, not the legacy adapter below.
  const plateChat = React.useMemo(
    () => ({ ...chat, sendMessage }),
    [
      chat.id,
      chat.messages,
      chat.status,
      chat.error,
      sendMessage,
      chat.regenerate,
      chat.stop,
      chat.setMessages,
      chat.resumeStream,
      chat.addToolResult,
      chat.addToolOutput,
      chat.addToolApprovalResponse,
      chat.clearError,
    ]
  );

  const [input, setInput] = React.useState('');
  const messages = React.useMemo(() => chat.messages.map(toLegacyMessage), [chat.messages]);
  const setMessages = React.useCallback(
    (
      nextMessages:
        LegacyChatMessage[] | ((currentMessages: LegacyChatMessage[]) => LegacyChatMessage[])
    ) => {
      chat.setMessages(currentMessages => {
        const currentLegacyMessages = currentMessages.map(toLegacyMessage);
        const resolvedMessages =
          typeof nextMessages === 'function' ? nextMessages(currentLegacyMessages) : nextMessages;

        return resolvedMessages.map(toUiMessage);
      });
    },
    [chat]
  );
  const append = React.useCallback(
    async (
      message?: LegacyChatMessage | { text?: string },
      appendOptions?: LegacyAppendOptions
    ) => {
      const text = getAppendText(message);
      if (!text) return;

      await sendMessage({ text }, appendOptions);
    },
    [sendMessage]
  );
  const reload = React.useCallback(
    (reloadOptions?: LegacyAppendOptions) => chat.regenerate(reloadOptions),
    [chat]
  );

  return {
    ...chat,
    sendMessage,
    append,
    data: undefined,
    handleInputChange: (
      event: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>
    ) => setInput(event.target.value),
    handleSubmit: (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      const text = input.trim();
      if (!text) return;
      setInput('');
      void append({ role: 'user', content: text });
    },
    input,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    messages,
    plateChat,
    reload,
    setInput,
    setMessages,
  };
};
