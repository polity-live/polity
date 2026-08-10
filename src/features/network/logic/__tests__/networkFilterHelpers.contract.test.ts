import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  filterEdgesByConnectionDirections,
  filterEdgesByRelationshipDepth,
  filterEdgesByRelationshipStatus,
  filterEdgesByRights,
  filterNodesByEdges,
} from '../networkFilterHelpers';

function edge(id: string, data?: Record<string, unknown>, overrides: Partial<Edge> = {}): Edge {
  return {
    id,
    source: `${id}-source`,
    target: `${id}-target`,
    markerStart: { type: 'arrowclosed' as any },
    markerEnd: { type: 'arrowclosed' as any },
    style: { stroke: '#123456' },
    data,
    ...overrides,
  };
}

describe('filterEdgesByRights contracts', () => {
  it('keeps always-visible, data-less and membership edges unchanged', () => {
    const always = edge('always', { rights: ['a'] });
    const noData = edge('no-data');
    const membership = edge('membership', { rights: [] });
    const result = filterEdgesByRights(
      [always, noData, membership],
      new Set(),
      new Set(['always'])
    );
    expect(result).toEqual([always, noData, membership]);
  });

  it('removes rights edges without selected rights', () => {
    expect(filterEdgesByRights([edge('rights', { rights: ['a'] })], new Set())).toEqual([]);
  });

  it('keeps bidirectional rights, record-owned values and marker fallbacks', () => {
    const original = edge(
      'mixed',
      {
        rights: ['both', 'missing-record'],
        rightEdgeDirections: { both: 'bidirectional', ignored: 'forward' },
        rightRelationshipKinds: { both: 'incoming' },
        rightConnectionDirections: { both: 'bidirectional' },
        userConnectionDirections: ['incoming'],
      },
      { markerStart: undefined, style: { stroke: 123 as any } }
    );
    const [result] = filterEdgesByRights([original], new Set(['both', 'missing-record']));
    expect(result.markerStart).toBe(result.markerEnd);
    expect(result.markerEnd).toBeDefined();
    expect((result.data as any).visibleRightRelationshipKinds).toEqual({ both: 'incoming' });
    expect((result.data as any).visibleConnectionDirection).toBe('bidirectional');
    expect(result.style?.stroke).toBeDefined();

    const markerStart = { type: 'arrowclosed' as any };
    const [forward] = filterEdgesByRights(
      [
        edge(
          'forward-marker-fallback',
          { rights: ['forward'], rightEdgeDirections: { forward: 'forward' } },
          { markerStart, markerEnd: undefined }
        ),
      ],
      new Set(['forward'])
    );
    expect(forward.markerEnd).toBe(markerStart);
  });

  it('uses edge-level directions when no per-right connection record exists', () => {
    const [incoming] = filterEdgesByRights(
      [
        edge('incoming', {
          rights: ['a'],
          userConnectionDirections: [undefined, 'incoming'],
        }),
      ],
      new Set(['a'])
    );
    expect((incoming.data as any).visibleConnectionDirection).toBe('incoming');

    const [outgoing] = filterEdgesByRights(
      [edge('outgoing', { rights: ['a'], userConnectionDirections: ['outgoing'] })],
      new Set(['a'])
    );
    expect((outgoing.data as any).visibleConnectionDirection).toBe('outgoing');

    const [none] = filterEdgesByRights(
      [edge('none', { rights: ['a'], userConnectionDirections: 'invalid' })],
      new Set(['a'])
    );
    expect((none.data as any).visibleConnectionDirection).toBeUndefined();
  });

  it('uses visible right metadata before original right metadata', () => {
    const [result] = filterEdgesByRights(
      [
        edge('visible', {
          rights: ['a'],
          rightRelationshipKinds: { a: 'active' },
          visibleRightRelationshipKinds: { a: 'incoming' },
          rightConnectionDirections: { a: 'outgoing' },
          visibleRightConnectionDirections: { a: 'incoming' },
        }),
      ],
      new Set(['a'])
    );
    expect((result.data as any).visibleRightRelationshipKinds).toEqual({ a: 'incoming' });
    expect((result.data as any).visibleConnectionDirection).toBe('incoming');
  });
});

describe('relationship status and depth filtering', () => {
  it('filters member edges by explicit and default relationship status', () => {
    const always = edge('always', { relationshipKinds: ['incoming'] });
    const active = edge('active', {});
    const pending = edge('pending', { relationshipKinds: ['incoming'] });
    expect(
      filterEdgesByRelationshipStatus([always, active, pending], 'active', new Set(['always'])).map(
        item => item.id
      )
    ).toEqual(['always', 'active']);
    expect(filterEdgesByRelationshipStatus([pending], 'incoming')).toEqual([pending]);
  });

  it('uses visible rights, original rights and empty rights fallbacks for status', () => {
    const visible = edge('visible', {
      rights: ['a', 'b'],
      visibleRights: ['a'],
      visibleRightRelationshipKinds: { a: 'incoming' },
    });
    const original = edge('original', {
      rights: ['a', 'b'],
      rightRelationshipKinds: { a: 'incoming', b: 'active' },
    });
    const malformed = edge('malformed', { rights: 'invalid' });
    expect(
      filterEdgesByRelationshipStatus([visible, original, malformed], 'incoming').map(
        item => item.id
      )
    ).toEqual(['visible', 'original']);
    expect(
      (filterEdgesByRelationshipStatus([original], 'incoming')[0].data as any).visibleRights
    ).toEqual(['a']);
  });

  it('filters direct, derived and all relationship depths with always-show support', () => {
    const direct = edge('direct', {});
    const derived = edge('derived', { relationshipDepth: 'indirect' });
    const always = edge('always', { relationshipDepth: 'indirect' });
    expect(
      filterEdgesByRelationshipDepth([direct, derived, always], 'direct', new Set(['always'])).map(
        item => item.id
      )
    ).toEqual(['direct', 'always']);
    expect(filterEdgesByRelationshipDepth([direct, derived], 'indirect')).toEqual([derived]);
    expect(filterEdgesByRelationshipDepth([direct, derived], 'all')).toEqual([direct, derived]);
  });
});

describe('connection direction filtering', () => {
  it('supports all, incoming, outgoing and bidirectional edge-level directions', () => {
    const incoming = edge('incoming', { userConnectionDirections: ['incoming'] });
    const outgoing = edge('outgoing', { userConnectionDirections: ['outgoing'] });
    const both = edge('both', { userConnectionDirections: ['bidirectional'] });
    const none = edge('none', { userConnectionDirections: [] });
    expect(
      filterEdgesByConnectionDirections(
        [incoming, outgoing, both, none],
        new Set(['incoming', 'outgoing'])
      )
    ).toEqual([incoming, outgoing, both, none]);
    expect(
      filterEdgesByConnectionDirections([incoming, outgoing, both], new Set(['incoming'])).map(
        item => item.id
      )
    ).toEqual(['incoming', 'both']);
    expect(
      filterEdgesByConnectionDirections([incoming, outgoing, both], new Set()).map(item => item.id)
    ).toEqual(['outgoing', 'both']);
  });

  it('keeps always-show edges and filters per-right direction sources', () => {
    const always = edge('always', { rights: ['a'], rightConnectionDirections: { a: 'outgoing' } });
    const visible = edge('visible', {
      rights: ['a'],
      visibleRights: ['a'],
      visibleRightConnectionDirections: { a: 'incoming' },
      rightConnectionDirections: { a: 'outgoing' },
    });
    const original = edge('original', {
      rights: ['a'],
      rightConnectionDirections: { a: 'incoming' },
    });
    const fallback = edge('fallback', {
      rights: ['a'],
      userConnectionDirections: ['incoming'],
    });
    const explicitMissing = edge('explicit-missing', {
      rights: ['a'],
      rightConnectionDirections: { other: 'incoming' },
      userConnectionDirections: ['incoming'],
    });
    expect(
      filterEdgesByConnectionDirections(
        [always, visible, original, fallback, explicitMissing],
        new Set(['incoming']),
        new Set(['always'])
      ).map(item => item.id)
    ).toEqual(['always', 'visible', 'original', 'fallback']);
  });

  it('uses original rights when visible rights are malformed and empty fallback otherwise', () => {
    const original = edge('original', {
      visibleRights: 'invalid',
      rights: ['a'],
      rightConnectionDirections: { a: 'incoming' },
    });
    const malformed = edge('malformed', { visibleRights: 'invalid', rights: 'invalid' });
    expect(
      filterEdgesByConnectionDirections([original, malformed], new Set(['incoming'])).map(
        item => item.id
      )
    ).toEqual(['original']);
  });
});

describe('filterNodesByEdges', () => {
  it('keeps connected nodes and explicit inclusions only', () => {
    const nodes = ['a', 'b', 'c', 'd'].map(id => ({ id }) as Node);
    expect(
      filterNodesByEdges(nodes, [edge('edge', undefined, { source: 'a', target: 'b' })], ['d']).map(
        node => node.id
      )
    ).toEqual(['a', 'b', 'd']);
  });
});
