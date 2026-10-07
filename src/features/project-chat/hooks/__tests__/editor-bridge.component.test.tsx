// @vitest-environment jsdom
import { useRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EditorContext, ProjectScope } from '../../logic/contracts';
import {
  focusProjectEditor,
  flushProjectEditor,
  projectTextSelection,
  useProjectEditorBridge,
  useProjectEditorSnapshot,
  useProjectTextSelection,
  useProjectTextSelectionSnapshot,
  type EditorPublication,
  type ProjectEditorFocus,
} from '../editor-bridge';
afterEach(cleanup);
const scope = () => ({ kind: 'studio' as const, projectId: crypto.randomUUID() });
const context: EditorContext = {
  surface: 'studio',
  contentRevision: 1,
  proposalId: null,
  branchId: null,
};

it('uses a caller fallback for unavailable editors and keeps both server-rendered snapshots empty', async () => {
  const project = scope();
  expect(await flushProjectEditor(project, context)).toBe(context);
  expect(await focusProjectEditor(project, { nodeId: 'title', workspaceId: null })).toBe(false);
  const hook = renderHook(() => {
    useProjectEditorBridge(null, async () => context);
    return useProjectEditorSnapshot(project, 'studio');
  });
  expect(hook.result.current).toBeUndefined();
  function ServerSnapshot() {
    const publication = useProjectEditorSnapshot(project, 'studio');
    const text = useProjectTextSelectionSnapshot('document');
    return <output>{JSON.stringify({ publication, text })}</output>;
  }
  expect(renderToString(<ServerSnapshot />)).toBe('<output>{}</output>');
});

it('flushes a legacy editor under its actual current callback and returns no native focus target', async () => {
  const project = scope();
  const first = vi.fn(async () => context),
    second = vi.fn(async () => ({ ...context, contentRevision: 2 }));
  const hook = renderHook(({ flush }) => useProjectEditorBridge(project, flush), {
    initialProps: { flush: first },
  });
  expect(await flushProjectEditor(project, context)).toBe(context);
  hook.rerender({ flush: second });
  expect(await flushProjectEditor(project, context)).toMatchObject({ contentRevision: 2 });
  expect(second).toHaveBeenCalledOnce();
  expect(await focusProjectEditor(project, { nodeId: 'title', workspaceId: null })).toBe(false);
  hook.unmount();
  expect(await flushProjectEditor(project, context)).toBe(context);
});

it('publishes immutable updated editor context, retains equal snapshots, and clears a removed publication', async () => {
  const project = scope();
  const publication: EditorPublication = { context };
  const hook = renderHook(
    ({ publication }: { publication: EditorPublication | undefined }) => {
      useProjectEditorBridge(project, async () => publication?.context ?? context, publication);
      return useProjectEditorSnapshot(project, 'studio');
    },
    { initialProps: { publication: publication as EditorPublication | undefined } }
  );
  expect(hook.result.current).toBe(publication);
  const next: EditorPublication = { context: { ...context, contentRevision: 2 } };
  hook.rerender({ publication: next });
  expect(hook.result.current).toEqual(next);
  expect(hook.result.current).not.toBe(next);
  const stored = hook.result.current;
  hook.rerender({ publication: structuredClone(next) });
  expect(hook.result.current).toBe(stored);
  next.context.contentRevision = 99;
  expect(stored!.context.contentRevision).toBe(2);
  hook.rerender({ publication: undefined });
  expect(hook.result.current).toBeUndefined();
});

it('retains the newer owner when an older editor with the same surface unmounts or republishes', async () => {
  const project = scope();
  const first = renderHook(
    ({ publication }) =>
      useProjectEditorBridge(project, async () => publication.context, publication),
    { initialProps: { publication: { context } } }
  );
  const newer = { context: { ...context, contentRevision: 2 } };
  const second = renderHook(() => {
    useProjectEditorBridge(project, async () => newer.context, newer);
    return useProjectEditorSnapshot(project, 'studio');
  });
  first.rerender({ publication: { context: { ...context, contentRevision: 3 } } });
  expect(second.result.current).toEqual(newer);
  first.unmount();
  expect(await flushProjectEditor(project, context)).toBe(newer.context);
  expect(second.result.current).toEqual(newer);
});

it('forwards native node focus through the latest registered callback and rejects a removed canvas callback', async () => {
  const project = scope();
  const first = vi.fn(async () => undefined),
    second = vi.fn(async () => undefined);
  const hook = renderHook(
    ({ focus }: { focus: ProjectEditorFocus | undefined }) =>
      useProjectEditorBridge(project, async () => context, { context }, focus),
    { initialProps: { focus: first as ProjectEditorFocus | undefined } }
  );
  const target = { nodeId: 'title', workspaceId: crypto.randomUUID() };
  expect(await focusProjectEditor(project, target)).toBe(true);
  expect(first).toHaveBeenCalledWith(target);
  hook.rerender({ focus: second });
  expect(await focusProjectEditor(project, target)).toBe(true);
  expect(second).toHaveBeenCalledWith(target);
  hook.rerender({ focus: undefined });
  await expect(focusProjectEditor(project, target)).rejects.toThrow('Canvas unavailable');
});

it.each(['proposalId', 'branchId'] as const)(
  'rejects a %s switch while the editor is saving and leaves the published replacement intact',
  async field => {
    const project = scope();
    let complete: (value: EditorContext) => void = () => {
      throw Error('Save not started');
    };
    const flush = () =>
      new Promise<EditorContext>(resolve => {
        complete = resolve;
      });
    const hook = renderHook(
      ({ publication }) => {
        useProjectEditorBridge(project, flush, publication);
        return useProjectEditorSnapshot(project, 'studio');
      },
      { initialProps: { publication: { context } } }
    );
    const pending = flushProjectEditor(project, context);
    const rejected = expect(pending).rejects.toThrow('workspace changed');
    const replacement = { context: { ...context, [field]: crypto.randomUUID() } };
    hook.rerender({ publication: replacement });
    await act(async () => complete({ ...context, contentRevision: 2 }));
    await rejected;
    expect(hook.result.current).toEqual(replacement);
  }
);

function NativeTextSelection({ documentId }: { documentId: string | undefined }) {
  const element = useRef<HTMLDivElement>(null);
  useProjectTextSelection(documentId, () => {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !element.current?.contains(selection.anchorNode)
    )
      return null;
    return {
      anchor: { path: [0, 0], offset: selection.anchorOffset },
      focus: { path: [0, 0], offset: selection.focusOffset },
    };
  });
  const selected = useProjectTextSelectionSnapshot(documentId ?? 'missing');
  return (
    <>
      <div
        contentEditable
        suppressContentEditableWarning
        ref={element}
        data-testid="text-selection"
      >
        Alpha
      </div>
      <output data-testid="selection-value">{JSON.stringify(selected)}</output>
    </>
  );
}
async function selectText(element: HTMLElement, from: number, to: number) {
  const range = document.createRange();
  range.setStart(element.firstChild!, from);
  range.setEnd(element.firstChild!, to);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  await act(async () => fireEvent(document, new Event('selectionchange')));
}

it('captures native text ranges without republishing equal selections and clears only its owned document on unmount', async () => {
  const documentId = crypto.randomUUID();
  const rendered = render(<NativeTextSelection documentId={documentId} />);
  expect(projectTextSelection(documentId)).toBeUndefined();
  await selectText(screen.getByTestId('text-selection'), 1, 4);
  const expected = { anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 4 } };
  expect(screen.getByTestId('selection-value').textContent).toBe(JSON.stringify(expected));
  expect(projectTextSelection(documentId)).toEqual(expected);
  const first = projectTextSelection(documentId);
  await selectText(screen.getByTestId('text-selection'), 1, 4);
  expect(projectTextSelection(documentId)).toBe(first);
  await selectText(screen.getByTestId('text-selection'), 0, 5);
  expect(projectTextSelection(documentId)).toMatchObject({
    anchor: { offset: 0 },
    focus: { offset: 5 },
  });
  rendered.unmount();
  expect(projectTextSelection(documentId)).toBeUndefined();
});

it('keeps a newer document selection registration after an older editor unmounts and ignores missing documents', async () => {
  const missing = render(<NativeTextSelection documentId={undefined} />);
  await selectText(screen.getByTestId('text-selection'), 0, 2);
  expect(projectTextSelection('missing')).toBeUndefined();
  missing.unmount();
  const documentId = crypto.randomUUID();
  const first = render(<NativeTextSelection documentId={documentId} />);
  const second = render(<NativeTextSelection documentId={documentId} />);
  await selectText(screen.getAllByTestId('text-selection')[1], 2, 5);
  first.unmount();
  expect(projectTextSelection(documentId)).toMatchObject({
    anchor: { offset: 2 },
    focus: { offset: 5 },
  });
  second.unmount();
  expect(projectTextSelection(documentId)).toBeUndefined();
});

it('keeps amendment text and city editor publications separate when a nullable bridge acquires a scope', async () => {
  const amendment: ProjectScope = { kind: 'amendment', amendmentId: crypto.randomUUID() };
  const text: EditorContext = { surface: 'amendment_text', documentId: crypto.randomUUID() };
  const hook = renderHook(
    ({ scope }: { scope: ProjectScope | null }) => {
      useProjectEditorBridge(scope, async () => text, { context: text });
      return useProjectEditorSnapshot(amendment, 'amendment_text');
    },
    { initialProps: { scope: null as ProjectScope | null } }
  );
  hook.rerender({ scope: amendment });
  expect(hook.result.current).toEqual({ context: text });
  expect(await flushProjectEditor(amendment, text)).toBe(text);
  expect(await flushProjectEditor(amendment, { surface: 'city_design' })).toEqual({
    surface: 'city_design',
  });
});
