import { z } from 'zod';
import { studioTransaction, StudioError, assertStudioAccess, canvasEnabled } from './db';
import { checksum } from '@/server/checksum';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { canvasPhaseSchema } from '@/features/communication-studio/logic/governance';
import {
  studioChangeSchema,
  diffStudio,
  mergeStudioV3,
} from '@/features/communication-studio/logic/operations';
import { internalVoteResult } from '@/zero/change-requests/vote-result';
import { validateStudioAssetsInTransaction } from './assets';
import type postgres from 'postgres';

const inputSchema = z.object({
  projectId: z.string().uuid(),
  action: z.enum([
    'session',
    'loadDraft',
    'createDraft',
    'resolveDraft',
    'saveDraft',
    'submit',
    'withdraw',
    'share',
    'phase',
    'startVote',
    'vote',
    'finalize',
    'reapply',
    'comment',
    'resolveComment',
    'editComment',
    'restore',
    'saveLibrary',
    'libraries',
    'setCapability',
    'adopt',
  ]),
  operationId: z.string().uuid().optional(),
  generation: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  revision: z.number().int().nonnegative().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  reason: z.string().max(10000).optional(),
  changes: z.array(studioChangeSchema).max(20000).optional(),
  phase: canvasPhaseSchema.optional(),
  userIds: z.array(z.string().uuid()).max(200).optional(),
  choice: z.enum(['accept', 'reject', 'abstain']).optional(),
  minutes: z.number().int().min(1).max(43200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  elementId: z.string().max(200).nullable().optional(),
  commentId: z.string().uuid().optional(),
  historyId: z.string().uuid().optional(),
  library: z.array(z.json()).max(1000).optional(),
  roleId: z.string().uuid().optional(),
  capability: z.enum(['suggest', 'comment', 'vote']).optional(),
  allowed: z.boolean().optional(),
  groupId: z.string().uuid().optional(),
});
type Sql = postgres.TransactionSql;
function denied(): never {
  throw new StudioError('Canvas operation is not permitted', 403);
}
const requireValue = <T>(value: T | undefined): T => {
  if (value === undefined) throw new StudioError('Missing canvas input');
  return value;
};

async function validateAssets(
  sql: Sql,
  projectId: string,
  document: unknown,
  workspaceId?: string
) {
  await validateStudioAssetsInTransaction(
    { query: (q, args) => sql.unsafe(q, args as never[]) },
    projectId,
    document,
    workspaceId
  );
}

async function applyDecision(sql: Sql, proposal: postgres.Row, control: postgres.Row) {
  if (proposal.decision !== 'accepted' || ['applied', 'superseded'].includes(proposal.application))
    return;
  assertBallotIntegrity(proposal);
  const [stored] =
    await sql`select * from studio_state where project_id=${proposal.project_id} for update`;
  const merged = mergeStudioV3(
    studioDocumentV3Schema.parse(stored.document),
    z.array(studioChangeSchema).parse(proposal.changes)
  );
  const conflicts =
    proposal.base_generation !== control.generation
      ? [{ reason: 'generation_changed' }]
      : merged.conflicts;
  if (conflicts.length) {
    await sql`update canvas_proposal set application='conflict',conflicts=${sql.json(z.json().parse(conflicts) as postgres.JSONValue)},updated_at=${Date.now()} where id=${proposal.id}`;
    return;
  }
  await validateAssets(sql, proposal.project_id, merged.value, proposal.id);
  const assetIds = [
    ...merged.value.nodes.flatMap(node =>
      node.type === 'media'
        ? [node.assetId]
        : node.type === 'chart' && node.sourceAssetId
          ? [node.sourceAssetId]
          : []
    ),
  ].filter((id): id is string => !!id);
  if (assetIds.length)
    await sql`update studio_asset set workspace_id=null where workspace_id=${proposal.id} and id in ${sql(assetIds)}`;
  await sql`select set_config('polity.canvas_command',${proposal.project_id},true)`;
  await sql`update studio_state set document=${sql.json(JSON.parse(JSON.stringify(merged.value)) as postgres.JSONValue)},content_revision=content_revision+1,updated_at=${Date.now()} where project_id=${proposal.project_id}`;
  await sql`update studio_project set title=${merged.value.title},updated_at=${Date.now()} where id=${proposal.project_id}`;
  await sql`update canvas_proposal set application='applied',conflicts='[]',updated_at=${Date.now()} where id=${proposal.id}`;
  if (proposal.resolves_id)
    await sql`update canvas_proposal set application='superseded',updated_at=${Date.now()} where id=${proposal.resolves_id} and project_id=${proposal.project_id} and decision='accepted' and application='conflict'`;
}

function assertBallotIntegrity(proposal: postgres.Row) {
  if (
    !proposal.changes ||
    proposal.checksum !==
      checksum({
        base: proposal.base_revision,
        generation: proposal.base_generation,
        changes: proposal.changes,
      })
  )
    throw new StudioError('The submitted proposal failed its integrity check', 409);
}

async function finalize(sql: Sql, p: postgres.Row, control: postgres.Row) {
  if (p.state === 'closed') return;
  if (p.state !== 'voting' || !p.electorate?.length || !p.changes || !p.checksum)
    throw new StudioError('Incomplete ballot');
  assertBallotIntegrity(p);
  const votes = await sql`select choice from canvas_vote where proposal_id=${p.id}`;
  const result = internalVoteResult({
    votes_for: votes.filter(v => v.choice === 'accept').length,
    votes_against: votes.filter(v => v.choice === 'reject').length,
  });
  const decision = result === 'passed' ? 'accepted' : 'rejected';
  await sql`update canvas_proposal set state='closed',decision=${decision},application=${decision === 'accepted' ? 'pending' : 'not_applicable'},updated_at=${Date.now()} where id=${p.id}`;
  await applyDecision(sql, { ...p, decision }, control);
}

export async function canvasCommand(actor: string, raw: unknown): Promise<any> {
  if (!canvasEnabled()) throw new StudioError('Canvas preview is not enabled', 404);
  const input = inputSchema.parse(raw);
  const readOnly = ['session', 'loadDraft', 'libraries'].includes(input.action);
  return studioTransaction(
    async sql => {
      const { projectId, action, workspaceId } = input;
      await assertStudioAccess(actor, projectId, false, sql);
      const [project] =
        await sql`select *,studio_access(${actor}::uuid,id,true) as can_edit,canvas_manage(${actor}::uuid,id) as can_manage from studio_project where id=${projectId} and document_schema_version=5 ${readOnly ? sql`` : sql`for update`}`;
      const [control] =
        await sql`select * from canvas_control where project_id=${projectId} ${readOnly ? sql`` : sql`for update`}`;
      const [canonical] =
        await sql`select * from studio_state where project_id=${projectId} ${readOnly ? sql`` : sql`for update`}`;
      if (!project || !control || !canonical)
        throw new StudioError('Studio V5 project not found', 404);
      let proposal: postgres.Row | undefined;
      if (workspaceId) {
        [proposal] =
          await sql`select *,canvas_proposal_access(${actor}::uuid,id) as can_read from canvas_proposal where id=${workspaceId} and project_id=${projectId} ${readOnly ? sql`` : sql`for update`}`;
        if (!proposal?.can_read) denied();
      }
      const [rights] =
        await sql`select canvas_capability(${actor}::uuid,${projectId}::uuid,'suggest') as suggest,canvas_capability(${actor}::uuid,${projectId}::uuid,'comment') as comment,canvas_capability(${actor}::uuid,${projectId}::uuid,'vote') as vote`;
      const capabilities = {
        read: true,
        edit: !!project.can_edit && control.phase === 'edit',
        suggest: !!rights.suggest,
        comment: !!rights.comment,
        vote: !!rights.vote,
        manage: !!project.can_manage,
      };
      if (action === 'session') {
        const proposals =
          await sql`select id,title,reason,owner_id,shared_ids,revision,base_revision,state,changes,decision,application,conflicts,electorate,deadline,resolves_id from canvas_proposal where project_id=${projectId} and canvas_proposal_access(${actor}::uuid,id) order by created_at`;
        for (const p of proposals)
          p.votes = await sql`select user_id,choice from canvas_vote where proposal_id=${p.id}`;
        const comments =
          await sql`select * from canvas_comment where project_id=${projectId} and (proposal_id is null or canvas_proposal_access(${actor}::uuid,proposal_id)) order by created_at`;
        const revisions =
          await sql`select id,revision,created_at from canvas_history where project_id=${projectId} order by revision desc limit 100`;
        const members = project.group_id
          ? await sql`select u.id,u.first_name,u.last_name from "user" u where u.id in (select owner_id from "group" where id=${project.group_id} union select user_id from group_membership where group_id=${project.group_id} and status in ('active','member','admin'))`
          : [];
        const roles =
          capabilities.manage && project.group_id
            ? await sql`select r.id,r.name,coalesce(jsonb_object_agg(c.capability,c.allowed) filter(where c.capability is not null),'{}') as capabilities from role r left join canvas_role_capability c on c.role_id=r.id where r.group_id=${project.group_id} group by r.id,r.name`
            : [];
        return {
          phase: control.phase,
          groupId: project.group_id,
          generation: control.generation,
          capabilities,
          proposals,
          comments,
          revisions,
          members,
          roles,
          adoptionGroups:
            !project.group_id && project.owner_id === actor
              ? await sql`select id,name from "group" where studio_group_access(${actor}::uuid,id,true) order by name`
              : [],
        };
      }
      if (action === 'loadDraft') {
        if (!proposal) denied();
        return {
          canvasEnabled: true,
          document: studioDocumentV3Schema.parse(proposal.document),
          revision: proposal.revision,
          generation: control.generation,
          canEdit:
            capabilities.suggest &&
            proposal.state === 'draft' &&
            (['edit', 'suggest_internal'].includes(control.phase) ||
              (control.phase === 'vote_internal' && !!proposal.resolves_id)) &&
            (proposal.owner_id === actor || proposal.shared_ids.includes(actor)),
        };
      }
      if (action === 'libraries')
        return sql`select l.id,l.name,l.content from canvas_library l join studio_project p on p.id=l.project_id where studio_access(${actor}::uuid,p.id,false) and ((p.group_id is null and ${project.group_id}::uuid is null and p.owner_id=${actor}) or (p.group_id=${project.group_id}::uuid)) order by l.created_at`;
      const operationId = requireValue(input.operationId);
      const hash = checksum(input);
      const [prior] = await sql`select * from canvas_receipt where id=${operationId}`;
      if (prior) {
        if (prior.actor_id !== actor || prior.input_hash !== hash)
          throw new StudioError('Operation ID reused', 409);
        return prior.result;
      }
      if (input.generation !== control.generation)
        throw new StudioError('Canvas generation changed; recover the local draft first', 409);
      let result: unknown = { ok: true };
      const ownDraft = (exact = true) => {
        if (
          !proposal ||
          !capabilities.suggest ||
          proposal.state !== 'draft' ||
          (proposal.owner_id !== actor && !proposal.shared_ids.includes(actor)) ||
          !(
            ['edit', 'suggest_internal'].includes(control.phase) ||
            (control.phase === 'vote_internal' && !!proposal.resolves_id)
          )
        )
          denied();
        if (
          input.revision === undefined ||
          input.revision > proposal.revision ||
          (exact && input.revision !== proposal.revision)
        )
          throw new StudioError('Proposal revision changed', 409);
        return proposal;
      };
      switch (action) {
        case 'adopt': {
          if (
            project.group_id ||
            project.owner_id !== actor ||
            control.phase !== 'edit' ||
            input.revision !== canonical.content_revision
          )
            denied();
          const target = requireValue(input.groupId);
          const [allowed] =
            await sql`select studio_group_access(${actor}::uuid,${target}::uuid,true) as value`;
          if (!allowed.value) denied();
          await sql`update studio_project set group_id=${target},updated_at=${Date.now()} where id=${projectId}`;
          await sql`update canvas_control set generation=gen_random_uuid() where project_id=${projectId}`;
          await sql`update studio_state set content_revision=content_revision+1,updated_at=${Date.now()} where project_id=${projectId}`;
          result = { groupId: target };
          break;
        }
        case 'phase': {
          if (!capabilities.manage || !project.group_id) denied();
          if (input.revision !== canonical.content_revision)
            throw new StudioError('Canvas revision changed', 409);
          const [pending] =
            await sql`select id from canvas_proposal where project_id=${projectId} and (state='voting' or application='conflict') limit 1`;
          if (pending)
            throw new StudioError('Resolve active ballots and application conflicts first', 409);
          await sql`update canvas_control set phase=${requireValue(input.phase)} where project_id=${projectId}`;
          break;
        }
        case 'resolveDraft':
        case 'createDraft': {
          const resolving =
            action === 'resolveDraft' &&
            proposal?.decision === 'accepted' &&
            proposal.application === 'conflict';
          if (
            !capabilities.suggest ||
            !(
              (resolving && control.phase === 'vote_internal') ||
              ['edit', 'suggest_internal'].includes(control.phase)
            )
          )
            denied();
          if (action === 'resolveDraft' && !resolving) denied();
          if (input.revision !== canonical.content_revision)
            throw new StudioError('Canvas revision changed', 409);
          await sql`insert into canvas_proposal(id,project_id,owner_id,title,reason,base_document,base_revision,base_generation,document,resolves_id,created_at,updated_at) values(${operationId},${projectId},${actor},${requireValue(input.title)},${input.reason ?? ''},${sql.json(canonical.document)},${canonical.content_revision},${control.generation},${sql.json(canonical.document)},${resolving ? proposal?.id : null},${Date.now()},${Date.now()})`;
          result = { workspaceId: operationId };
          break;
        }
        case 'saveDraft': {
          const p = ownDraft(false);
          const merged = mergeStudioV3(
            studioDocumentV3Schema.parse(p.document),
            requireValue(input.changes)
          );
          if (!merged.conflicts.length) {
            await validateAssets(sql, projectId, merged.value, p.id);
            await sql`update canvas_proposal set document=${sql.json(JSON.parse(JSON.stringify(merged.value)) as postgres.JSONValue)},revision=revision+1,updated_at=${Date.now()} where id=${p.id}`;
          }
          result = {
            operationId,
            document: merged.conflicts.length ? p.document : merged.value,
            revision: p.revision + (merged.conflicts.length ? 0 : 1),
            status: merged.conflicts.length ? 'conflict' : 'applied',
            conflicts: merged.conflicts,
          };
          break;
        }
        case 'share': {
          const p = ownDraft();
          if (p.owner_id !== actor) denied();
          for (const id of input.userIds ?? []) await assertStudioAccess(id, projectId, false, sql);
          await sql`update canvas_proposal set shared_ids=${input.userIds ?? []},updated_at=${Date.now()} where id=${p.id}`;
          break;
        }
        case 'submit': {
          const p = ownDraft();
          if (p.owner_id !== actor) denied();
          const changes = diffStudio(p.base_document, p.document);
          if (!changes.length) throw new StudioError('Proposal has no changes');
          await validateAssets(sql, projectId, p.document, p.id);
          await sql`update canvas_proposal set state='submitted',changes=${sql.json(changes)},checksum=${checksum({ base: p.base_revision, generation: p.base_generation, changes })},updated_at=${Date.now()} where id=${p.id}`;
          break;
        }
        case 'withdraw': {
          if (
            !proposal ||
            proposal.owner_id !== actor ||
            !['draft', 'submitted'].includes(proposal.state)
          )
            denied();
          await sql`update canvas_proposal set state='withdrawn',application='not_applicable',updated_at=${Date.now()} where id=${requireValue(workspaceId)}`;
          break;
        }
        case 'startVote': {
          if (
            !capabilities.manage ||
            control.phase !== 'vote_internal' ||
            proposal?.state !== 'submitted'
          )
            denied();
          assertBallotIntegrity(proposal);
          const electorate =
            await sql`select id from (select owner_id as id from "group" where id=${project.group_id} union select user_id as id from group_membership where group_id=${project.group_id} and status in ('active','member','admin')) members where canvas_capability(id,${projectId}::uuid,'vote')`;
          if (!electorate.length) throw new StudioError('No eligible voters');
          await sql`update canvas_proposal set state='voting',electorate=${electorate.map(v => v.id)},deadline=${Date.now() + (input.minutes ?? 5) * 60000},updated_at=${Date.now()} where id=${requireValue(workspaceId)}`;
          break;
        }
        case 'vote': {
          if (
            !capabilities.vote ||
            control.phase !== 'vote_internal' ||
            proposal?.state !== 'voting' ||
            !proposal.electorate.includes(actor)
          )
            denied();
          if (Date.now() >= Number(proposal.deadline)) {
            await finalize(sql, proposal, control);
            result = { closed: true };
            break;
          }
          await sql`insert into canvas_vote(proposal_id,user_id,choice,created_at) values(${requireValue(workspaceId)},${actor},${requireValue(input.choice)},${Date.now()}) on conflict(proposal_id,user_id) do update set choice=excluded.choice,created_at=excluded.created_at`;
          const [count] =
            await sql`select count(*)::int as n from canvas_vote where proposal_id=${requireValue(workspaceId)}`;
          if (count.n === proposal.electorate.length) await finalize(sql, proposal, control);
          break;
        }
        case 'finalize': {
          if (
            !proposal ||
            control.phase !== 'vote_internal' ||
            (!capabilities.manage && Date.now() < Number(proposal.deadline))
          )
            denied();
          await finalize(sql, proposal, control);
          break;
        }
        case 'reapply': {
          if (
            !capabilities.manage ||
            proposal?.decision !== 'accepted' ||
            proposal.application !== 'conflict'
          )
            denied();
          await applyDecision(sql, proposal, control);
          break;
        }
        case 'comment': {
          if (!capabilities.comment) denied();
          await sql`insert into canvas_comment(id,project_id,proposal_id,author_id,element_id,body,created_at,updated_at) values(${operationId},${projectId},${workspaceId ?? null},${actor},${input.elementId ?? null},${requireValue(input.body)},${Date.now()},${Date.now()})`;
          break;
        }
        case 'editComment':
        case 'resolveComment': {
          if (!capabilities.comment) denied();
          const [comment] =
            await sql`select * from canvas_comment where id=${requireValue(input.commentId)} and project_id=${projectId}`;
          if (!comment || (comment.author_id !== actor && !capabilities.manage)) denied();
          if (action === 'editComment' && comment.author_id !== actor) denied();
          if (comment.proposal_id) {
            const [access] =
              await sql`select canvas_proposal_access(${actor}::uuid,${comment.proposal_id}::uuid) as allowed`;
            if (!access.allowed) denied();
          }
          if (action === 'editComment')
            await sql`update canvas_comment set body=${requireValue(input.body)},updated_at=${Date.now()} where id=${comment.id}`;
          else
            await sql`update canvas_comment set resolved=true,updated_at=${Date.now()} where id=${comment.id}`;
          break;
        }
        case 'restore': {
          if (
            !capabilities.manage ||
            control.phase !== 'edit' ||
            input.revision !== canonical.content_revision
          )
            denied();
          const [active] =
            await sql`select id from canvas_proposal where project_id=${projectId} and state='voting' limit 1`;
          if (active) denied();
          const [history] =
            await sql`select * from canvas_history where id=${requireValue(input.historyId)} and project_id=${projectId}`;
          if (!history) throw new StudioError('Revision not found', 404);
          await validateAssets(sql, projectId, history.document);
          await sql`update canvas_control set generation=gen_random_uuid() where project_id=${projectId}`;
          await sql`update studio_state set document=${sql.json(history.document)},content_revision=content_revision+1,updated_at=${Date.now()} where project_id=${projectId}`;
          await sql`update studio_project set title=${history.document.title},updated_at=${Date.now()} where id=${projectId}`;
          break;
        }
        case 'saveLibrary': {
          if (!project.can_edit) denied();
          await sql`delete from canvas_library where project_id=${projectId} and name=${requireValue(input.title)} and created_by=${actor}`;
          await sql`insert into canvas_library(project_id,name,content,created_by,created_at) values(${projectId},${requireValue(input.title)},${sql.json(requireValue(input.library))},${actor},${Date.now()})`;
          break;
        }
        case 'setCapability': {
          if (!capabilities.manage || !project.group_id) denied();
          const [role] =
            await sql`select id from role where id=${requireValue(input.roleId)} and group_id=${project.group_id}`;
          if (!role) denied();
          await sql`insert into canvas_role_capability(role_id,capability,allowed) values(${role.id},${requireValue(input.capability)},${requireValue(input.allowed)}) on conflict(role_id,capability) do update set allowed=excluded.allowed`;
          break;
        }
      }
      await sql`insert into canvas_receipt(id,project_id,actor_id,input_hash,result,created_at) values(${operationId},${projectId},${actor},${hash},${sql.json(result as postgres.JSONValue)},${Date.now()})`;
      return result;
    },
    { readOnly }
  );
}
