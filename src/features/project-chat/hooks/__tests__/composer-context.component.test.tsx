// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useProjectEditorBridge, type EditorPublication } from '../editor-bridge';
import { useProjectComposerContext } from '../useProjectComposerContext';
import type { EditorContext } from '../../logic/contracts';
import { ProjectContextChips } from '../../ui/ProjectContextChips';
import { flushProjectEditor, useProjectEditorSnapshot } from '../editor-bridge';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }),
}));
afterEach(cleanup);
const scope = { kind: 'studio' as const, projectId: 'project' };
const frame = {
  kind: 'frame' as const,
  id: 'frame',
  label: 'Matchday',
  workspaceId: null,
  origin: 'automatic' as const,
};
const element = {
  kind: 'element' as const,
  id: 'title',
  label: 'Titel',
  workspaceId: null,
  parentId: 'frame',
  origin: 'automatic' as const,
};
function Harness({
  publication,
  flush,
  sent,
}: {
  publication: EditorPublication;
  flush: () => Promise<EditorContext>;
  sent: (context: EditorContext) => void;
}) {
  useProjectEditorBridge(scope, flush, publication);
  const composer = useProjectComposerContext(scope, { surface: 'studio' }, 't2');
  return (
    <>
      <ProjectContextChips references={composer.references} onRemove={composer.remove} />
      <button onClick={() => composer.add({ ...element, origin: 'manual' })}>pin title</button>
      <button
        onClick={async () => {
          sent(await composer.beforeSend());
          composer.onSent();
        }}
      >
        send
      </button>
    </>
  );
}
it('shows automatic context and removes it from the actual request', async () => {
  const context: EditorContext = {
    surface: 'studio',
    proposalId: null,
    pageId: 'frame',
    elementIds: ['title'],
    references: [frame, element],
  };
  const sent = vi.fn();
  render(
    <Harness
      publication={{ context }}
      flush={async () => ({ ...context, contentRevision: 7 })}
      sent={sent}
    />
  );
  expect(screen.getByText('element · Titel')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'remove Titel' }));
  await act(async () => fireEvent.click(screen.getByText('send')));
  expect(sent).toHaveBeenCalledWith(
    expect.objectContaining({ pageId: 'frame', elementIds: [], contentRevision: 7 })
  );
  expect(sent.mock.calls[0][0].references.map((ref: { id: string }) => ref.id)).not.toContain(
    'title'
  );
  await waitFor(() => expect(screen.getByText('element · Titel')).toBeTruthy());
});
it('deduplicates pinned context and preserves it when editor selection changes', async () => {
  const context: EditorContext = {
    surface: 'studio',
    proposalId: null,
    references: [frame, element],
    pageId: 'frame',
    elementIds: ['title'],
  };
  const sent = vi.fn();
  const ui = render(<Harness publication={{ context }} flush={async () => context} sent={sent} />);
  fireEvent.click(screen.getByText('pin title'));
  expect(screen.getAllByText('element · Titel')).toHaveLength(1);
  const next = { ...context, elementIds: [], references: [frame] };
  ui.rerender(<Harness publication={{ context: next }} flush={async () => next} sent={sent} />);
  await act(async () => fireEvent.click(screen.getByText('send')));
  expect(sent.mock.calls[0][0].elementIds).toEqual(['title']);
});
it('freezes the visible selection across asynchronous saving', async () => {
  const context: EditorContext = {
    surface: 'studio',
    proposalId: null,
    references: [frame, element],
    pageId: 'frame',
    elementIds: ['title'],
  };
  let complete!: (context: EditorContext) => void;
  const flush = () =>
    new Promise<EditorContext>(resolve => {
      complete = resolve;
    });
  const sent = vi.fn();
  const ui = render(<Harness publication={{ context }} flush={flush} sent={sent} />);
  fireEvent.click(screen.getByText('send'));
  ui.rerender(
    <Harness
      publication={{ context: { ...context, elementIds: [], references: [frame] } }}
      flush={flush}
      sent={sent}
    />
  );
  await act(async () => complete({ ...context, elementIds: [], contentRevision: 8 }));
  expect(sent.mock.calls[0][0].elementIds).toEqual(['title']);
});

it('keeps Amendment text and City Design publications separate', async () => {
  const amendment = { kind: 'amendment' as const, amendmentId: 'amendment' };
  const text: EditorContext = { surface: 'amendment_text', documentId: 'text' };
  const city: EditorContext = { surface: 'city_design', cityDesignId: 'map', objectIds: ['tree'] };
  const textSave = vi.fn(async () => text);
  const citySave = vi.fn(async () => city);
  const { result } = renderHook(() => {
    useProjectEditorBridge(amendment, textSave, { context: text });
    useProjectEditorBridge(amendment, citySave, { context: city });
    return [
      useProjectEditorSnapshot(amendment, 'amendment_text'),
      useProjectEditorSnapshot(amendment, 'city_design'),
    ];
  });
  expect(result.current.map(item => item?.context.surface)).toEqual([
    'amendment_text',
    'city_design',
  ]);
  await flushProjectEditor(amendment, text);
  expect(textSave).toHaveBeenCalledOnce();
  expect(citySave).not.toHaveBeenCalled();
});

it('rejects a workspace switch while the editor save is in flight', async () => {
  const context: EditorContext = {
    surface: 'studio',
    proposalId: null,
    references: [frame, element],
  };
  let complete!: (context: EditorContext) => void;
  const flush = () =>
    new Promise<EditorContext>(resolve => {
      complete = resolve;
    });
  const { result, rerender } = renderHook(
    ({ context }) => {
      useProjectEditorBridge(scope, flush, { context });
      return useProjectComposerContext(scope, { surface: 'studio' }, 't2');
    },
    { initialProps: { context } }
  );
  const saving = result.current.beforeSend();
  const rejected = expect(saving).rejects.toThrow('workspace changed');
  rerender({ context: { ...context, proposalId: crypto.randomUUID() } });
  await act(async () => complete(context));
  await rejected;
});
