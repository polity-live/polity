import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema } from '../document-v3';
import { executeStudioCanvasClipboard } from '../studio-canvas-clipboard';
import {
  createStudioV3ClipboardPayload,
  getProjectStudioClipboard,
  parseStudioClipboard,
  pasteStudioV3Clipboard,
  stringifyStudioClipboard,
} from '../studio-clipboard';
import { cutStudioSelection } from '../studio-selection-commands';

function fixture() {
  const document = studioDocumentV3Schema.parse(
    createStudioTemplateDocumentV5('single', 'Clipboard', defaultBrand)
  );
  const node = document.nodes.find(node => node.type === 'shape')!;
  const projectId = crypto.randomUUID();
  const targetFrameId = node.parentFrameId;
  const clipboard = {
    readText: vi.fn(async () => ''),
    writeText: vi.fn(async (_value: string) => undefined),
  };
  const cut = vi.fn((ids: string[]) => cutStudioSelection(ids, change => change(document)));
  const paste = vi.fn(
    (
      payload: NonNullable<ReturnType<typeof createStudioV3ClipboardPayload>>,
      frameId: string | null
    ) => {
      const pasted = pasteStudioV3Clipboard({
        document,
        payload,
        projectId,
        targetFrameId: frameId,
      });
      Object.assign(document, pasted.document);
      return pasted.selectedNodeIds;
    }
  );
  const select = vi.fn();
  const options = {
    action: 'copy' as 'copy' | 'cut' | 'paste',
    document,
    projectId,
    selectedNodeIds: [node.id],
    targetFrameId,
    clipboard,
    cut,
    paste,
    select,
  };
  return { options, node };
}
it('does not access clipboard or mutate before the canonical document is loaded', async () => {
  const { options } = fixture();
  await executeStudioCanvasClipboard({ ...options, document: null });
  expect(options.clipboard.writeText).not.toHaveBeenCalled();
  expect(options.clipboard.readText).not.toHaveBeenCalled();
  expect(options.cut).not.toHaveBeenCalled();
  expect(options.paste).not.toHaveBeenCalled();
  expect(options.select).not.toHaveBeenCalled();
});
it('ignores an empty copy selection', async () => {
  const { options } = fixture();
  await executeStudioCanvasClipboard({ ...options, selectedNodeIds: [] });
  expect(options.clipboard.writeText).not.toHaveBeenCalled();
  expect(getProjectStudioClipboard(options.projectId)).toBeNull();
});
it('copies the real canonical payload into both browser and project clipboards without changing the document', async () => {
  const { options, node } = fixture();
  const before = structuredClone(options.document);
  await executeStudioCanvasClipboard(options);
  expect(options.document).toEqual(before);
  const serialized = options.clipboard.writeText.mock.calls[0][0];
  expect(parseStudioClipboard(serialized)?.rootNodeIds).toEqual([node.id]);
  expect(getProjectStudioClipboard(options.projectId)).toEqual(parseStudioClipboard(serialized));
  expect(options.select).not.toHaveBeenCalled();
});
it('cuts the selection even when browser permission is denied and pastes from the retained project buffer', async () => {
  const { options, node } = fixture();
  options.clipboard.writeText.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  options.clipboard.readText.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  await executeStudioCanvasClipboard({ ...options, action: 'cut' });
  expect(options.document.nodes.some(candidate => candidate.id === node.id)).toBe(false);
  expect(options.cut).toHaveBeenCalledWith([node.id]);
  expect(options.select).toHaveBeenLastCalledWith([]);
  const payload = getProjectStudioClipboard(options.projectId)!;
  await executeStudioCanvasClipboard({ ...options, action: 'paste' });
  expect(options.paste).toHaveBeenCalledWith(payload, options.targetFrameId);
  const ids = options.select.mock.lastCall![0] as string[];
  expect(ids).toHaveLength(1);
  expect(ids[0]).not.toBe(node.id);
  expect(options.document.nodes.find(candidate => candidate.id === ids[0])?.name).toBe(node.name);
  expect(studioDocumentV3Schema.safeParse(options.document).success).toBe(true);
});
it('pastes a browser payload into the target frame and selects the actual newly inserted nodes', async () => {
  const { options, node } = fixture();
  const payload = createStudioV3ClipboardPayload({
    projectId: options.projectId,
    document: options.document,
    selectedNodeIds: [node.id],
  })!;
  options.clipboard.readText.mockResolvedValueOnce(stringifyStudioClipboard(payload));
  await executeStudioCanvasClipboard({ ...options, action: 'paste' });
  const ids = options.select.mock.lastCall![0] as string[];
  expect(ids).toHaveLength(1);
  expect(options.document.nodes.find(candidate => candidate.id === ids[0])?.parentFrameId).toBe(
    options.targetFrameId
  );
  expect(options.clipboard.writeText).not.toHaveBeenCalled();
  expect(options.cut).not.toHaveBeenCalled();
});
it('ignores clipboard text that is neither a valid payload nor a saved project selection', async () => {
  const { options } = fixture();
  options.clipboard.readText.mockResolvedValueOnce('ordinary text');
  await executeStudioCanvasClipboard({ ...options, action: 'paste' });
  expect(options.paste).not.toHaveBeenCalled();
  expect(options.select).not.toHaveBeenCalled();
});
