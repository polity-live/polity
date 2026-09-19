import * as Y from 'yjs';
import { createEditor, Editor, type Descendant, type Path } from 'slate';
import { withYjs, YjsEditor } from '@slate-yjs/core';
import { projectDocument, stableJson, textValue } from './codec';
import type { DocumentKind } from './types';
import { applyCityDesignAction } from './city';
import type { CityDesignStateV1 } from '@/features/amendments/city-design/types';

/** Apply server-owned semantic changes through Slate operations, preserving
 * unaffected Yjs identities and their relative comment/suggestion anchors. */
export function reconcileProjection(kind: DocumentKind, state: Uint8Array, value: unknown) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  try {
    if (kind === 'document' || kind === 'blog') {
      const editor = withYjs(createEditor(), doc.get('content', Y.XmlText));
      YjsEditor.connect(editor);
      const children = (path: Path): Descendant[] =>
        (path.length ? (Editor.node(editor, path)[0] as { children: Descendant[] }) : editor)
          .children;
      const reconcile = (next: Descendant[], parent: Path) => {
        for (let i = 0; i < next.length; i++) {
          const path = [...parent, i],
            proposed = next[i] as unknown as Record<string, unknown>;
          let current = children(parent)[i] as unknown as Record<string, unknown> | undefined;
          if (current && stableJson(current) === stableJson(proposed)) continue;
          if (
            current &&
            ((current.text === undefined) !== (proposed.text === undefined) ||
              (current.id && proposed.id && current.id !== proposed.id) ||
              current.type !== proposed.type)
          ) {
            editor.apply({ type: 'remove_node', path, node: children(parent)[i] });
            current = undefined;
          }
          if (!current) {
            editor.apply({ type: 'insert_node', path, node: next[i] });
            continue;
          }
          const properties: Record<string, unknown> = {},
            newProperties: Record<string, unknown> = {};
          for (const key of new Set([...Object.keys(current), ...Object.keys(proposed)])) {
            if (
              key === 'text' ||
              key === 'children' ||
              stableJson(current[key]) === stableJson(proposed[key])
            )
              continue;
            // Slate and Yjs use null to remove an attribute. Undefined cannot
            // be encoded in a Yjs formatting item (e.g. a removed comment mark).
            properties[key] = current[key] ?? null;
            newProperties[key] = proposed[key] ?? null;
          }
          if (Object.keys(newProperties).length)
            editor.apply({ type: 'set_node', path, properties, newProperties });
          if (typeof current.text === 'string' && typeof proposed.text === 'string') {
            let start = 0,
              end = 0;
            while (
              start < current.text.length &&
              start < proposed.text.length &&
              current.text[start] === proposed.text[start]
            )
              start++;
            while (
              end < current.text.length - start &&
              end < proposed.text.length - start &&
              current.text[current.text.length - end - 1] ===
                proposed.text[proposed.text.length - end - 1]
            )
              end++;
            const removed = current.text.slice(start, current.text.length - end),
              inserted = proposed.text.slice(start, proposed.text.length - end);
            if (removed) editor.apply({ type: 'remove_text', path, offset: start, text: removed });
            if (inserted)
              editor.apply({ type: 'insert_text', path, offset: start, text: inserted });
          } else reconcile(proposed.children as Descendant[], path);
        }
        while (children(parent).length > next.length) {
          const index = children(parent).length - 1;
          editor.apply({
            type: 'remove_node',
            path: [...parent, index],
            node: children(parent)[index],
          });
        }
      };
      Editor.withoutNormalizing(editor, () => reconcile(textValue(value), []));
      YjsEditor.flushLocalChanges(editor);
      YjsEditor.disconnect(editor);
    } else if (kind === 'city') {
      applyCityDesignAction(
        doc,
        projectDocument('city', doc) as CityDesignStateV1,
        value as CityDesignStateV1,
        'server'
      );
    } else throw new Error('Studio restoration requires a new document generation');
    return Y.encodeStateAsUpdate(doc);
  } finally {
    doc.destroy();
  }
}
