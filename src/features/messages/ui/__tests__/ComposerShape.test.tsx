/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantMessageInputView } from '../AssistantMessageInputView';
import { MessageInputView } from '../MessageInputView';

afterEach(cleanup);

const copy: Record<string, string> = {
  'common.send': 'Send',
  'features.messages.ai.modelPlaceholder': 'Choose model',
  'features.messages.ai.placeholder': 'Ask anything',
  'features.messages.ai.reasoning': 'Reasoning',
  'features.messages.ai.settings': 'Settings',
  'features.messages.compose.attachmentHelperText': 'Attach context',
  'features.messages.compose.messagePlaceholder': 'Write a message',
  'features.messages.compose.uploadFiles': 'Upload files',
};

const t = (key: string) => copy[key] ?? key;

function expectRoundedControl(element: Element | null) {
  expect(element).toBeTruthy();
  expect(element?.className).toContain('rounded-md');
  expect(element?.className).not.toContain('rounded-full');
}

describe('message composer control shapes', () => {
  it('uses rounded-corner upload and send actions in the regular composer', () => {
    const { container } = render(
      <MessageInputView
        conversation={{ status: 'accepted' }}
        currentUserId="user-1"
        onSendMessage={vi.fn()}
        t={t}
        textareaRef={createRef<HTMLTextAreaElement>()}
        attachments={{
          selectedAttachments: [],
          isUploadingAttachments: false,
          uploadingAttachmentName: null,
          addUploadedFiles: vi.fn(),
          removeAttachment: vi.fn(),
        }}
        messageText="Hello"
        setMessageText={vi.fn()}
        caretPosition={0}
        setCaretPosition={vi.fn()}
        suggestionAnchorPosition={null}
        setSuggestionAnchorPosition={vi.fn()}
        textareaScrollVersion={0}
        setTextareaScrollVersion={vi.fn()}
        mentionQuery=""
        selectedAttachmentKeys={new Set()}
        attachmentTypeSuggestions={[]}
        attachmentSuggestions={[]}
        hasSuggestionPanel={false}
        updateCaretPosition={vi.fn()}
        moveCaret={vi.fn()}
        applyMessageReplacement={vi.fn()}
        handleAttachmentTypeSelect={vi.fn()}
        handleAttachmentSelect={vi.fn()}
        handleSendMessage={vi.fn()}
        otherParticipantName="Kai"
        otherUser={null}
        isPendingDirectConversation={false}
        isConversationRequester={false}
      />
    );

    expectRoundedControl(screen.getByRole('button', { name: 'Upload files' }));
    expectRoundedControl(container.querySelector('button[type="submit"]'));
  });

  it('uses rounded-corner model and action controls in the AI composer', () => {
    const selectedModel = {
      provider: 'test',
      id: 'model',
      name: 'Test model',
      context_window: 200000,
      free: true,
      source: 'builtin',
      supports_reasoning_effort: true,
    };
    const assistantChat = {
      selectedSkills: [],
      selectedAttachments: [],
      isUploadingAttachments: false,
      uploadingAttachmentName: null,
      selectedModelKey: 'test:model',
      setSelectedModelKey: vi.fn(),
      selectedModel,
      models: [selectedModel],
      reasoningEffort: 'medium',
      setReasoningEffort: vi.fn(),
      selectedTools: [],
      availableSkills: [],
      setToolSelection: vi.fn(),
      setSkillSelection: vi.fn(),
      removeAttachment: vi.fn(),
      addUploadedFiles: vi.fn(),
      isSending: false,
    };

    render(
      <AssistantMessageInputView
        assistantChat={assistantChat}
        t={t}
        textareaRef={createRef<HTMLTextAreaElement>()}
        messageText="Hello"
        setMessageText={vi.fn()}
        caretPosition={0}
        setCaretPosition={vi.fn()}
        suggestionAnchorPosition={null}
        setSuggestionAnchorPosition={vi.fn()}
        textareaScrollVersion={0}
        setTextareaScrollVersion={vi.fn()}
        createSkillOpen={false}
        setCreateSkillOpen={vi.fn()}
        assistantSettingsOpen={false}
        setAssistantSettingsOpen={vi.fn()}
        skillName=""
        setSkillName={vi.fn()}
        skillSlug=""
        setSkillSlug={vi.fn()}
        skillAliases=""
        setSkillAliases={vi.fn()}
        skillPrompt=""
        setSkillPrompt={vi.fn()}
        selectedSkillKeySet={new Set()}
        selectedToolKeySet={new Set()}
        searchTools={[]}
        createTools={[]}
        updateTools={[]}
        mentionQuery=""
        skillCommand=""
        toolCommand=""
        selectedAttachmentKeys={new Set()}
        attachmentTypeSuggestions={[]}
        attachmentSuggestions={[]}
        skillSuggestions={[]}
        toolSuggestions={[]}
        hasSuggestionPanel={false}
        suggestionAnchorIndex={0}
        freeRouterLabel="Free router"
        freeRouterMessage="Free router"
        reliabilityMessage="Reliability"
        freeRouterModelKey="test:free"
        getModelDisplayLabel={() => 'Test model'}
        selectedModelHint={null}
        updateCaretPosition={vi.fn()}
        moveCaret={vi.fn()}
        applyMessageReplacement={vi.fn()}
        handleAttachmentTypeSelect={vi.fn()}
        handleAttachmentSelect={vi.fn()}
        handleSkillSelect={vi.fn()}
        handleToolSelect={vi.fn()}
        resetSkillForm={vi.fn()}
        handleCreateSkill={vi.fn()}
        handleSubmit={vi.fn()}
      />
    );

    expectRoundedControl(screen.getByRole('combobox', { name: 'Reasoning' }));
    expectRoundedControl(screen.getByRole('button', { name: 'Upload files' }));
    expectRoundedControl(screen.getByRole('button', { name: 'Send' }));
  });
});
