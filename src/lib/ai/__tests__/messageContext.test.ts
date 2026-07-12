import { describe, expect, it } from 'vitest';
import {
  createAiMessageContext,
  parseAiMessageContext,
  serializeAiMessageContext,
} from '../messageContext';
import { extractAiPresentationsFromToolResults } from '../attachments';

const groupAttachment = {
  entityType: 'group' as const,
  entityId: 'group-1',
  title: 'Group one',
  href: '/group/group-1',
};

const findings = {
  type: 'findings' as const,
  id: 'findings-1',
  title: 'Comparison',
  summary: 'Two relevant differences.',
  items: [
    { id: 'one', title: 'First', description: 'First detail', tone: 'info' as const },
    { id: 'two', title: 'Second', description: 'Second detail', tone: 'warning' as const },
  ],
};

describe('AI message context', () => {
  it('keeps legacy attachment arrays readable', () => {
    expect(parseAiMessageContext(JSON.stringify([groupAttachment]))).toEqual({
      version: 1,
      attachments: [groupAttachment],
      presentations: [],
    });
  });

  it('round-trips the V1 envelope and deduplicates blocks', () => {
    const context = createAiMessageContext(
      [groupAttachment, groupAttachment],
      [findings, findings]
    );

    expect(parseAiMessageContext(serializeAiMessageContext(context))).toEqual({
      version: 1,
      attachments: [groupAttachment],
      presentations: [findings],
    });
  });

  it('rejects invalid presentations and the thirteen-item limit', () => {
    const invalid = {
      version: 1,
      attachments: [],
      presentations: [{ ...findings, items: Array.from({ length: 13 }, () => findings.items[0]) }],
    };

    expect(parseAiMessageContext(JSON.stringify(invalid))).toEqual({
      version: 1,
      attachments: [],
      presentations: [],
    });
  });

  it('keeps valid envelope data when another presentation block is invalid', () => {
    const context = {
      version: 1,
      attachments: [groupAttachment],
      presentations: [findings, { type: 'findings', id: 'broken', title: 'Broken', items: [] }],
    };

    expect(parseAiMessageContext(JSON.stringify(context))).toEqual({
      version: 1,
      attachments: [groupAttachment],
      presentations: [findings],
    });
  });

  it('extracts and deduplicates findings across tool steps', () => {
    expect(
      extractAiPresentationsFromToolResults([
        { result: { presentations: [findings] } },
        { result: { presentations: [findings] } },
      ])
    ).toEqual([findings]);
  });
});
