import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_TOOLS } from '@/lib/ai/defaultAiTools';
import { buildMutationResult, buildUpdatedResult } from '../ai-create-tools';
import { buildAiTools } from '../ai-tools';

describe('present_findings AI tool', () => {
  it('registers one update tool for every persistent create tool', () => {
    const expectedUpdateTools = [
      'update_group',
      'update_event',
      'update_amendment',
      'update_blog_entry',
      'update_todo',
      'update_statement',
      'update_payment',
      'update_agenda_item',
      'update_election_candidate',
    ];

    expect(DEFAULT_AI_TOOLS.filter(tool => tool.kind === 'update').map(tool => tool.name)).toEqual(
      expectedUpdateTools
    );
    expect(DEFAULT_AI_TOOLS.some(tool => tool.name === ('update_create_flow' as never))).toBe(
      false
    );
  });

  it('requires a real partial change and preserves explicit clear semantics', () => {
    const tools = buildAiTools('user-1') as unknown as Record<
      string,
      { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }
    >;

    expect(tools.update_group.inputSchema.safeParse({ groupId: 'group-1' }).success).toBe(false);
    expect(
      tools.update_group.inputSchema.safeParse({ groupId: 'group-1', description: null }).success
    ).toBe(true);
    expect(
      tools.update_group.inputSchema.safeParse({ groupId: 'group-1', hashtags: [] }).success
    ).toBe(true);
    expect(
      tools.update_election_candidate.inputSchema.safeParse({
        electionId: 'election-1',
        statement: 'Updated',
      }).success
    ).toBe(true);
    expect(
      tools.update_election_candidate.inputSchema.safeParse({
        candidateId: 'candidate-1',
        electionId: 'election-1',
        statement: 'Ambiguous',
      }).success
    ).toBe(false);
  });

  it('marks create results as output and update results as update context', () => {
    const attachment = {
      entityType: 'group' as const,
      entityId: 'group-1',
      title: 'Group one',
    };

    expect(buildMutationResult('Created.', attachment, '/group/group-1').attachments).toEqual([
      { ...attachment, context_type: 'output' },
    ]);
    expect(buildUpdatedResult('Updated.', attachment, '/group/group-1').attachments).toEqual([
      { ...attachment, context_type: 'update' },
    ]);
  });

  it('is always available to the model but absent from the public tool catalog', () => {
    expect(buildAiTools('user-1')).toHaveProperty('present_findings');
    expect(DEFAULT_AI_TOOLS.some(tool => tool.name === ('present_findings' as never))).toBe(false);
  });

  it('returns a validated presentation block without entity attachments', async () => {
    const findingsTool = buildAiTools('user-1').present_findings as unknown as {
      execute: (input: unknown) => Promise<unknown>;
    };
    const result = await findingsTool.execute({
      title: 'Options',
      summary: 'Two options compared.',
      items: [
        { title: 'Option A', description: 'Fast', tone: 'success' },
        { title: 'Option B', description: 'Careful', tone: 'warning' },
      ],
    });

    expect(result).toMatchObject({
      attachments: [],
      presentations: [
        {
          type: 'findings',
          title: 'Options',
          items: [
            { title: 'Option A', tone: 'success' },
            { title: 'Option B', tone: 'warning' },
          ],
        },
      ],
    });
  });
});
