import { createZeroContext, executeZeroTransaction } from '@/server/zero-mutate';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { validateExport } from '@/features/communication-studio/logic/document';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { v3DocumentToLegacy } from '@/features/communication-studio/logic/v3-adapter';
import { StudioError } from './db';
import { studioQueries } from '@/zero/communication-studio/queries';
import { createLiveSnapshot } from '@/features/communication-studio/logic/live-snapshot';
import type { LiveSource } from '@/features/communication-studio/logic/live-contract';
import { resultSourceRefs } from '@/features/communication-studio/logic/live-projection';
export async function queueCommittedExport(
  actor: string,
  projectId: string,
  format: string,
  pageIds: string[],
  revision: number,
  operationId?: string,
  snapshot?: { portrait?: boolean; presentation?: boolean }
) {
  return executeZeroTransaction(createZeroContext(actor), async tx => {
    const sql = sqlTransaction(tx);
    await lockAuthority(sql);
    const [access] = await rows<{ allowed: boolean }>(
      sql,
      'select studio_access($1::uuid,$2::uuid,true) as allowed',
      [actor, projectId]
    );
    if (!access?.allowed) throw new Error('Studio access denied');
    if (operationId) {
      const [prior] = await rows<{ id: string }>(
        sql,
        'select id from studio_export where id=$1 and project_id=$2 and requested_by_id=$3',
        [operationId, projectId, actor]
      );
      if (prior) return { id: prior.id, revision };
    }
    const [row] = await rows<{ document: unknown; content_revision: number }>(
      sql,
      'select document,content_revision from studio_state where project_id=$1 for update',
      [projectId]
    );
    if (!row || Number(row.content_revision) !== revision)
      throw new StudioError('Studio changes are still saving. Please try the export again.', 409);
    const raw = studioDocumentV3Schema.parse(row.document);
    const refs = [
      ...new Map(
        raw.nodes.flatMap(n =>
          n.liveBinding
            ? [
                [
                  `${n.liveBinding.sourceType}:${n.liveBinding.sourceId}`,
                  { type: n.liveBinding.sourceType, id: n.liveBinding.sourceId },
                ] as const,
              ]
            : []
        )
      ).values(),
    ];
    const sources = refs.length
      ? ((await tx.run(
          studioQueries.liveSources.fn({ args: { refs }, ctx: createZeroContext(actor) })
        )) as unknown as LiveSource[])
      : [];
    const resultRefs = resultSourceRefs(sources);
    if (resultRefs.length)
      sources.push(
        ...((await tx.run(
          studioQueries.liveSources.fn({
            args: { refs: resultRefs },
            ctx: createZeroContext(actor),
          })
        )) as unknown as LiveSource[])
      );
    let resultsVisible = true;
    if (snapshot?.presentation) {
      const [session] = await rows<{ results_visible: boolean }>(
        sql,
        'select results_visible from event_presentation where project_id=$1',
        [projectId]
      );
      resultsVisible = session?.results_visible ?? true;
    }
    const captured = createLiveSnapshot(raw, sources, {
      now: Date.now(),
      portrait: snapshot?.portrait,
      resultsVisible,
    });
    const value =
      refs.length || snapshot?.portrait || raw.show || raw.nodes.some(n => n.showAnimation)
        ? captured.document
        : raw;
    const exportPageIds = captured.frameIds(pageIds);
    const legacy = v3DocumentToLegacy(value, { allowLongVideo: true });
    if (
      pageIds.some(
        id =>
          !value.nodes.some(
            node =>
              node.type === 'frame' &&
              node.parentFrameId === null &&
              node.id !== value.masterLayout.frameId &&
              node.id === id
          )
      )
    )
      throw new StudioError('A selected Studio frame no longer exists or cannot be exported.', 400);
    // Validated V3 media nodes always carry an asset ID; validate the projected document.
    validateExport(legacy, exportPageIds, true);
    if (operationId) {
      const [prior] = await rows<{ id: string }>(
        sql,
        'select id from studio_export where id=$1 and project_id=$2 and requested_by_id=$3',
        [operationId, projectId, actor]
      );
      if (prior) return { id: prior.id, revision };
    }
    const [count] = await rows<{ n: number }>(
      sql,
      "select count(*)::int as n from studio_export where requested_by_id=$1 and status in ('queued','running')",
      [actor]
    );
    if (count.n >= 5) throw new StudioError('Too many Studio exports are already running.', 429);
    const revisionId = crypto.randomUUID(),
      id = operationId ?? crypto.randomUUID(),
      now = Date.now();
    await sql.query(
      'insert into studio_revision(id,project_id,document,created_by_id,created_at,content_revision) values($1,$2,$3::jsonb,$4,$5,$6)',
      [revisionId, projectId, value, actor, now, revision]
    );
    await sql.query(
      'insert into studio_export(id,project_id,revision_id,requested_by_id,format,page_ids,created_at,updated_at) values($1,$2,$3,$4,$5,$6::jsonb,$7,$7)',
      [id, projectId, revisionId, actor, format, exportPageIds, now]
    );
    return { id, revision };
  });
}
