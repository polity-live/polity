/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  editor: { getOptions: vi.fn(), setOption: vi.fn() },
  viewProps: null as any,
}));

vi.mock('platejs/react', () => ({ useEditorRef: () => mocks.editor }));
vi.mock('@platejs/ai/react', () => ({ CopilotPlugin: {} }));
vi.mock('../SettingsDialogView', () => ({
  SettingsDialogView: (props: any) => {
    mocks.viewProps = props;
    return <div>settings view</div>;
  },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

import { SettingsDialog } from '../settings-dialog';

describe('SettingsDialog branches', () => {
  it('submits default and existing options and toggles API-key visibility', () => {
    mocks.editor.getOptions.mockReturnValue({ completeOptions: undefined });
    render(<SettingsDialog />);
    const preventDefault = vi.fn();
    mocks.viewProps.handleSubmit({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(mocks.editor.setOption).toHaveBeenCalledWith(
      expect.anything(),
      'completeOptions',
      expect.objectContaining({ body: expect.objectContaining({ model: 'gpt-4o-mini' }) })
    );

    mocks.editor.getOptions.mockReturnValue({
      completeOptions: { body: { existing: true }, headers: { test: 'yes' } },
    });
    mocks.viewProps.handleSubmit({ preventDefault: vi.fn() });
    expect(mocks.editor.setOption).toHaveBeenLastCalledWith(
      expect.anything(),
      'completeOptions',
      expect.objectContaining({ headers: { test: 'yes' } })
    );

    const keyInput = render(mocks.viewProps.renderApiKeyInput('openai', 'OpenAI API key'));
    expect(screen.getByLabelText('OpenAI API key').getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    keyInput.rerender(mocks.viewProps.renderApiKeyInput('openai', 'OpenAI API key'));
    expect(screen.getByLabelText('OpenAI API key').getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: /hide/i })).toBeTruthy();
  });
});
