import { describe, expect, it } from 'vitest';
import { zeroPostgresJS } from '@rocicorp/zero/server/adapters/postgresjs';
import { schema, zql } from '@/zero/schema';
import { createZeroContext } from '@/server/zero-mutate';
import { projectChatSharedMutators } from '@/zero/project-chat/shared-mutators';
import { requireProjectConversation, readContext } from '../context';
import { executeProjectTool, undoProjectChange } from '../tools';
import { rows, lockAuthority } from '@/server/transaction';
import { createDocument } from '@/features/communication-studio/logic/templates';
import {
  legacyDocumentToV3,
  v3DocumentToLegacy,
} from '@/features/communication-studio/logic/v3-adapter';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { documentServerMutators } from '@/zero/documents/server-mutators';

const url = new URL(
  process.env.SUPABASE_DB_URL ??
    process.env.ZERO_UPSTREAM_DB ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Project chat tests require local PostgreSQL');
const provider = zeroPostgresJS(schema, url.toString());
type Tx = Parameters<Parameters<typeof provider.transaction>[0]>[0];
const rollback = new Error('rollback project chat fixture');
async function fixture(work: (tx: Tx, actor: string, outsider: string) => Promise<void>) {
  try {
    await provider.transaction(async tx => {
      await lockAuthority(tx.dbTransaction);
      const actor = crypto.randomUUID(),
        outsider = crypto.randomUUID();
      await tx.dbTransaction.query('insert into "user"(id) values($1),($2)', [actor, outsider]);
      await work(tx, actor, outsider);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function run(tx: Tx, actor: string, conversationId: string) {
  const id = crypto.randomUUID();
  await tx.dbTransaction.query(
    "insert into ai_run(id,conversation_id,actor_id,request_id,status,model,request_hash,lease_token,lease_expires_at,created_at,updated_at) values($1,$2,$3,$4,'running','{}','test',$5,$6,0,0)",
    [id, conversationId, actor, crypto.randomUUID(), crypto.randomUUID(), Date.now() + 120000]
  );
  return id;
}
async function amendment(tx: Tx, actor: string, mode = 'edit') {
  const id = crypto.randomUUID(),
    doc = crypto.randomUUID(),
    chat = crypto.randomUUID();
  await tx.dbTransaction.query(
    "insert into amendment(id,created_by_id,title,visibility) values($1,$2,'Test','public')",
    [id, actor]
  );
  await tx.dbTransaction.query(
    'insert into document(id,amendment_id,content,editing_mode) values($1,$2,$3::jsonb,$4)',
    [doc, id, [{ type: 'p', children: [{ text: 'Original' }] }], mode]
  );
  await tx.dbTransaction.query('update amendment set document_id=$2 where id=$1', [id, doc]);
  await projectChatSharedMutators.create.fn({
    tx,
    ctx: createZeroContext(actor),
    args: { id: chat, scope: { kind: 'amendment', amendmentId: id }, name: 'Project' },
  });
  return { id, doc, chat, runId: await run(tx, actor, chat) };
}
describe('shared project chat authority and atomic writes', () => {
  it('does not equate public amendment visibility or former chat participation with membership', () =>
    fixture(async (tx, actor, outsider) => {
      const project = await amendment(tx, actor);
      await expect(requireProjectConversation(tx, outsider, project.chat)).rejects.toThrow(
        'permission_denied'
      );
      await tx.dbTransaction.query(
        "insert into amendment_collaborator(id,amendment_id,user_id,status) values($1,$2,$3,'active')",
        [crypto.randomUUID(), project.id, outsider]
      );
      expect((await requireProjectConversation(tx, outsider, project.chat)).id).toBe(project.chat);
      await tx.dbTransaction.query(
        'insert into conversation_participant(id,conversation_id,user_id,joined_at) values($1,$2,$3,now())',
        [crypto.randomUUID(), project.chat, outsider]
      );
      await tx.dbTransaction.query(
        "update amendment_collaborator set status='invited' where amendment_id=$1 and user_id=$2",
        [project.id, outsider]
      );
      await expect(requireProjectConversation(tx, outsider, project.chat)).rejects.toThrow(
        'permission_denied'
      );
    }));
  it('saves text with a revision, records an inverse and rejects stale snapshots', () =>
    fixture(async (tx, actor) => {
      const project = await amendment(tx, actor);
      const snapshot = await readContext(
        tx,
        actor,
        project.runId,
        project.chat,
        'amendment_text',
        undefined
      );
      const result = (await executeProjectTool(
        tx,
        actor,
        project.runId,
        project.chat,
        'call-1',
        'amendment_apply_actions',
        {
          snapshotId: snapshot.snapshotId,
          summary: 'Change text',
          actions: [{ type: 'text.replace', anchorRef: 'text_0_0', text: 'New' }],
        }
      )) as { changeSetId: string };
      expect((await tx.run(zql.document.where('id', project.doc).one()))?.content_revision).toBe(1);
      await expect(
        executeProjectTool(
          tx,
          actor,
          project.runId,
          project.chat,
          'call-2',
          'amendment_apply_actions',
          {
            snapshotId: snapshot.snapshotId,
            summary: 'Stale',
            actions: [{ type: 'text.replace', anchorRef: 'text_0_0', text: 'Other' }],
          }
        )
      ).rejects.toThrow('resource changed');
      await undoProjectChange(tx, actor, result.changeSetId);
      expect((await tx.run(zql.document.where('id', project.doc).one()))?.content).toEqual([
        { type: 'p', children: [{ text: 'Original' }] },
      ]);
      const [change] = await rows(
        tx.dbTransaction,
        'select status from ai_change_set where id=$1',
        [result.changeSetId]
      );
      expect(change.status).toBe('undone');
    }));
  it('creates native proposals in suggestion mode and cannot edit during voting', () =>
    fixture(async (tx, actor) => {
      const project = await amendment(tx, actor, 'suggest_internal');
      const snapshot = await readContext(
        tx,
        actor,
        project.runId,
        project.chat,
        'amendment_text',
        undefined
      );
      const result = (await executeProjectTool(
        tx,
        actor,
        project.runId,
        project.chat,
        'proposal',
        'amendment_apply_actions',
        {
          snapshotId: snapshot.snapshotId,
          summary: 'Proposal',
          actions: [{ type: 'text.replace', anchorRef: 'text_0_0', text: 'Proposed' }],
        }
      )) as { status: string; proposalIds: string[] };
      expect(result.status).toBe('proposed');
      expect(result.proposalIds).toHaveLength(1);
      expect(
        await tx.run(zql.change_request.where('id', result.proposalIds[0]).one())
      ).toBeTruthy();
      await tx.dbTransaction.query("update document set editing_mode='vote_internal' where id=$1", [
        project.doc,
      ]);
      const blocked = await readContext(
        tx,
        actor,
        project.runId,
        project.chat,
        'amendment_text',
        undefined
      );
      await expect(
        executeProjectTool(
          tx,
          actor,
          project.runId,
          project.chat,
          'blocked',
          'amendment_apply_actions',
          {
            snapshotId: blocked.snapshotId,
            summary: 'Blocked',
            actions: [
              {
                type: 'blocks.append',
                blocks: [{ kind: 'paragraph', content: [{ text: 'Bypass' }] }],
              },
            ],
          }
        )
      ).rejects.toThrow('editing_mode_readonly');
    }));
  it('checks manual writes against AI revisions', () =>
    fixture(async (tx, actor) => {
      const project = await amendment(tx, actor);
      await tx.dbTransaction.query("update document set content='[]'::jsonb where id=$1", [
        project.doc,
      ]);
      await expect(
        documentServerMutators.updateContent.fn({
          tx,
          ctx: createZeroContext(actor),
          args: { id: project.doc, expected_content_revision: 0, content: [] },
        })
      ).rejects.toThrow('revision_conflict');
    }));
  it('commits Studio changes through Zero and supports repeated conditional undo and redo', () =>
    fixture(async (tx, actor) => {
      const projectId = crypto.randomUUID(),
        chat = crypto.randomUUID(),
        value = createDocument('single', 'Original');
      const persisted = legacyDocumentToV3(value);
      await tx.dbTransaction.query(
        "insert into studio_project(id,owner_id,title,kind,document_schema_version,created_at,updated_at) values($1,$2,'Original','single',3,0,0)",
        [projectId, actor]
      );
      await tx.dbTransaction.query(
        'insert into studio_state(project_id,document,updated_at) values($1,$2::jsonb,0)',
        [projectId, persisted]
      );
      await projectChatSharedMutators.create.fn({
        tx,
        ctx: createZeroContext(actor),
        args: { id: chat, scope: { kind: 'studio', projectId }, name: 'Studio' },
      });
      const runId = await run(tx, actor, chat),
        snapshot = await readContext(tx, actor, runId, chat, 'studio', undefined);
      const result = (await executeProjectTool(
        tx,
        actor,
        runId,
        chat,
        'studio-call',
        'studio_apply_actions',
        {
          snapshotId: snapshot.snapshotId,
          summary: 'Rename',
          actions: [{ type: 'project.patch', patch: { title: 'New' } }],
        }
      )) as { changeSetId: string };
      expect((await tx.run(zql.studio_project.where('id', projectId).one()))?.title).toBe('New');
      await undoProjectChange(tx, actor, result.changeSetId);
      expect((await tx.run(zql.studio_project.where('id', projectId).one()))?.title).toBe(
        'Original'
      );
      await undoProjectChange(tx, actor, result.changeSetId, true);
      expect((await tx.run(zql.studio_project.where('id', projectId).one()))?.title).toBe('New');
      await undoProjectChange(tx, actor, result.changeSetId);
      expect((await tx.run(zql.studio_project.where('id', projectId).one()))?.title).toBe(
        'Original'
      );
      const pageId = value.pages[0].id,
        elementId = value.pages[0].elements.find(e => e.type === 'text')!.id;
      const fresh = () => readContext(tx, actor, runId, chat, 'studio', undefined);
      const format = await fresh();
      const formatted = await executeProjectTool(
        tx,
        actor,
        runId,
        chat,
        'format',
        'studio_format_text',
        {
          snapshotId: format.snapshotId,
          summary: 'Format heading',
          pageId,
          elementIds: [elementId],
          patch: { bold: true, align: 'center' },
        }
      );
      expect(formatted).toMatchObject({ status: 'applied' });
      const loaded = await tx.run(zql.studio_state.where('project_id', projectId).one());
      expect(
        v3DocumentToLegacy(studioDocumentV3Schema.parse(loaded!.document)).pages[0].elements.find(
          e => e.id === elementId
        )
      ).toMatchObject({
        bold: true,
        align: 'center',
      });
      const shapeInput = {
        snapshotId: (await fresh()).snapshotId,
        summary: 'Insert shape',
        pageId,
        ref: 'shape',
        shape: 'rect',
        width: 100,
        height: 100,
      };
      const first = (await executeProjectTool(
        tx,
        actor,
        runId,
        chat,
        'shape1',
        'studio_insert_shape',
        shapeInput
      )) as { createdRefs: Record<string, string> };
      const second = (await executeProjectTool(
        tx,
        actor,
        runId,
        chat,
        'shape2',
        'studio_insert_shape',
        shapeInput
      )) as { createdRefs: Record<string, string> };
      expect(second.createdRefs).toEqual(first.createdRefs);
      const afterShapes = await tx.run(zql.studio_state.where('project_id', projectId).one());
      expect(
        v3DocumentToLegacy(
          studioDocumentV3Schema.parse(afterShapes!.document)
        ).pages[0].elements.filter(e => e.id === first.createdRefs.shape)
      ).toHaveLength(1);
      await executeProjectTool(tx, actor, runId, chat, 'align', 'studio_align_elements', {
        snapshotId: (await fresh()).snapshotId,
        summary: 'Center shape',
        pageId,
        elementIds: [first.createdRefs.shape],
        direction: 'center',
        reference: 'page',
      });
      const stored = v3DocumentToLegacy(
        studioDocumentV3Schema.parse(
          (await tx.run(zql.studio_state.where('project_id', projectId).one()))!.document
        )
      );
      expect(stored.pages[0].elements.find(e => e.id === first.createdRefs.shape)!.x).toBe(490);
    }));
});
