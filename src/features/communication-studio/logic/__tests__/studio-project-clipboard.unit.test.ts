import { expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../document-v3';
import {
  createStudioV3ClipboardPayload,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
} from '../studio-clipboard';
import {
  pasteStudioProjectClipboard,
  studioClipboardErrorMessage,
} from '../studio-project-clipboard';

function fixture() {
  const source = studioDocumentV3Schema.parse(
    createStudioTemplateDocumentV5('single', 'Clipboard source', defaultBrand)
  );
  const frame = source.nodes.find(node => node.type === 'frame')!;
  const projectId = crypto.randomUUID();
  const payload = createStudioV3ClipboardPayload({
    projectId,
    document: source,
    selectedNodeIds: [frame.id],
  })!;
  const document = studioDocumentV3Schema.parse({
    ...structuredClone(source),
    nodes: [],
    deliverables: [],
  });
  const options = {
    projectId,
    clipboard: { readText: vi.fn(async () => stringifyStudioClipboard(payload)) },
    transact: vi.fn((change: (document: StudioDocumentV3) => void) => change(document)),
    select: vi.fn(),
    setPageId: vi.fn(),
  };
  return { options, payload, document, frame };
}
it.each(['project buffer', 'browser clipboard'] as const)(
  'pastes the real canonical frame from the %s and activates its new identity',
  async source => {
    const { options, payload, document, frame } = fixture();
    if (source === 'project buffer') setProjectStudioClipboard(payload);
    await pasteStudioProjectClipboard(options);
    const ids = options.select.mock.lastCall![0] as string[];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(frame.id);
    expect(options.setPageId).toHaveBeenCalledWith(ids[0]);
    expect(document.nodes.find(node => node.id === ids[0])?.type).toBe('frame');
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
    expect(options.clipboard.readText).toHaveBeenCalledTimes(source === 'project buffer' ? 0 : 1);
  }
);
it('leaves the page unchanged when the SDK declines to execute the transaction after access is revoked', async () => {
  const { options, document } = fixture();
  const before = structuredClone(document);
  await pasteStudioProjectClipboard({ ...options, transact: _change => undefined });
  expect(options.select).toHaveBeenCalledWith([]);
  expect(options.setPageId).not.toHaveBeenCalled();
  expect(document).toEqual(before);
});
it.each([
  'unavailable API',
  'unavailable reader',
  'empty text',
  'ordinary text',
  'permission denied',
] as const)('reports an empty selection for %s', async kind => {
  const { options, document } = fixture();
  if (kind === 'permission denied')
    options.clipboard.readText.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  else options.clipboard.readText.mockResolvedValueOnce(kind === 'ordinary text' ? 'notes' : '');
  await expect(
    pasteStudioProjectClipboard({
      ...options,
      clipboard:
        kind === 'unavailable API'
          ? undefined
          : kind === 'unavailable reader'
            ? {}
            : options.clipboard,
    })
  ).rejects.toThrow('The Studio clipboard is empty.');
  expect(options.transact).not.toHaveBeenCalled();
  expect(document.nodes).toEqual([]);
});
it('rejects a valid clipboard belonging to another project before transacting', async () => {
  const { options } = fixture();
  await expect(
    pasteStudioProjectClipboard({ ...options, projectId: crypto.randomUUID() })
  ).rejects.toThrow('Elements can only be pasted within the same Studio project.');
  expect(options.transact).not.toHaveBeenCalled();
});
it.each([new Error('SDK unavailable'), 'SDK unavailable'])(
  'formats an SDK rejection without losing its message: %s',
  error => {
    expect(studioClipboardErrorMessage(error)).toBe('SDK unavailable');
  }
);
