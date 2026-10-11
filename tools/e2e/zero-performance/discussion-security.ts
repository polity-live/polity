import type { Sql } from 'postgres';
import { OWNER_ID, OUTSIDER_ID } from './catalog';
import type { CheckSecurity } from './security';

export const DISCUSSION_SECURITY_COUNT = 55;
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Reading a discussion never grants access to another person's private votes. */
export async function discussionSecurityScenarios(sql: Sql, check: CheckSecurity) {
  const amendment = id(80),
    thread = id(81),
    comment = id(82),
    ownThreadVote = id(83),
    otherThreadVote = id(84),
    ownCommentVote = id(85),
    otherCommentVote = id(86),
    role = id(87),
    collaborator = id(88),
    right = id(89);
  const projections = [
    { name: 'amendments.threads', args: { amendment_id: amendment }, rootID: thread, nested: true },
    {
      name: 'amendments.discussionThreadPage',
      args: { amendmentId: amendment, sort: 'votes', limit: 20, start: null, dir: 'forward' },
      rootID: thread,
    },
    { name: 'amendments.discussionThreadById', args: { id: thread }, rootID: thread },
    {
      name: 'amendments.discussionCommentPage',
      args: { threadId: thread, parentId: null, limit: 20, start: null, dir: 'forward' },
      rootID: comment,
    },
    { name: 'amendments.discussionCommentById', args: { id: comment }, rootID: comment },
  ];
  const checkProjection = async (
    state: string,
    actor: 'owner' | 'outsider' | 'anonymous',
    readable: boolean,
    votes: 'none' | 'own' | 'all'
  ) => {
    const expectedVotes = (own: string, other: string) =>
      votes === 'all' ? [own, other].sort() : votes === 'own' ? [own] : [];
    for (const projection of projections) {
      const isThread = projection.rootID === thread;
      await check(
        projection.name,
        `discussion-${state}`,
        projection.args,
        actor,
        readable ? [projection.rootID] : [],
        readable
          ? {
              rootID: projection.rootID,
              relations: {
                votes: isThread
                  ? expectedVotes(ownThreadVote, otherThreadVote)
                  : expectedVotes(ownCommentVote, otherCommentVote),
                ...(projection.nested
                  ? { 'comments.votes': expectedVotes(ownCommentVote, otherCommentVote) }
                  : {}),
              },
            }
          : undefined
      );
    }
  };
  try {
    await sql`insert into public.amendment (id,title,created_by_id,visibility) values (${amendment},'Discussion security',${OUTSIDER_ID},'private')`;
    await sql`insert into public.thread (id,amendment_id,user_id,content) values (${thread},${amendment},${OUTSIDER_ID},'Discussion security')`;
    await sql`insert into public.comment (id,thread_id,user_id,content) values (${comment},${thread},${OUTSIDER_ID},'Comment security')`;
    await sql`insert into public.thread_vote (id,thread_id,user_id,vote) values (${ownThreadVote},${thread},${OWNER_ID},1),(${otherThreadVote},${thread},${OUTSIDER_ID},-1)`;
    await sql`insert into public.comment_vote (id,comment_id,user_id,vote) values (${ownCommentVote},${comment},${OWNER_ID},1),(${otherCommentVote},${comment},${OUTSIDER_ID},-1)`;
    await checkProjection('private-reader', 'owner', false, 'none');
    await checkProjection('private-anonymous', 'anonymous', false, 'none');
    await checkProjection('private-creator', 'outsider', true, 'all');
    await sql`update public.amendment set visibility='public' where id=${amendment}`;
    await checkProjection('public-reader', 'owner', true, 'own');
    await checkProjection('public-anonymous', 'anonymous', true, 'none');
    await checkProjection('public-creator', 'outsider', true, 'all');
    await sql`insert into public.role (id,name,scope,amendment_id) values (${role},'Discussion manager','amendment',${amendment})`;
    await sql`insert into public.action_right (id,role_id,amendment_id,resource,action) values (${right},${role},${amendment},'amendments','view')`;
    await sql`insert into public.amendment_collaborator (id,amendment_id,user_id,role_id,status) values (${collaborator},${amendment},${OWNER_ID},${role},'active')`;
    await checkProjection('view-right', 'owner', true, 'own');
    await sql`update public.action_right set action='manage' where id=${right}`;
    await checkProjection('manage-right', 'owner', true, 'all');
    await sql`update public.amendment_collaborator set status='invited' where id=${collaborator}`;
    await checkProjection('invited-manager', 'owner', true, 'own');
    await sql`update public.amendment_collaborator set status='active' where id=${collaborator}`;
    await sql`delete from public.action_right where id=${right}`;
    await checkProjection('manage-right-revoked', 'owner', true, 'own');
    await sql`update public.amendment_collaborator set status='declined' where id=${collaborator}`;
    await checkProjection('collaboration-revoked', 'owner', true, 'own');
  } finally {
    await sql`delete from public.thread where id=${thread}`;
    await sql`delete from public.role where id=${role}`;
    await sql`delete from public.amendment where id=${amendment}`;
  }
}
