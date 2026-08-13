/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_TUTORIAL_EXPECTED_INPUTS } from '@/features/app-tutorial/catalog';
import { APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT } from '@/features/app-tutorial/events';
import { AssistantMessageInput } from '../AssistantMessageInput';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('../AssistantMessageInputView', () => ({
  AssistantMessageInputView: ({
    messageText,
    setMessageText,
    handleSubmit,
  }: {
    messageText: string;
    setMessageText: (value: string) => void;
    handleSubmit: () => Promise<void>;
  }) => (
    <>
      <input
        aria-label="Message"
        value={messageText}
        onChange={event => setMessageText(event.target.value)}
      />
      <button type="button" onClick={() => void handleSubmit()}>
        Send
      </button>
    </>
  ),
}));

afterEach(cleanup);

describe('AssistantMessageInput tutorial spotlight', () => {
  it('requests the chat spotlight immediately when the tutorial prompt is sent', async () => {
    let resolveSend: (() => void) | undefined;
    const sendAssistantMessage = vi.fn(
      (
        _content: string,
        options?: {
          onUserMessageSent?: () => void;
        }
      ) => {
        options?.onUserMessageSent?.();
        return new Promise<boolean>(resolve => {
          resolveSend = () => resolve(true);
        });
      }
    );
    const spotlight = vi.fn();
    window.addEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, spotlight);

    render(
      <AssistantMessageInput
        assistantChat={
          {
            selectedSkillSlugs: [],
            selectedToolNames: [],
            selectedAttachments: [],
            availableTools: [],
            attachmentOptions: [],
            availableSkills: [],
            models: [],
            selectedModel: null,
            isSending: false,
            isUploadingAttachments: false,
            isTutorialConversation: true,
            sendAssistantMessage,
          } as any
        }
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: APP_TUTORIAL_EXPECTED_INPUTS.assistantTodo },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendAssistantMessage).toHaveBeenCalledOnce();
    expect(spotlight).toHaveBeenCalledOnce();
    expect(spotlight.mock.calls[0]?.[0]).toMatchObject({
      detail: { anchor: 'tutorial-assistant-chat' },
    });

    await act(async () => resolveSend?.());
    window.removeEventListener(APP_TUTORIAL_SPOTLIGHT_TARGET_EVENT, spotlight);
  });
});
