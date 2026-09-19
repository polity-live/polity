import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  candidateDocument,
  projectDocument,
  seedDocument,
  stableJson,
  textValue,
  MAX_STATE_BYTES,
} from '../logic/codec';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import { reconcileProjection } from '../logic/reconcile';
import { parseRoom, roomName } from '../logic/types';

const value = [{ id: 'paragraph', type: 'p', children: [{ text: 'Hello world' }] }];
describe('collaboration state invariants', () => {
  it('normalizes legacy plain text and empty values but rejects malformed, deeply nested and oversized trees', () => {
    expect(textValue('Legacy')).toEqual([{ type: 'p', children: [{ text: 'Legacy' }] }]);
    for (const empty of [null, undefined, []])
      expect(textValue(empty)).toEqual([{ type: 'p', children: [{ text: '' }] }]);
    for (const invalid of [{}, [null], [[]], [{ type: 'p' }]])
      expect(() => textValue(invalid)).toThrow('invalid_text');
    let deep: any = { text: 'Nested' };
    for (let i = 0; i < 66; i++) deep = { children: [deep] };
    expect(() => textValue([deep])).toThrow('invalid_text');
    expect(() => textValue(Array.from({ length: 100_001 }, () => ({ text: '' })))).toThrow(
      'invalid_text'
    );
    expect(stableJson(undefined)).toBe('null');
  });
  it('rejects invalid city identity, malformed scene state and object count beyond the document bound', () => {
    for (const input of [
      null,
      {},
      { objects: [{ id: 5 }] },
      { objects: [{ id: 'x' }, { id: 'x' }] },
    ])
      expect(() => {
        const doc = new Y.Doc();
        try {
          seedDocument('city', input, doc);
        } finally {
          doc.destroy();
        }
      }).toThrow();
    const city = seedDocument('city', createEmptyCityDesignState());
    try {
      city.getMap('objects').set('object', { id: 'object' });
      expect(() => projectDocument('city', city)).toThrow('invalid_object_id');
      city.getMap('objects').clear();
      city.getMap('scene').set('version', 999);
      expect(() => projectDocument('city', city)).toThrow('invalid_city');
      city.getMap('scene').set('version', 1);
      city.transact(() => {
        for (let i = 0; i < 50_001; i++)
          city.getMap('objects').set(String(i), new Y.Map([['id', String(i)]]));
      });
      expect(() => projectDocument('city', city)).toThrow('document_too_large');
    } finally {
      city.destroy();
    }
  });
  it('rejects incomplete deltas and both incoming and combined state sizes without accepting partial data', () => {
    const source = seedDocument('document', value),
      delta: Uint8Array[] = [];
    try {
      source.on('update', (update: Uint8Array) => delta.push(update));
      (source.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText).insert(
        0,
        'missing dependency'
      );
      const empty = new Y.Doc();
      try {
        expect(() => candidateDocument('document', Y.encodeStateAsUpdate(empty), delta[0])).toThrow(
          'incomplete_update'
        );
      } finally {
        empty.destroy();
      }
      expect(() =>
        candidateDocument('document', new Uint8Array(MAX_STATE_BYTES + 1), new Uint8Array())
      ).toThrow('document_too_large');
      expect(() =>
        candidateDocument('document', new Uint8Array(), new Uint8Array(MAX_STATE_BYTES + 1))
      ).toThrow('document_too_large');
      const first = seedDocument('document', [
          { type: 'p', children: [{ text: 'a'.repeat(6_100_000) }] },
        ]),
        second = seedDocument('document', [
          { type: 'p', children: [{ text: 'b'.repeat(6_100_000) }] },
        ]);
      try {
        expect(() =>
          candidateDocument('document', Y.encodeStateAsUpdate(first), Y.encodeStateAsUpdate(second))
        ).toThrow('document_too_large');
      } finally {
        first.destroy();
        second.destroy();
      }
    } finally {
      source.destroy();
    }
  });
  it('reconciles replacement structures, inserted and deleted nodes while retaining unchanged identities', () => {
    const first = seedDocument('blog', [
      ...value,
      { id: 'remove', type: 'p', children: [{ text: 'Remove' }] },
    ]);
    const next = [{ id: 'different', type: 'h1', children: [{ text: 'Changed', bold: true }] }];
    try {
      Y.applyUpdate(first, reconcileProjection('blog', Y.encodeStateAsUpdate(first), next));
      expect(projectDocument('blog', first)).toEqual(next);
      const added = [...next, { id: 'second', type: 'p', children: [{ text: 'Added' }] }];
      Y.applyUpdate(first, reconcileProjection('document', Y.encodeStateAsUpdate(first), added));
      expect(projectDocument('document', first)).toEqual(added);
      expect(() => reconcileProjection('studio', Y.encodeStateAsUpdate(first), {})).toThrow(
        'new document generation'
      );
    } finally {
      first.destroy();
    }
  });
  it('removes comment and formatting attributes without corrupting Yjs encoding', () => {
    const doc = seedDocument('document', [
      { ...value[0], children: [{ text: 'Hello world', comment_thread: true, bold: true }] },
    ]);
    const update = reconcileProjection('document', Y.encodeStateAsUpdate(doc), value);
    Y.applyUpdate(doc, update);
    expect(projectDocument('document', doc)).toEqual(value);
    expect(() => Y.encodeStateAsUpdate(doc)).not.toThrow();
    doc.destroy();
  });
  it('round trips text, formatting, node IDs and suggestion metadata', () => {
    const input = [
      {
        ...value[0],
        children: [
          { text: 'Hello', bold: true, suggestion_a: { id: 'a', type: 'insert', userId: 'u' } },
        ],
      },
    ];
    const doc = seedDocument('document', input);
    expect(projectDocument('document', doc)).toEqual(input);
    doc.destroy();
  });
  it('merges concurrent edits without replacing either peer', () => {
    const original = seedDocument('document', value),
      a = new Y.Doc(),
      b = new Y.Doc();
    const state = Y.encodeStateAsUpdate(original);
    Y.applyUpdate(a, state);
    Y.applyUpdate(b, state);
    const rootA = a.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText;
    const rootB = b.get('content', Y.XmlText).toDelta()[0].insert as Y.XmlText;
    rootA.insert(0, 'A ');
    rootB.insert(rootB.length, ' B');
    const accepted = candidateDocument(
      'document',
      Y.encodeStateAsUpdate(a),
      Y.encodeStateAsUpdate(b)
    );
    expect(JSON.stringify(accepted.projection)).toContain('A Hello world B');
    [original, a, b].forEach(doc => doc.destroy());
  });
  it('does not change committed state when an invalid shared type is rejected', () => {
    const doc = seedDocument('document', value),
      malicious = new Y.Doc();
    malicious.getMap('votes').set('approved', true);
    expect(() =>
      candidateDocument('document', Y.encodeStateAsUpdate(doc), Y.encodeStateAsUpdate(malicious))
    ).toThrow('invalid_shared_type');
    expect(projectDocument('document', doc)).toEqual(value);
    doc.destroy();
    malicious.destroy();
  });
  it('reconciles a server decision while preserving an unrelated text anchor', () => {
    const doc = seedDocument('document', [
      ...value,
      { id: 'other', type: 'p', children: [{ text: 'Keep anchor' }] },
    ]);
    const other = doc.get('content', Y.XmlText).toDelta()[1].insert as Y.XmlText;
    const anchor = Y.createRelativePositionFromTypeIndex(other, 4);
    const next = [
      { ...value[0], children: [{ text: 'Approved' }] },
      { id: 'other', type: 'p', children: [{ text: 'Keep anchor' }] },
    ];
    const updated = reconcileProjection('document', Y.encodeStateAsUpdate(doc), next);
    Y.applyUpdate(doc, updated);
    expect(projectDocument('document', doc)).toEqual(next);
    expect(Y.createAbsolutePositionFromRelativePosition(anchor, doc)?.type).toBe(other);
    doc.destroy();
  });
  it('canonical checksums are independent of object property order', () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 4 }, b: 2 }));
  });
  it('rejects malformed room addresses and preserves document generations', () => {
    const id = crypto.randomUUID(),
      generation = crypto.randomUUID();
    expect(parseRoom(roomName(id, generation))).toEqual({ id, generation });
    expect(() => parseRoom(id)).toThrow('invalid_room');
    expect(() => parseRoom(`${id}:${generation}:extra`)).toThrow('invalid_room');
  });
});
