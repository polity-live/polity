import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatAttachment } from '@/lib/ai/schemas';
import type { ProjectScope } from '@/features/project-chat/logic/contracts';

const boundary = vi.hoisted(() => ({
  sql: vi.fn(),
  canonical: vi.fn(),
  enrich: vi.fn(),
  plan: [] as Record<string, unknown>[][],
  calls: [] as { statement: string; parameters: unknown[] }[],
}));
vi.mock('../db', async original => ({
  ...(await original<typeof import('../db')>()),
  studioSql: () => boundary.sql,
}));
vi.mock('@/server/ai-tools', () => ({ resolveAiAttachmentForUser: boundary.canonical }));
vi.mock('@/server/ai-db', () => ({ enrichAiAttachmentsForPrompt: boundary.enrich }));
import {
  assertProjectAiSourceSharing,
  assertStudioProposalSourceAudience,
  resolveProjectSources,
  type StudioSourceRef,
} from '../ai-sources';

const actor = crypto.randomUUID();
const member = crypto.randomUUID();
const project = crypto.randomUUID();
const sourceId = crypto.randomUUID();
const searchId = crypto.randomUUID();
const ref: StudioSourceRef = { type: 'event', id: sourceId };
const sql = boundary.sql as unknown as NonNullable<
  Parameters<typeof assertProjectAiSourceSharing>[3]
>;
function source(visibility = 'public') {
  return {
    id: searchId,
    title: 'Server title',
    subtitle: 'Server subtitle',
    summary: 'Server summary',
    visibility,
    card_payload: { safe: true },
  };
}
function audience(
  scope: ProjectScope,
  visibility = 'private',
  group = false,
  people = [actor, member]
) {
  boundary.plan.push(
    [
      scope.kind === 'studio'
        ? { owner_id: actor, group_id: group ? project : null, visibility }
        : { created_by_id: actor, group_id: group ? project : null, visibility },
    ],
    people.map(id => ({ id }))
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.plan = [];
  boundary.calls = [];
  boundary.sql.mockImplementation((strings: readonly string[], ...parameters: unknown[]) => {
    if (!Object.hasOwn(strings, 'raw')) return { values: strings };
    boundary.calls.push({ statement: strings.join('?'), parameters });
    return Promise.resolve(boundary.plan.shift() ?? []);
  });
  boundary.canonical.mockResolvedValue(null);
  boundary.enrich.mockImplementation(async (items: AiChatAttachment[]) => items);
});

describe('canonical AI source audience checks', () => {
  it('does not resolve or enrich empty references for a personal request', async () => {
    await expect(resolveProjectSources(actor, null, [])).resolves.toEqual([]);
    expect(boundary.sql).not.toHaveBeenCalled();
    expect(boundary.canonical).not.toHaveBeenCalled();
    expect(boundary.enrich).not.toHaveBeenCalled();
  });

  it.each([
    ['Studio personal', { kind: 'studio', projectId: project }, false],
    ['Studio group', { kind: 'studio', projectId: project }, true],
    ['amendment personal', { kind: 'amendment', amendmentId: project }, false],
    ['amendment group', { kind: 'amendment', amendmentId: project }, true],
  ] as const)('resolves a source for the full %s audience', async (_label, scope, group) => {
    audience(scope, 'private', group);
    boundary.plan.push([source('private')], [{ user_id: actor }, { user_id: member }]);
    const result = await resolveProjectSources(actor, scope, [ref]);
    expect(result).toEqual([
      {
        entityType: 'event',
        entityId: sourceId,
        title: 'Server title',
        subtitle: 'Server subtitle',
        prompt_context: 'Server summary',
        card_data_json: '{"safe":true}',
      },
    ]);
    expect(boundary.enrich).toHaveBeenCalledWith(result);
    expect(boundary.canonical).toHaveBeenCalledWith(actor, {
      entityType: 'event',
      entityId: sourceId,
    });
    const audienceQuery = boundary.calls[1].statement;
    expect(audienceQuery).toContain(
      group
        ? 'group_membership'
        : scope.kind === 'studio'
          ? 'studio_project_collaborator'
          : 'amendment_collaborator'
    );
    expect(audienceQuery).toContain(
      group ? "status in ('active','member','admin')" : "status='active'"
    );
    expect(boundary.plan).toEqual([]);
  });

  it.each(['studio', 'amendment'] as const)(
    'rejects a missing %s project before reading sources',
    async kind => {
      boundary.plan.push([]);
      const scope: ProjectScope =
        kind === 'studio' ? { kind, projectId: project } : { kind, amendmentId: project };
      await expect(resolveProjectSources(actor, scope, [ref])).rejects.toThrowError(
        expect.objectContaining({ status: 404 })
      );
      expect(boundary.canonical).not.toHaveBeenCalled();
    }
  );

  it('rejects an actor outside the project audience even when no sources were requested', async () => {
    audience({ kind: 'studio', projectId: project }, 'private', false, [member]);
    await expect(
      resolveProjectSources(actor, { kind: 'studio', projectId: project }, [])
    ).rejects.toThrow('No project collaboration access');
    expect(boundary.canonical).not.toHaveBeenCalled();
  });

  it('uses canonical enrichment instead of the fallback search payload when available', async () => {
    boundary.plan.push([source()]);
    const canonical = {
      entityType: 'event' as const,
      entityId: sourceId,
      title: 'Canonical event',
      prompt_context: 'Canonical context',
    };
    boundary.canonical.mockResolvedValue(canonical);
    await expect(resolveProjectSources(actor, null, [ref])).resolves.toEqual([canonical]);
    expect(boundary.enrich).toHaveBeenCalledWith([canonical]);
  });

  it('maps a document source to its owning amendment for audience checks while retaining its document reference', async () => {
    boundary.plan.push([{ amendment_id: project }], [source()]);
    const result = await resolveProjectSources(actor, null, [{ type: 'document', id: sourceId }]);
    expect(boundary.calls[0].statement).toContain('from document');
    expect(boundary.calls[1].parameters).toEqual(['amendment', project]);
    expect(boundary.canonical).toHaveBeenCalledWith(actor, {
      entityType: 'document',
      entityId: sourceId,
    });
    expect(result[0]).toMatchObject({ entityType: 'document', entityId: sourceId });
  });

  it.each([undefined, { amendment_id: null }])(
    'rejects a document without a readable parent amendment: %j',
    async document => {
      boundary.plan.push(document ? [document] : []);
      await expect(
        resolveProjectSources(actor, null, [{ type: 'document', id: sourceId }])
      ).rejects.toThrow('Source is unavailable');
      expect(boundary.canonical).not.toHaveBeenCalled();
      expect(boundary.calls).toHaveLength(1);
    }
  );

  it('rejects invalid UUID references and unavailable search rows', async () => {
    await expect(
      resolveProjectSources(actor, null, [{ type: 'event', id: 'invalid' }])
    ).rejects.toThrowError(expect.objectContaining({ status: 400 }));
    expect(boundary.calls).toEqual([]);
    boundary.plan.push([]);
    await expect(resolveProjectSources(actor, null, [ref])).rejects.toThrowError(
      expect.objectContaining({ status: 403 })
    );
  });

  it.each([
    ['public', 'private', 'not public enough'],
    ['public', 'authenticated', 'not public enough'],
    ['authenticated', 'private', 'all signed-in users'],
  ] as const)(
    'rejects source visibility %s/%s before sharing the canonical payload',
    async (visibility, sourceVisibility, message) => {
      audience({ kind: 'studio', projectId: project }, visibility);
      boundary.plan.push([source(sourceVisibility)]);
      await expect(
        resolveProjectSources(actor, { kind: 'studio', projectId: project }, [ref])
      ).rejects.toThrow(message);
      expect(boundary.canonical).not.toHaveBeenCalled();
      expect(boundary.enrich).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['public', 'public'],
    ['authenticated', 'public'],
    ['authenticated', 'authenticated'],
  ] as const)(
    'allows public audience visibility %s/%s without a private ACL lookup',
    async (visibility, sourceVisibility) => {
      audience({ kind: 'studio', projectId: project }, visibility);
      boundary.plan.push([source(sourceVisibility)]);
      await expect(
        resolveProjectSources(actor, { kind: 'studio', projectId: project }, [ref])
      ).resolves.toHaveLength(1);
      expect(boundary.calls).toHaveLength(3);
      expect(boundary.calls.some(call => call.statement.includes('search_document_acl'))).toBe(
        false
      );
    }
  );

  it('requires every current reader in a private ACL and never enriches a rejected source', async () => {
    audience({ kind: 'studio', projectId: project });
    boundary.plan.push([source('private')], [{ user_id: actor }]);
    await expect(
      resolveProjectSources(actor, { kind: 'studio', projectId: project }, [ref])
    ).rejects.toThrow('project audience');
    expect(boundary.canonical).not.toHaveBeenCalled();
    expect(boundary.enrich).not.toHaveBeenCalled();
  });

  it('limits one model request to twenty validated and enriched references', async () => {
    boundary.plan.push(...Array.from({ length: 20 }, () => [source()]));
    await expect(
      resolveProjectSources(
        actor,
        null,
        Array.from({ length: 21 }, () => ref)
      )
    ).resolves.toHaveLength(20);
    expect(boundary.canonical).toHaveBeenCalledTimes(20);
    expect(boundary.calls).toHaveLength(20);
    expect(boundary.enrich).toHaveBeenCalledOnce();
  });

  it('checks existing project and active AI proposal sources while ignoring nonarray metadata', async () => {
    boundary.plan.push(
      [
        { ai_sources: null },
        { ai_sources: { forged: true } },
        { ai_sources: [] },
        { ai_sources: [ref] },
      ],
      [source('private')],
      [{ user_id: actor }]
    );
    await expect(assertProjectAiSourceSharing(project, [actor, actor])).resolves.toBeUndefined();
    expect(boundary.calls[0].statement).toContain("ai_status='ready'");
    expect(boundary.calls[0].statement).toContain("state not in ('withdrawn')");
    expect(boundary.calls[0].statement).toContain("decision is distinct from 'rejected'");
    expect(boundary.calls.at(-1)?.parameters[1]).toEqual({ values: [actor] });
    expect(boundary.canonical).not.toHaveBeenCalled();
  });

  it('checks all sources before a project visibility upgrade', async () => {
    boundary.plan.push([{ ai_sources: [ref] }], [source('private')]);
    await expect(assertProjectAiSourceSharing(project, [actor], 'public', sql)).rejects.toThrow(
      'not public enough'
    );
    expect(boundary.calls).toHaveLength(2);
  });

  it('accepts no-reader private source checks and string-normalized SQL reader IDs', async () => {
    boundary.plan.push([{ ai_sources: [ref] }], [source('private')]);
    await expect(
      assertProjectAiSourceSharing(project, [], 'private', sql)
    ).resolves.toBeUndefined();
    expect(boundary.calls).toHaveLength(2);
    boundary.plan.push([{ ai_sources: [ref] }], [source('private')], [{ user_id: 7 }]);
    await expect(
      assertProjectAiSourceSharing(project, ['7'], 'private', sql)
    ).resolves.toBeUndefined();
  });

  it('does not query a proposal audience without source references', async () => {
    await expect(
      assertStudioProposalSourceAudience(actor, project, [], sql)
    ).resolves.toBeUndefined();
    expect(boundary.sql).not.toHaveBeenCalled();
  });

  it.each([actor, null])(
    'checks proposal sources for trusted or anonymous actor %s',
    async user => {
      audience({ kind: 'studio', projectId: project }, 'public');
      boundary.plan.push([source()]);
      await expect(
        assertStudioProposalSourceAudience(user, project, [ref], sql)
      ).resolves.toBeUndefined();
      expect(boundary.calls).toHaveLength(3);
    }
  );

  it('rejects a proposal actor outside the current project audience', async () => {
    audience({ kind: 'studio', projectId: project }, 'private', true, [member]);
    await expect(assertStudioProposalSourceAudience(actor, project, [ref], sql)).rejects.toThrow(
      'No project collaboration access'
    );
    expect(boundary.calls).toHaveLength(2);
  });

  it('propagates SQL and canonical resolver failures without returning partial shared sources', async () => {
    boundary.sql.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(resolveProjectSources(actor, null, [ref])).rejects.toThrow('Database unavailable');
    boundary.plan.push([source()]);
    boundary.canonical.mockRejectedValueOnce(new Error('Canonical access denied'));
    await expect(resolveProjectSources(actor, null, [ref])).rejects.toThrow(
      'Canonical access denied'
    );
    expect(boundary.enrich).not.toHaveBeenCalled();
  });
});
