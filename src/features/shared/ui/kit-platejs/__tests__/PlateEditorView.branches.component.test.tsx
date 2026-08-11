/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ editorProps: null as any, debug: vi.fn() }));

vi.mock('platejs/react', () => ({ Plate: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/features/charts/context/ChartDatasetContext', () => ({
  ChartDatasetContextProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('../settings-dialog.tsx', () => ({ SettingsDialog: () => <div>settings</div> }));
vi.mock('@/features/shared/ui/ui-platejs/editor.tsx', () => ({
  Editor: (props: any) => {
    mocks.editorProps = props;
    return <div>editor</div>;
  },
  EditorContainer: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../suggestion-callbacks-context.tsx', () => ({
  SuggestionCallbacksProvider: ({ children }: any) => <>{children}</>,
}));
vi.mock('../mode-context.tsx', () => ({ ModeProvider: ({ children }: any) => <>{children}</> }));
vi.mock('../mode-sync.tsx', () => ({ ModeSync: () => null }));
vi.mock('@/features/editor/ui/RemoteCursorsSync', () => ({
  RemoteCursorsSync: () => <div>remote cursors</div>,
}));
vi.mock('@/features/shared/logic/editorSelectionDebug', () => ({
  editorSelectionDebugLog: mocks.debug,
  getActiveElementDebugInfo: () => ({ active: true }),
  summarizeSelection: (selection: unknown) => selection,
}));

import { PlateEditorView } from '../PlateEditorView';

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    currentMode: 'edit',
    datasetContext: null,
    documentId: 'document-1',
    editor: { selection: null, tf: { insertText: vi.fn() } },
    handleEditorChange: vi.fn(),
    isOwnerOrCollaborator: true,
    readOnly: false,
    showSettingsDialog: false,
    ...overrides,
  } as any;
}

function paste(types: string[], text = 'text') {
  const event = {
    clipboardData: { getData: vi.fn(() => text), types },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as any;
  mocks.editorProps.onPasteCapture(event);
  return event;
}

describe('PlateEditorView branches', () => {
  it('guards non-suggestion and rich paste paths', () => {
    const view = render(<PlateEditorView {...makeProps()} />);
    paste(['text/plain']);

    view.rerender(<PlateEditorView {...makeProps({ currentMode: 'suggest_internal' })} />);
    paste(['text/plain', 'text/html']);
    paste(['text/html']);
  });

  it('ignores empty plain text and inserts non-empty suggestion text', () => {
    const props = makeProps({ currentMode: 'suggest_event' });
    render(<PlateEditorView {...props} />);
    paste(['text/plain'], '');
    const event = paste(['text/plain'], 'insert me');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(props.editor.tf.insertText).toHaveBeenCalledWith('insert me');
  });

  it('renders optional remote cursors and settings and logs focus', () => {
    const props = makeProps({
      remoteCursors: {
        enabled: true,
        entityId: 'entity',
        userId: 'user',
        userName: 'User',
      },
      showSettingsDialog: true,
    });
    const view = render(<PlateEditorView {...props} />);
    expect(screen.getByText('remote cursors')).toBeTruthy();
    expect(screen.getByText('settings')).toBeTruthy();
    mocks.editorProps.onFocus();
    expect(mocks.debug).toHaveBeenCalled();

    view.rerender(<PlateEditorView {...makeProps()} />);
    expect(screen.queryByText('remote cursors')).toBeNull();
    expect(screen.queryByText('settings')).toBeNull();
  });
});
