import { afterCommit } from '../after-commit';

import { z } from 'zod';
import { studioTransaction, StudioError, assertStudioCollaborationAccess } from './db';
import { aiAttachmentEntitySchema } from '@/lib/ai/schemas';
import { assertProjectAiSourceSharing, assertStudioProposalSourceAudience } from './ai-sources';
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
    'setCapability',
    'adopt',
    'acceptPrivate',
    'rejectPrivate',
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
  if (proposal.origin === 'ai')
    await assertStudioProposalSourceAudience(
      null,
      proposal.project_id,
      z
        .array(z.object({ type: aiAttachmentEntitySchema, id: z.string().uuid() }))
        .parse(proposal.ai_sources),
      sql
    );
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
  if (proposal.origin === 'ai') {
    const [project] =
      await sql`select source_references from studio_project where id=${proposal.project_id}`;
    const refs = [
      ...new Map(
        [...project.source_references, ...proposal.ai_sources].map(
          (ref: { type: string; id: string }) => [`${ref.type}:${ref.id}`, ref] as const
        )
      ).values(),
    ];
    await sql`update studio_project set source_references=${sql.json(refs)} where id=${proposal.project_id}`;
  }
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

async function procedureMembers(sql: Sql, project: postgres.Row) {
  return sql`select u.id,u.first_name,u.last_name from "user" u where u.id in (
    select owner_id from "group" where id=${project.group_id}
    union select user_id from group_membership where group_id=${project.group_id}
      and status in ('active','member','admin')
    union select owner_id from studio_project where id=${project.id} and group_id is null
    union select user_id from studio_project_collaborator where project_id=${project.id}
      and ${project.group_id}::uuid is null and status='active'
  ) order by u.id`;
}

async function eligibleVoters(sql: Sql, project: postgres.Row) {
  const members = await procedureMembers(sql, project);
  if (!members.length) return [];
  return sql`select id from "user" where id in ${sql(members.map(member => member.id))}
    and canvas_capability(id,${project.id}::uuid,'vote') order by id`;
}

export async function canvasCommand(actor: string, raw: unknown): Promise<any> {
  const input = inputSchema.parse(raw);
  const response = await studioTransaction(async sql => {
    const { projectId, action, workspaceId } = input;
    await assertStudioCollaborationAccess(actor, projectId, sql);
    const [project] =
      await sql`select *,studio_access(${actor}::uuid,id,true) as can_edit,canvas_manage(${actor}::uuid,id) as can_manage from studio_project where id=${projectId} and document_schema_version=5 for update`;
    const [control] =
      await sql`select * from canvas_control where project_id=${projectId} for update`;
    const [canonical] =
      await sql`select * from studio_state where project_id=${projectId} for update`;
    if (!project || !control || !canonical)
      throw new StudioError('Studio V5 project not found', 404);
    let proposal: postgres.Row | undefined;
    if (workspaceId) {
      [proposal] =
        await sql`select *,canvas_proposal_access(${actor}::uuid,id) as can_read from canvas_proposal where id=${workspaceId} and project_id=${projectId} for update`;
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
      case 'acceptPrivate':
      case 'rejectPrivate': {
        if (
          project.group_id ||
          control.phase !== 'edit' ||
          !capabilities.manage ||
          !proposal ||
          proposal.origin !== 'ai' ||
          proposal.ai_status !== 'ready' ||
          proposal.state !== 'draft' ||
          input.revision !== proposal.revision
        )
          denied();
        const decision = action === 'acceptPrivate' ? 'accepted' : 'rejected';
        const changes =
          decision === 'accepted' ? diffStudio(proposal.base_document, proposal.document) : [];
        if (decision === 'accepted' && !changes.length)
          throw new StudioError('AI suggestion has no changes');
        if (decision === 'accepted')
          await validateAssets(sql, projectId, proposal.document, proposal.id);
        const digest =
          decision === 'accepted'
            ? checksum({
                base: proposal.base_revision,
                generation: proposal.base_generation,
                changes,
              })
            : null;
        await sql`update canvas_proposal set state='closed',decision=${decision},
            changes=${sql.json(changes)},checksum=${digest},
            application=${decision === 'accepted' ? 'pending' : 'not_applicable'},
            updated_at=${Date.now()} where id=${proposal.id}`;
        if (decision === 'accepted')
          await applyDecision(sql, { ...proposal, changes, checksum: digest, decision }, control);
        result = { decision };
        break;
      }
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
        const audience = await sql`select owner_id as id from "group" where id=${target}
            union select user_id as id from group_membership
            where group_id=${target} and status in ('active','member','admin')`;
        await assertProjectAiSourceSharing(
          projectId,
          audience.map(person => person.id),
          'private',
          sql
        );
        await sql`update studio_project set group_id=${target},updated_at=${Date.now()} where id=${projectId}`;
        await sql`update canvas_control set generation=gen_random_uuid() where project_id=${projectId}`;
        await sql`update studio_state set content_revision=content_revision+1,updated_at=${Date.now()} where project_id=${projectId}`;
        result = { groupId: target };
        break;
      }
      case 'phase': {
        if (!capabilities.manage) denied();
        if (input.phase === 'view') denied();
        if (input.revision !== canonical.content_revision)
          throw new StudioError('Canvas revision changed', 409);
        const [pending] =
          await sql`select id from canvas_proposal where project_id=${projectId} and (state='voting' or application='conflict') limit 1`;
        if (pending)
          throw new StudioError('Resolve active ballots and application conflicts first', 409);
        if (input.phase === 'vote_internal' && control.phase !== 'vote_internal') {
          const submitted =
            await sql`select * from canvas_proposal where project_id=${projectId} and state='submitted' for update`;
          const electorate = await eligibleVoters(sql, project);
          if (submitted.length && !electorate.length) throw new StudioError('No eligible voters');
          for (const submittedProposal of submitted) {
            assertBallotIntegrity(submittedProposal);
            await sql`update canvas_proposal set state='voting',electorate=${electorate.map(v => v.id)},deadline=null,updated_at=${Date.now()} where id=${submittedProposal.id}`;
          }
        }
        await sql`update canvas_control set phase=${requireValue(input.phase)} where project_id=${projectId}`;
        break;
      }
      case 'resolveDraft':
      case 'createDraft': {
        const resolving =
          action === 'resolveDraft' &&
          proposal?.decision === 'accepted' &&
          proposal.application === 'conflict';
        if (action === 'createDraft' && project.group_id && control.phase !== 'suggest_internal')
          denied();
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
        for (const id of input.userIds ?? [])
          await assertStudioCollaborationAccess(id, projectId, sql);
        if (p.origin === 'ai')
          await assertStudioProposalSourceAudience(
            actor,
            projectId,
            z
              .array(z.object({ type: aiAttachmentEntitySchema, id: z.string().uuid() }))
              .parse(p.ai_sources),
            sql
          );
        await sql`update canvas_proposal set shared_ids=${input.userIds ?? []},updated_at=${Date.now()} where id=${p.id}`;
        break;
      }
      case 'submit': {
        const p = ownDraft();
        if (p.owner_id !== actor) denied();
        if (p.origin === 'ai' && project.group_id && control.phase !== 'suggest_internal') denied();
        const changes = diffStudio(p.base_document, p.document);
        if (!changes.length) throw new StudioError('Proposal has no changes');
        await validateAssets(sql, projectId, p.document, p.id);
        const openResolutionBallot = control.phase === 'vote_internal' && !!p.resolves_id;
        const electorate = openResolutionBallot ? await eligibleVoters(sql, project) : [];
        if (openResolutionBallot && !electorate.length) throw new StudioError('No eligible voters');
        await sql`update canvas_proposal set state=${openResolutionBallot ? 'voting' : 'submitted'},changes=${sql.json(changes)},checksum=${checksum({ base: p.base_revision, generation: p.base_generation, changes })},electorate=${openResolutionBallot ? electorate.map(v => v.id) : null},deadline=null,updated_at=${Date.now()} where id=${p.id}`;
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
        if (!capabilities.manage) denied();
        // Older Studio clients may repeat the action after the phase has opened its ballots.
        if (proposal?.state === 'voting') break;
        if (
          !capabilities.manage ||
          control.phase !== 'vote_internal' ||
          proposal?.state !== 'submitted'
        )
          denied();
        assertBallotIntegrity(proposal);
        const electorate = await eligibleVoters(sql, project);
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
        if (proposal.deadline != null && Date.now() >= Number(proposal.deadline)) {
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
          (!capabilities.manage &&
            (proposal.deadline == null || Date.now() < Number(proposal.deadline)))
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
  });
  if (
    input.workspaceId &&
    ['withdraw', 'rejectPrivate', 'acceptPrivate', 'vote', 'finalize', 'reapply'].includes(
      input.action
    )
  ) {
    const workspaceId = input.workspaceId;
    await afterCommit(requireValue(input.operationId), async () => {
      const { cleanupStudioProposalAssets } = await import('./ai-suggestions');
      await cleanupStudioProposalAssets(workspaceId).catch(() =>
        console.error('studio.post_commit_failed', { operationId: input.operationId })
      );
    });
  }
  return response;
}
