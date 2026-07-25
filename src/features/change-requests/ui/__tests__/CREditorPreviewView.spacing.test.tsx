/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREditorPreviewView } from '../CREditorPreviewView';

vi.mock('@/features/shared/ui/ui-platejs/editor-static', () => ({
  EditorStatic: ({ variant }: { variant?: string }) => (
    <div data-testid="editor-static" data-variant={variant} />
  ),
}));

vi.mock('@/features/editor/ui/InlineAmendmentEditor', () => ({
  InlineAmendmentEditor: () => <div data-testid="inline-amendment-editor" />,
}));

afterEach(cleanup);

describe('CREditorPreviewView spacing', () => {
  it('uses responsive document insets for the static preview without double padding', () => {
    render(
      <CREditorPreviewView
        documentContent={[]}
        suggestionIds={new Set()}
        amendmentId={null}
        userId={null}
        agendaItemId={null}
        editor={{}}
        isInteractive={false}
        isOpen
        onOpenChange={vi.fn()}
      />
    );

    const editor = screen.getByTestId('editor-static');
    const panel = editor.parentElement;

    expect(editor.getAttribute('data-variant')).toBe('preview');
    expect(panel?.className).not.toContain('p-4');
    expect(panel?.className).toContain('border');
  });
});
