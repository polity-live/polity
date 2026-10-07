import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AssistantMessageInput } from '../AssistantMessageInput';
import type { AssistantChatController } from '../../hooks/useAssistantChat';
import type { ProjectContextReference } from '@/features/project-chat/logic/context-references';
import { buildAiModelKey } from '@/lib/ai/models';

const frame: ProjectContextReference = {
  kind: 'frame',
  id: crypto.randomUUID(),
  label: 'North plaza',
  origin: 'automatic',
  workspaceId: null,
};
const child: ProjectContextReference = {
  kind: 'element',
  id: crypto.randomUUID(),
  label: 'Oak tree',
  parentId: frame.id,
  origin: 'manual',
  workspaceId: null,
};
const detached: ProjectContextReference = {
  kind: 'element',
  id: crypto.randomUUID(),
  label: 'Detached bench',
  parentId: crypto.randomUUID(),
  origin: 'manual',
  workspaceId: null,
};
const root: ProjectContextReference = {
  kind: 'element',
  id: crypto.randomUUID(),
  label: 'Root annotation',
  origin: 'manual',
  workspaceId: null,
};

function controller(overrides: Record<string, unknown> = {}) {
  return {
    selectedSkills: [],
    selectedSkillSlugs: [],
    selectedTools: [],
    selectedToolNames: [],
    availableTools: [],
    availableSkills: [],
    models: [],
    selectedModel: null,
    selectedModelKey: '',
    selectedAttachments: [],
    attachmentOptions: [],
    reasoningEffort: 'medium',
    isSending: false,
    isUploadingAttachments: false,
    isTutorialConversation: false,
    setSelectedModelKey: vi.fn(),
    setReasoningEffort: vi.fn(),
    setToolSelection: vi.fn(),
    setSkillSelection: vi.fn(),
    removeAttachment: vi.fn(),
    addUploadedFiles: vi.fn(),
    ...overrides,
  } as unknown as AssistantChatController;
}

function Harness() {
  const [references, setReferences] = useState<ProjectContextReference[]>([frame]);
  const chat = controller({
    projectContextOptions: [
      frame,
      child,
      detached,
      root,
      {
        kind: 'studio_project',
        id: crypto.randomUUID(),
        label: 'Whole project',
        origin: 'automatic',
      },
    ],
    projectContextReferences: references,
    addProjectContext: (ref: ProjectContextReference) =>
      setReferences(current => [
        ...current.filter(item => item.id !== ref.id),
        { ...ref, origin: 'manual' },
      ]),
    removeProjectContext: (ref: ProjectContextReference) =>
      setReferences(current => current.filter(item => item.id !== ref.id)),
  });
  return (
    <div style={{ marginTop: 400, position: 'relative' }}>
      <AssistantMessageInput assistantChat={chat} compact />
    </div>
  );
}

function prompt() {
  return document.querySelector<HTMLTextAreaElement>(
    '[data-action-id="messages.assistant.prompt.change"]'
  )!;
}
function choices() {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-action-id="messages.assistant.suggestion.attachment.select"]'
    ),
  ];
}

it('selects actual project elements through native mentions, shows their frame and excludes manually selected duplicates', async () => {
  render(<Harness />);
  await userEvent.fill(prompt(), '@element@');
  await waitFor(() =>
    expect(choices().map(button => button.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Oak tree'),
        expect.stringContaining('Detached bench'),
        expect.stringContaining('Root annotation'),
      ])
    )
  );
  const choice = choices().find(button => button.textContent?.includes('Oak tree'))!;
  expect(choice.textContent).toContain('North plaza');
  await userEvent.click(choice);
  expect(prompt()).toHaveValue('');
  expect(screen.getByRole('button', { name: /remove.*Oak tree/i })).toBeVisible();
  await userEvent.fill(prompt(), '@element@');
  await waitFor(() =>
    expect(choices().some(button => button.textContent?.includes('Oak tree'))).toBe(false)
  );
  expect(choices().some(button => button.textContent?.includes('Detached bench'))).toBe(true);
});

it('offers frame and element mention types and permits explicit frame selection even when the frame is automatically contextual', async () => {
  render(<Harness />);
  await userEvent.fill(prompt(), '@');
  await waitFor(() =>
    expect(
      document.querySelectorAll(
        '[data-action-id="messages.assistant.suggestion.attachment-type.select"]'
      ).length
    ).toBeGreaterThan(0)
  );
  const types = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-action-id="messages.assistant.suggestion.attachment-type.select"]'
    ),
  ];
  expect(types.some(button => button.textContent?.includes('@frame@'))).toBe(true);
  expect(types.some(button => button.textContent?.includes('@element@'))).toBe(true);
  await userEvent.click(types.find(button => button.textContent?.includes('@frame@'))!);
  expect(prompt()).toHaveValue('@frame@');
  await waitFor(() => expect(choices()).toHaveLength(1));
  expect(choices()[0].textContent).toContain('North plaza');
  await userEvent.keyboard('{Enter}');
  expect(prompt()).toHaveValue('');
  expect(screen.getByRole('button', { name: /remove.*North plaza/i })).toBeVisible();
});

it('identifies text-only models through the real model selector without implying tool support', async () => {
  const model = {
    provider: 'openai' as const,
    id: 'text-only',
    label: 'Text model',
    source: 'byok' as const,
    supports_tools: false,
    context_window: 32000,
  };
  render(
    <AssistantMessageInput
      assistantChat={controller({
        models: [model],
        selectedModel: model,
        selectedModelKey: buildAiModelKey(model),
      })}
    />
  );
  const label = screen
    .getAllByRole('combobox')
    .find(control => control.dataset.actionId === 'messages.assistant.model.select')!;
  expect(label.textContent).toContain('Text model');
  expect(label.textContent).toContain('No tool support');
});

it('retains the mounted draft when session storage is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get: () => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    },
  });
  try {
    render(
      <AssistantMessageInput
        assistantChat={controller({ projectDraftKey: 'isolated-native-draft' })}
      />
    );
    await userEvent.fill(prompt(), 'Retained without storage');
    expect(prompt()).toHaveValue('Retained without storage');
  } finally {
    if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
    else Reflect.deleteProperty(window, 'sessionStorage');
  }
});
