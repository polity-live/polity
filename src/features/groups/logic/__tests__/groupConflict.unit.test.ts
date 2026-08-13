import { describe, expect, it } from 'vitest';

import {
  GROUP_CONFLICT_ERROR_PREFIX,
  GroupConflictError,
  buildGroupConflictResponse,
  encodeGroupConflictResponse,
  groupConflictResponseSchema,
  mergeGroupConflictResponses,
  parseGroupConflictResponseMessage,
  throwGroupConflictResponse,
  toGroupConflictError,
  type GroupConflict,
} from '../groupConflict';

function conflict(overrides: Partial<GroupConflict> = {}): GroupConflict {
  return {
    kind: 'hierarchy_member_overlap',
    blocking: true,
    summary: 'Membership conflict',
    explanation: 'The membership overlaps.',
    details: { users: [], groups: [], source_groups: [], paths: [] },
    resolutions: [],
    ...overrides,
  };
}

describe('group conflict payloads', () => {
  it('builds blocking and non-blocking responses with stable summaries', () => {
    expect(buildGroupConflictResponse([])).toEqual({
      blocking: false,
      summary: null,
      conflicts: [],
    });

    const response = buildGroupConflictResponse([
      conflict({ blocking: false, summary: 'Advisory' }),
      conflict({ summary: 'Blocking' }),
    ]);
    expect(response.blocking).toBe(true);
    expect(response.summary).toBe('Advisory');
  });

  it('merges absent and populated responses without inventing conflicts', () => {
    const item = conflict();
    expect(
      mergeGroupConflictResponses([
        null,
        undefined,
        { blocking: false, summary: null, conflicts: [] },
        buildGroupConflictResponse([item]),
      ])
    ).toEqual(buildGroupConflictResponse([item]));
  });

  it('round-trips encoded responses and applies schema defaults', () => {
    const parsed = groupConflictResponseSchema.parse({
      blocking: true,
      conflicts: [
        {
          kind: 'hierarchy_duplicate_path',
          blocking: true,
          summary: 'Duplicate path',
          explanation: 'Two paths exist.',
          details: {},
        },
      ],
    });
    const encoded = encodeGroupConflictResponse(parsed);

    expect(encoded.startsWith(GROUP_CONFLICT_ERROR_PREFIX)).toBe(true);
    expect(parseGroupConflictResponseMessage(encoded)).toEqual(parsed);
    expect(parsed.conflicts[0]?.details).toMatchObject({
      users: [],
      groups: [],
      source_groups: [],
      paths: [],
    });
    expect(parsed.conflicts[0]?.resolutions).toEqual([]);
  });

  it('rejects unrelated, malformed, and schema-invalid error messages', () => {
    expect(parseGroupConflictResponseMessage(null)).toBeNull();
    expect(parseGroupConflictResponseMessage(undefined)).toBeNull();
    expect(parseGroupConflictResponseMessage('plain error')).toBeNull();
    expect(parseGroupConflictResponseMessage(`${GROUP_CONFLICT_ERROR_PREFIX}{`)).toBeNull();
    expect(
      parseGroupConflictResponseMessage(`${GROUP_CONFLICT_ERROR_PREFIX}${JSON.stringify({})}`)
    ).toBeNull();
  });

  it('normalizes native and encoded errors into GroupConflictError instances', () => {
    const response = buildGroupConflictResponse([conflict()]);
    const native = new GroupConflictError(response);

    expect(toGroupConflictError(native)).toBe(native);
    expect(toGroupConflictError('not an error')).toBeNull();
    expect(toGroupConflictError(new Error('plain error'))).toBeNull();

    const decoded = toGroupConflictError(new Error(encodeGroupConflictResponse(response)));
    expect(decoded).toBeInstanceOf(GroupConflictError);
    expect(decoded?.message).toBe('Membership conflict');
    expect(decoded?.response).toEqual(response);
  });

  it('uses response, conflict, and generic constructor message fallbacks', () => {
    expect(
      new GroupConflictError({
        blocking: true,
        summary: 'Response summary',
        conflicts: [conflict({ summary: 'Conflict summary' })],
      }).message
    ).toBe('Response summary');
    expect(
      new GroupConflictError({
        blocking: true,
        summary: null,
        conflicts: [conflict({ summary: 'Conflict summary' })],
      }).message
    ).toBe('Conflict summary');
    expect(new GroupConflictError({ blocking: false, summary: null, conflicts: [] }).message).toBe(
      'Group conflict'
    );
  });

  it('throws an encoded response for mutation boundaries', () => {
    const response = buildGroupConflictResponse([conflict()]);

    expect(() => throwGroupConflictResponse(response)).toThrowError(
      encodeGroupConflictResponse(response)
    );
  });
});
