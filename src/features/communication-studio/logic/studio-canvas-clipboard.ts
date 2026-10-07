import type { StudioDocumentV3 } from './document-v3';
import {
  createStudioV3ClipboardPayload,
  getProjectStudioClipboard,
  parseStudioClipboard,
  setProjectStudioClipboard,
  stringifyStudioClipboard,
  type StudioClipboardV2Payload,
} from './studio-clipboard';

/** The project buffer remains usable when browser clipboard permissions are denied. */
export async function executeStudioCanvasClipboard({
  action,
  document,
  projectId,
  selectedNodeIds,
  targetFrameId,
  clipboard,
  cut,
  paste,
  select,
}: {
  action: 'copy' | 'cut' | 'paste';
  document: StudioDocumentV3 | null;
  projectId: string;
  selectedNodeIds: string[];
  targetFrameId: string | null;
  clipboard: Pick<Clipboard, 'readText' | 'writeText'>;
  cut: (ids: string[]) => void;
  paste: (payload: StudioClipboardV2Payload, frameId: string | null) => string[];
  select: (ids: string[]) => void;
}) {
  if (!document) return;
  if (action === 'copy' || action === 'cut') {
    const payload = createStudioV3ClipboardPayload({ projectId, selectedNodeIds, document });
    if (!payload) return;
    setProjectStudioClipboard(payload);
    try {
      await clipboard.writeText(stringifyStudioClipboard(payload));
    } catch {
      /* Project clipboard remains available. */
    }
    if (action === 'cut') {
      cut(selectedNodeIds);
      select([]);
    }
    return;
  }
  let text = '';
  try {
    text = await clipboard.readText();
  } catch {
    /* Use project clipboard. */
  }
  const payload = parseStudioClipboard(text) ?? getProjectStudioClipboard(projectId);
  if (!payload) return;
  select(paste(payload, targetFrameId));
}
