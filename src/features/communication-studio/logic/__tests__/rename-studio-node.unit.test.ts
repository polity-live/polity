import { describe, expect, it, vi } from 'vitest';
import { defaultBrand } from '../document';
import { studioDocumentV3Schema, type StudioDocumentV3 } from '../document-v3';
import { createStudioTemplateDocumentV5 } from '../templates-v5';
import { renameStudioNode } from '../rename-studio-node';

function fixture() {
  const document = createStudioTemplateDocumentV5('single', 'Rename boundaries', defaultBrand);
  const node = document.nodes.find(candidate => candidate.type === 'shape')!;
  const transact = vi.fn((change: (document: StudioDocumentV3) => void) => change(document));
  return { document, node, transact };
}

describe('transactional Studio node rename', () => {
  it('trims the name and preserves every unrelated node and property', () => {
    const { document, node, transact } = fixture();
    const before = structuredClone(document);
    renameStudioNode({ nodeId: node.id, name: '  Renamed shape  ', editable: true, transact });
    expect(transact).toHaveBeenCalledOnce();
    expect(document.nodes.find(candidate => candidate.id === node.id)?.name).toBe('Renamed shape');
    before.nodes.find(candidate => candidate.id === node.id)!.name = 'Renamed shape';
    expect(document).toEqual(before);
    expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
  });

  it.each(['disabled', 'blank', 'too long'] as const)(
    'does not start a transaction for a %s rename',
    restriction => {
      const { document, node, transact } = fixture();
      const before = structuredClone(document);
      renameStudioNode({
        nodeId: node.id,
        name:
          restriction === 'blank'
            ? '  '
            : restriction === 'too long'
              ? 'x'.repeat(201)
              : 'New name',
        editable: restriction !== 'disabled',
        transact,
      });
      expect(transact).not.toHaveBeenCalled();
      expect(document).toEqual(before);
    }
  );

  it.each(['deleted', 'locked', 'unchanged'] as const)(
    'keeps the current transaction document intact when the node is %s',
    state => {
      const { document, node, transact } = fixture();
      if (state === 'deleted')
        document.nodes = document.nodes.filter(candidate => candidate.id !== node.id);
      if (state === 'locked') node.locked = true;
      const before = structuredClone(document);
      renameStudioNode({
        nodeId: node.id,
        name: state === 'unchanged' ? node.name : 'New name',
        editable: true,
        transact,
      });
      expect(transact).toHaveBeenCalledOnce();
      expect(document).toEqual(before);
      expect(studioDocumentV3Schema.safeParse(document).success).toBe(true);
    }
  );
});
