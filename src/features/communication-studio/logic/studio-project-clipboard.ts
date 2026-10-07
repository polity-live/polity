import type { StudioDocumentV3 } from './document-v3';
import {
  getProjectStudioClipboard,
  parseStudioClipboard,
  pasteStudioV3Clipboard,
} from './studio-clipboard';

/** Load a project-scoped selection and apply it through the document SDK transaction. */
export async function pasteStudioProjectClipboard({
  projectId,
  clipboard,
  transact,
  select,
  setPageId,
}: {
  projectId: string;
  clipboard?: Partial<Pick<Clipboard, 'readText'>>;
  transact: (change: (document: StudioDocumentV3) => void) => void;
  select: (ids: string[]) => void;
  setPageId: (id: string) => void;
}) {
  let payload = getProjectStudioClipboard(projectId);
  if (!payload) {
    try {
      const text = (await clipboard?.readText?.()) ?? '';
      payload = text ? parseStudioClipboard(text) : null;
    } catch {
      // The project-bound buffer remains available independently of browser permissions.
    }
  }
  if (!payload) throw new Error('The Studio clipboard is empty.');
  if (payload.projectId !== projectId)
    throw new Error('Elements can only be pasted within the same Studio project.');
  let ids: string[] = [];
  transact(document => {
    const pasted = pasteStudioV3Clipboard({ document, payload, projectId });
    Object.assign(document, pasted.document);
    ids = pasted.selectedNodeIds;
  });
  select(ids);
  if (ids[0]) setPageId(ids[0]);
}

export function studioClipboardErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
