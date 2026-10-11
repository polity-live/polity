import type { Sql } from 'postgres';
import { OWNER_ID, OUTSIDER_ID } from './catalog';
import type { CheckSecurity } from './security';

export const PROJECT_CHAT_SECURITY_COUNT = 42;
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Independent business expectations: public projects and old participants are not collaborators. */
export async function projectChatSecurityScenarios(sql: Sql, check: CheckSecurity) {
  for (const kind of ['studio', 'amendment'] as const) {
    const parent = id(kind === 'studio' ? 50 : 60);
    const conversation = id(kind === 'studio' ? 51 : 61);
    const run = id(kind === 'studio' ? 52 : 62);
    const change = id(kind === 'studio' ? 53 : 63);
    const collaborator = id(kind === 'studio' ? 54 : 64);
    const oldParticipant = id(kind === 'studio' ? 55 : 65);
    const scope = kind === 'studio' ? { kind, projectId: parent } : { kind, amendmentId: parent };
    const checkProjection = async (
      state: string,
      actor: 'owner' | 'outsider' | 'anonymous',
      allowed: boolean
    ) => {
      for (const [name, args, root] of [
        ['projectChat.conversations', scope, conversation],
        ['projectChat.runs', { conversationId: conversation }, run],
        ['projectChat.changes', { conversationId: conversation }, change],
      ] as const)
        await check(name, `project-chat-${kind}-${state}`, args, actor, allowed ? [root] : []);
    };
    try {
      if (kind === 'studio') {
        await sql`insert into public.studio_project (id,owner_id,title,kind,created_at,updated_at,visibility) values (${parent},${OUTSIDER_ID},'Chat security','single',1700000000000,1700000000000,'private')`;
      } else {
        await sql`insert into public.amendment (id,created_by_id,title,visibility) values (${parent},${OUTSIDER_ID},'Chat security','private')`;
      }
      await sql`insert into public.conversation (id,type,name,studio_project_id,amendment_id,requested_by_id) values (${conversation},'project_ai','Chat security',${kind === 'studio' ? parent : null},${kind === 'amendment' ? parent : null},${OWNER_ID})`;
      await sql`insert into public.conversation_participant (id,conversation_id,user_id,left_at) values (${oldParticipant},${conversation},${OWNER_ID},to_timestamp(1700000000))`;
      await sql`insert into public.ai_run (id,conversation_id,actor_id,request_id,request_hash,lease_token,lease_expires_at,created_at,updated_at,status) values (${run},${conversation},${OUTSIDER_ID},${id(kind === 'studio' ? 56 : 66)},'benchmark',${id(kind === 'studio' ? 57 : 67)},1700000000000,1700000000000,1700000000000,'completed')`;
      await sql`insert into public.ai_change_set (id,conversation_id,run_id,tool_call_id,actor_id,resource_kind,resource_id,summary,status,before_value,after_value,created_at) values (${change},${conversation},${run},'benchmark',${OUTSIDER_ID},${kind === 'studio' ? 'studio' : 'amendment_text'},${parent},'Chat security','proposed','{}','{}',1700000000000)`;
      await checkProjection('resource-owner', 'outsider', true);
      await checkProjection('old-participant', 'owner', false);
      await checkProjection('anonymous', 'anonymous', false);
      if (kind === 'studio') {
        await sql`insert into public.studio_project_collaborator (id,project_id,user_id,invited_by_id,status,created_at,updated_at) values (${collaborator},${parent},${OWNER_ID},${OUTSIDER_ID},'invited',1700000000000,1700000000000)`;
      } else {
        await sql`insert into public.amendment_collaborator (id,amendment_id,user_id,status) values (${collaborator},${parent},${OWNER_ID},'invited')`;
      }
      for (const status of ['invited', 'active', 'declined']) {
        if (kind === 'studio')
          await sql`update public.studio_project_collaborator set status=${status} where id=${collaborator}`;
        else
          await sql`update public.amendment_collaborator set status=${status} where id=${collaborator}`;
        await checkProjection(`collaborator-${status}`, 'owner', status === 'active');
      }
      if (kind === 'studio')
        await sql`update public.studio_project set visibility='public' where id=${parent}`;
      else await sql`update public.amendment set visibility='public' where id=${parent}`;
      // Parent visibility, creator/requester and stale conversation participation cannot restore access.
      await checkProjection('public-after-revocation', 'owner', false);
    } finally {
      await sql`delete from public.ai_change_set where id=${change}`;
      await sql`delete from public.ai_run where id=${run}`;
      await sql`delete from public.conversation where id=${conversation}`;
      if (kind === 'studio') await sql`delete from public.studio_project where id=${parent}`;
      else await sql`delete from public.amendment where id=${parent}`;
    }
  }
}
