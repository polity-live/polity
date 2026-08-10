/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CREditorPreviewView } from '../CREditorPreviewView';

vi.mock('@/features/shared/ui/ui-platejs/editor-static', () => ({
  EditorStatic: ({ variant }: { variant?: string }) => (
    <div data-testid="editor-static" data-variant={variant} />
  ),
}));

vi.mock('@/features/editor/ui/InlineAmendmentEditor', () => ({
  InlineAmendmentEditor: (props: Record<string, unknown>) => (
    <div data-testid="inline-amendment-editor" data-props={JSON.stringify(props)} />
  ),
}));

afterEach(cleanup);

describe('CREditorPreviewView spacing', () => {
  it('uses responsive document insets for the static preview without double padding', () => {
    const onOpenChange = vi.fn();
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
        onOpenChange={onOpenChange}
      />
    );

    const editor = screen.getByTestId('editor-static');
    const panel = editor.parentElement;

    expect(editor.getAttribute('data-variant')).toBe('preview');
    expect(panel?.className).not.toContain('p-4');
    expect(panel?.className).toContain('border');
    const toggle = document.querySelector<HTMLElement>(
      '[data-action-id="change-requests.preview.toggle"]'
    )!;
    toggle.focus();
    fireEvent.keyDown(toggle, { key: 'Enter' });
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalled();
  });

  it('renders the closed state without a toolbar or static editor', () => {
    const { container } = render(
      <CREditorPreviewView
        documentContent={[]}
        suggestionIds={new Set()}
        amendmentId={null}
        userId={null}
        agendaItemId={null}
        editor={null}
        isInteractive={false}
        isOpen={false}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('editor-static')).toBeNull();
    expect(screen.queryByTestId('inline-amendment-editor')).toBeNull();
    expect(container.querySelector('.ml-auto')).toBeNull();
  });

  it('renders an interactive editor and the optional toolbar', () => {
    render(
      <CREditorPreviewView
        documentContent={[]}
        suggestionIds={new Set(['cr-1'])}
        editingMode="suggest_event"
        amendmentId="amendment-1"
        userId="user-1"
        userRecord={{ id: 'user-1' }}
        agendaItemId="agenda-1"
        editor={{}}
        isInteractive
        isOpen
        onOpenChange={vi.fn()}
        toolbarEnd={<span>Toolbar</span>}
      />
    );

    expect(screen.getByText('Toolbar')).toBeTruthy();
    expect(screen.getByTestId('inline-amendment-editor')).toBeTruthy();
    expect(screen.queryByTestId('editor-static')).toBeNull();
  });

  it('does not mount an interactive editor without an amendment id', () => {
    render(
      <CREditorPreviewView
        documentContent={[]}
        suggestionIds={new Set()}
        amendmentId={null}
        userId={null}
        agendaItemId={null}
        editor={{}}
        isInteractive
        isOpen
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('inline-amendment-editor')).toBeNull();
    expect(screen.getByTestId('editor-static')).toBeTruthy();
  });
});
