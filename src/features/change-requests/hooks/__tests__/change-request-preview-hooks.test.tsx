/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCREditorPreviewModel } from '../useCREditorPreviewModel';
import { useEditorViewModeToggleController } from '../useEditorViewModeToggleController';
import { useSuggestionPreview } from '../useSuggestionPreview';

const mocks = vi.hoisted(() => ({
  filter: vi.fn((content: unknown, ids: Set<string>, resolutions?: Map<string, string>) => ({
    content,
    ids: [...ids],
    resolutions: resolutions ? [...resolutions] : undefined,
  })),
  createSlateEditor: vi.fn((options: unknown) => ({ options })),
}));

vi.mock('@/features/change-requests/logic/filterDocumentToSingleSuggestion', () => ({
  filterDocumentToSuggestions: mocks.filter,
}));

vi.mock('platejs', () => ({ createSlateEditor: mocks.createSlateEditor }));
vi.mock('@/features/shared/ui/kit-platejs/editor-base-kit', () => ({
  BaseEditorKit: ['base-plugin'],
}));

const documentContent: any = [{ type: 'p', children: [{ text: 'Policy' }] }];
const changeRequests = [
  { id: 'cr-1', crId: 'CR-1', title: 'First', type: 'insert' },
  { id: 'cr-2', crId: 'CR-2', title: 'Second', type: 'replace' },
];

beforeEach(() => vi.clearAllMocks());

describe('change-request preview hooks', () => {
  it('creates a static filtered editor only while a non-interactive preview is open', () => {
    const resolutions = new Map<any, any>([
      ['cr-2', 'reject'],
      ['cr-1', 'accept'],
    ]);
    const { result, rerender } = renderHook((props: any) => useCREditorPreviewModel(props), {
      initialProps: {
        documentContent,
        suggestionIds: new Set(['cr-1']),
        suggestionResolutions: resolutions,
        allowInteractiveEditor: false,
        amendmentId: 'amendment-1',
        editingMode: 'direct',
      },
    });
    expect(result.current.editor).toBeNull();
    act(() => result.current.onOpenChange(true));
    expect(mocks.filter).toHaveBeenCalledWith(documentContent, new Set(['cr-1']), resolutions);
    expect(mocks.createSlateEditor).toHaveBeenCalledWith({
      plugins: ['base-plugin'],
      value: expect.objectContaining({ ids: ['cr-1'] }),
    });
    expect(result.current.editor).toEqual(expect.any(Object));

    rerender({
      documentContent,
      suggestionIds: new Set(['cr-1']),
      suggestionResolutions: resolutions,
      allowInteractiveEditor: true,
      amendmentId: 'amendment-1',
      editingMode: 'suggest_event',
    });
    expect(result.current.isInteractive).toBe(true);
    expect(result.current.editor).toBeNull();
  });

  it('uses the default static mode and supports previews without resolution metadata', () => {
    const { result } = renderHook(() =>
      useCREditorPreviewModel({
        documentContent,
        suggestionIds: new Set(['cr-2']),
      })
    );

    expect(result.current.isInteractive).toBe(false);
    act(() => result.current.onOpenChange(true));

    expect(mocks.filter).toHaveBeenCalledWith(documentContent, new Set(['cr-2']), undefined);
    expect(result.current.editor).toEqual(expect.any(Object));
  });

  it('toggles all and single modes, auto-selects a first change, and closes explicit selection', () => {
    const onModeChange = vi.fn();
    const onSelectedCRChange = vi.fn();
    const { result, rerender } = renderHook(
      (props: any) => useEditorViewModeToggleController(props),
      {
        initialProps: {
          mode: 'all',
          onModeChange,
          selectedCRId: null as string | null,
          onSelectedCRChange,
          changeRequests,
        },
      }
    );
    act(() => result.current.onModeToggle());
    expect(onModeChange).toHaveBeenCalledWith('single');
    expect(onSelectedCRChange).toHaveBeenCalledWith('cr-1');
    act(() => result.current.onOpenChange(true));
    act(() => result.current.onSelectCR('cr-2'));
    expect(onSelectedCRChange).toHaveBeenLastCalledWith('cr-2');
    expect(result.current.open).toBe(false);

    rerender({
      mode: 'single',
      onModeChange,
      selectedCRId: 'cr-2',
      onSelectedCRChange,
      changeRequests,
    });
    expect(result.current.selectedCR).toEqual(changeRequests[1]);
    act(() => result.current.onModeToggle());
    expect(onModeChange).toHaveBeenLastCalledWith('all');
    expect(onSelectedCRChange).toHaveBeenLastCalledWith(null);
  });

  it('does not replace an existing selection when entering single mode', () => {
    const onModeChange = vi.fn();
    const onSelectedCRChange = vi.fn();
    const { result } = renderHook(() =>
      useEditorViewModeToggleController({
        mode: 'all',
        onModeChange,
        selectedCRId: 'cr-2',
        onSelectedCRChange,
        changeRequests,
      })
    );

    act(() => result.current.onModeToggle());

    expect(onModeChange).toHaveBeenCalledWith('single');
    expect(onSelectedCRChange).not.toHaveBeenCalled();
  });

  it('returns original or single-suggestion content and preserves mapped option contracts', () => {
    const { result } = renderHook(() =>
      useSuggestionPreview(documentContent, changeRequests, null)
    );
    expect(result.current.previewContent).toBe(documentContent);
    expect(result.current.crOptions).toEqual(changeRequests);
    act(() => result.current.setViewMode('single'));
    expect(result.current.selectedCRId).toBe('cr-1');
    expect(result.current.previewContent).toEqual(
      expect.objectContaining({ content: documentContent, ids: ['cr-1'] })
    );
    act(() => result.current.setSelectedCRId('cr-2'));
    expect(result.current.previewContent).toEqual(expect.objectContaining({ ids: ['cr-2'] }));
    act(() => result.current.setViewMode('all'));
    expect(result.current.previewContent).toBe(documentContent);
  });

  it('keeps an undefined document undefined in every view mode', () => {
    const { result } = renderHook(() => useSuggestionPreview(undefined, changeRequests));

    expect(result.current.previewContent).toBeUndefined();
    act(() => result.current.setViewMode('single'));
    expect(result.current.previewContent).toBeUndefined();
  });
});
