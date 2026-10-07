// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EditorContext, ProjectScope } from '../../logic/contracts';
import type { ProjectContextReference } from '../../logic/context-references';
import { useProjectEditorBridge } from '../editor-bridge';
import { contextWithReferences, useProjectComposerContext } from '../useProjectComposerContext';
vi.mock('@/features/shared/hooks/use-translation', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
afterEach(cleanup);
const studio = () => ({ kind: 'studio' as const, projectId: crypto.randomUUID() });

it('replaces the automatic project identity when the scope changes under the same stable fallback and translation function', () => {
  const fallback: EditorContext = { surface: 'studio' };
  const first = studio(),
    second = studio();
  const hook = renderHook(({ scope }) => useProjectComposerContext(scope, fallback, 'Project'), {
    initialProps: { scope: first },
  });
  expect(hook.result.current.references.find(ref => ref.kind === 'studio_project')?.id).toBe(
    first.projectId
  );
  hook.rerender({ scope: second });
  expect(hook.result.current.references.find(ref => ref.kind === 'studio_project')?.id).toBe(
    second.projectId
  );
});

it('projects only referenced frame, element, city and text selections into the request context', () => {
  const selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 4 } };
  const context: EditorContext = {
    surface: 'amendment_text',
    selection,
    pageId: 'old',
    elementIds: ['old'],
    objectIds: ['old'],
    featureIds: ['old'],
  };
  const references: ProjectContextReference[] = [
    { kind: 'frame', id: 'frame', label: 'Frame', origin: 'manual' },
    { kind: 'element', id: 'element', label: 'Element', origin: 'manual' },
    { kind: 'city_object', id: 'tree', label: 'Tree', origin: 'automatic' },
    { kind: 'city_feature', id: 'road', label: 'Road', origin: 'automatic' },
    { kind: 'text_selection', id: 'selection', label: 'Selection', origin: 'automatic' },
  ];
  expect(contextWithReferences(context, references)).toMatchObject({
    pageId: 'frame',
    elementIds: ['element'],
    objectIds: ['tree'],
    featureIds: ['road'],
    selection,
  });
  expect(contextWithReferences(context, [])).toMatchObject({
    pageId: undefined,
    elementIds: [],
    objectIds: [],
    featureIds: [],
    selection: undefined,
  });
});

it.each([true, false])(
  'builds amendment context from the active branch, city entities and expanded text selection (document=%s)',
  async withDocument => {
    const scope: ProjectScope = { kind: 'amendment', amendmentId: crypto.randomUUID() };
    const branchId = crypto.randomUUID();
    const documentId = withDocument ? crypto.randomUUID() : undefined;
    const fallback: EditorContext = {
      surface: 'amendment_text',
      branchId,
      documentId,
      cityDesignId: crypto.randomUUID(),
      objectIds: ['tree'],
      featureIds: ['road'],
      selection: { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 4 } },
    };
    const hook = renderHook(() => useProjectComposerContext(scope, fallback, 'Amendment'));
    expect(hook.result.current.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'amendment', id: scope.amendmentId }),
        expect.objectContaining({ kind: 'branch', id: branchId }),
        expect.objectContaining({ kind: 'city_design', id: fallback.cityDesignId }),
        expect.objectContaining({ kind: 'city_object', id: 'tree' }),
        expect.objectContaining({ kind: 'city_feature', id: 'road' }),
        expect.objectContaining({ kind: 'text_selection', id: documentId ?? scope.amendmentId }),
      ])
    );
    expect(await hook.result.current.beforeSend()).toMatchObject({
      branchId,
      selection: fallback.selection,
      objectIds: ['tree'],
      featureIds: ['road'],
    });
  }
);

it('omits collapsed text selection and absent city context, and retains labels from existing references', () => {
  const scope: ProjectScope = { kind: 'amendment', amendmentId: crypto.randomUUID() };
  const root: ProjectContextReference = {
    kind: 'amendment',
    id: scope.amendmentId,
    label: 'Existing title',
    origin: 'automatic',
  };
  const fallback: EditorContext = {
    surface: 'amendment_text',
    references: [root],
    selection: { anchor: { path: [0, 0], offset: 2 }, focus: { path: [0, 0], offset: 2 } },
  };
  const hook = renderHook(() => useProjectComposerContext(scope, fallback, 'New title'));
  expect(hook.result.current.references).toEqual([root]);
});

it('keeps fixed context, deduplicates manual pins, removes optional manual references and resets them after sending', async () => {
  const scope = studio();
  const fallback: EditorContext = {
    surface: 'studio',
    proposalId: crypto.randomUUID(),
    pageId: 'frame',
    elementIds: ['element'],
  };
  const optional: ProjectContextReference = {
    kind: 'element',
    id: 'pinned',
    label: 'Pin',
    origin: 'manual',
    workspaceId: fallback.proposalId,
  };
  const hook = renderHook(() => useProjectComposerContext(scope, fallback, 'Project'));
  const fixed = hook.result.current.references.find(ref => ref.kind === 'studio_project')!;
  act(() => hook.result.current.remove(fixed));
  expect(hook.result.current.references).toContainEqual(fixed);
  act(() => {
    hook.result.current.add(optional);
    hook.result.current.add({ ...optional, label: 'Updated pin' });
  });
  expect(hook.result.current.references.filter(ref => ref.id === 'pinned')).toEqual([
    { ...optional, label: 'Updated pin' },
  ]);
  act(() => hook.result.current.remove(optional));
  expect(hook.result.current.references.some(ref => ref.id === 'pinned')).toBe(false);
  act(() => hook.result.current.add(optional));
  expect((await hook.result.current.beforeSend()).elementIds).toEqual(['element', 'pinned']);
  act(() => hook.result.current.onSent());
  expect(hook.result.current.references.some(ref => ref.id === 'pinned')).toBe(false);
});

it('rejects a pinned reference from a different workspace before saving or sending editor context', async () => {
  const scope = studio();
  const flush = vi.fn(async () => ({ surface: 'studio' as const }));
  const hook = renderHook(() => {
    useProjectEditorBridge(scope, flush, { context: { surface: 'studio' } });
    return useProjectComposerContext(scope, { surface: 'studio' }, 'Project');
  });
  act(() =>
    hook.result.current.add({
      kind: 'frame',
      id: 'foreign',
      label: 'Foreign',
      origin: 'manual',
      workspaceId: crypto.randomUUID(),
    })
  );
  await expect(hook.result.current.beforeSend()).rejects.toThrow('workspace changed');
  expect(flush).not.toHaveBeenCalled();
});

it.each(['proposalId', 'branchId'] as const)(
  'rejects a saved %s differing from the frozen send context',
  async field => {
    const scope = studio();
    const fallback: EditorContext = { surface: 'studio' };
    const hook = renderHook(() => {
      useProjectEditorBridge(scope, async () => ({ ...fallback, [field]: crypto.randomUUID() }), {
        context: fallback,
      });
      return useProjectComposerContext(scope, fallback, 'Project');
    });
    await expect(hook.result.current.beforeSend()).rejects.toThrow('editor context changed');
  }
);

it('exposes published context options and allows legacy pins without a workspace identity', async () => {
  const scope = studio();
  const fallback: EditorContext = { surface: 'studio', proposalId: null };
  const options: ProjectContextReference[] = [
    { kind: 'frame', id: 'frame', label: 'Frame', origin: 'manual' },
  ];
  const hook = renderHook(() => {
    useProjectEditorBridge(scope, async () => ({ ...fallback, contentRevision: 7 }), {
      context: fallback,
      options,
    });
    return useProjectComposerContext(scope, fallback, 'Project');
  });
  expect(hook.result.current.options).toEqual(options);
  act(() => hook.result.current.add(options[0]));
  expect(await hook.result.current.beforeSend()).toMatchObject({
    pageId: 'frame',
    contentRevision: 7,
  });
});
