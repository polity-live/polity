/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateGroup: vi.fn(() => ({ kind: 'update' })),
  updateConversation: vi.fn(() => ({ kind: 'conversation' })),
  waitForClientApply: vi.fn(async (value: unknown) => value),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/zero/groups/useGroupActions', () => ({
  useGroupActions: () => ({ createGroup: vi.fn(), updateGroup: mocks.updateGroup }),
}));
vi.mock('@/zero/common', () => ({
  useCommonActions: () => ({ syncEntityHashtags: vi.fn(async () => undefined) }),
  useCommonState: () => ({ groupHashtags: [], allHashtags: [] }),
}));
vi.mock('@/zero/messages/useMessageActions', () => ({
  useMessageActions: () => ({ updateConversation: mocks.updateConversation }),
}));
vi.mock('@/zero/messages/useMessageState', () => ({
  useMessageState: () => ({ groupConversation: { id: 'conversation-1' } }),
}));
vi.mock('@/zero/network', () => ({
  useGroupConnectionActions: () => ({
    proposeGroupConnectionChange: vi.fn(),
    deleteGroupConnection: vi.fn(),
  }),
  useGroupConnectionState: () => ({ groupConnections: [], groupConnectionRequests: [] }),
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: mocks.waitForClientApply,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

import { useGroupUpdate } from '../hooks/useGroupUpdate';
import { VisibilityInput } from '@/features/create/ui/inputs/VisibilityInput';

function GroupEditingFlow() {
  const editor = useGroupUpdate('group-1', {
    name: 'Original group',
    visibility: 'public',
  });
  return (
    <form
      onSubmit={event => {
        void editor.handleSubmit(event);
      }}
    >
      <label>
        Group name
        <input
          value={editor.formData.name}
          onChange={event => editor.updateField('name', event.target.value)}
        />
      </label>
      <VisibilityInput
        value={editor.formData.visibility}
        onChange={value => editor.updateField('visibility', value)}
      />
      <output aria-label="saved-view">
        {editor.formData.name}:{editor.formData.visibility}
      </output>
      <button type="submit">Save group</button>
    </form>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('group editing component flow', () => {
  it('edits group master data and submits the normalized mutation', async () => {
    render(<GroupEditingFlow />);
    await waitFor(() =>
      expect((screen.getByLabelText('Group name') as HTMLInputElement).value).toBe('Original group')
    );
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Renamed group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    await waitFor(() =>
      expect(mocks.updateGroup).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'group-1', name: 'Renamed group', visibility: 'public' })
      )
    );
    expect(mocks.updateConversation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conversation-1', name: 'Renamed group' })
    );
  });

  it('rejects unsupported visibility values at the rendered selection boundary', async () => {
    render(<GroupEditingFlow />);
    await waitFor(() =>
      expect((screen.getByLabelText('Group name') as HTMLInputElement).value).toBe('Original group')
    );
    const options = [...document.querySelectorAll('[role="option"]')].map(
      option => option.getAttribute('data-value') ?? option.textContent
    );
    expect(options.join(' ')).not.toContain('invalid-visibility');
    expect(screen.getByLabelText('saved-view').textContent).toContain('public');
  });

  it('projects the saved edit into the view state before the mutation settles', async () => {
    let release!: (value: unknown) => void;
    mocks.waitForClientApply.mockImplementationOnce(
      () => new Promise(resolve => (release = resolve)) as Promise<unknown>
    );
    render(<GroupEditingFlow />);
    await waitFor(() =>
      expect((screen.getByLabelText('Group name') as HTMLInputElement).value).toBe('Original group')
    );
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Immediate view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    expect(screen.getByLabelText('saved-view').textContent).toContain('Immediate view:public');
    await act(async () => release({ kind: 'update' }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });
});
