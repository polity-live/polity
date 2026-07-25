/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorHeader } from '../EditorHeader';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'features.editor.header.allSaved': 'All changes saved',
          'features.editor.header.untitled': 'Untitled',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

afterEach(cleanup);

describe('EditorHeader mobile layout', () => {
  it('allows long titles to wrap and gives the saved status its own mobile row', () => {
    render(
      <EditorHeader
        title="A long amendment title that must remain inside the viewport"
        onTitleChange={vi.fn()}
        isEditingTitle={false}
        setIsEditingTitle={vi.fn()}
        canEditTitle={false}
        isSavingTitle={false}
        saveStatus="saved"
        hasUnsavedChanges={false}
        presenceSlot={<div>Presence</div>}
      />
    );

    const title = screen.getByRole('heading');
    const savedStatus = screen.getByText('All changes saved').parentElement;

    expect(title.className).toContain('break-words');
    expect(savedStatus?.className).toContain('w-full');
    expect(savedStatus?.className).toContain('md:w-auto');
  });
});
