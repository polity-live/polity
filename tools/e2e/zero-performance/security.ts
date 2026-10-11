import type { Sql } from 'postgres';
import { OWNER_ID, OUTSIDER_ID } from './catalog';
import { projectChatSecurityScenarios, PROJECT_CHAT_SECURITY_COUNT } from './project-chat-security';
import { discussionSecurityScenarios, DISCUSSION_SECURITY_COUNT } from './discussion-security';

type Actor = 'owner' | 'outsider' | 'anonymous';
export const SECURITY_SCENARIO_COUNT =
  251 + PROJECT_CHAT_SECURITY_COUNT + DISCUSSION_SECURITY_COUNT;
export interface RelatedExpectation {
  rootID: string;
  relations: Record<string, string[]>;
}
export type CheckSecurity = (
  name: string,
  variant: string,
  args: unknown,
  actor: Actor,
  expectedIDs: string[],
  related?: RelatedExpectation
) => Promise<void>;
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Fixed policy expectations, independent of the query AST/SQL oracle. */
export async function securityScenarios(sql: Sql, check: CheckSecurity) {
  await discussionSecurityScenarios(sql, check);
  await projectChatSecurityScenarios(sql, check);
  const group = id(1),
    groupRole = id(2),
    membership = id(3),
    guest = id(4);
  const event = id(5),
    eventRole = id(6),
    participant = id(7);
  const amendment = id(8),
    amendmentRole = id(9),
    collaborator = id(10),
    tutorial = id(11);
  const publicGroup = id(12),
    connection = id(13),
    subscription = id(14);
  const electionEvent = id(31),
    agendaItem = id(32),
    election = id(33),
    elector = id(34),
    vote = id(35),
    voter = id(36),
    electionRole = id(37),
    roleHolder = id(38),
    privateAgendaItem = id(39);
  try {
    await sql`insert into public."group" (id,name,owner_id,visibility) values (${group},'Security benchmark',${OUTSIDER_ID},'private')`;
    await check('groups.byId', 'private-outsider', { id: group }, 'owner', []);
    await check('groups.byId', 'private-owner', { id: group }, 'outsider', [group]);
    await check('groups.byId', 'private-anonymous', { id: group }, 'anonymous', []);
    await sql`insert into public.role (id,name,scope,group_id) values (${groupRole},'Reader','group',${group})`;
    await sql`insert into public.action_right (id,role_id,group_id,resource,action) values (${id(20)},${groupRole},${group},'groups','view')`;
    await sql`insert into public.group_membership (id,group_id,user_id,status) values (${membership},${group},${OWNER_ID},'active')`;
    await sql`insert into public.group_membership_role (id,group_membership_id,role_id) values (${id(21)},${membership},${groupRole})`;
    for (const status of ['active', 'invited', 'inactive']) {
      await sql`update public.group_membership set status=${status} where id=${membership}`;
      await check(
        'groups.byId',
        `membership-${status}`,
        { id: group },
        'owner',
        status === 'inactive' ? [] : [group]
      );
    }
    await sql`insert into public.group_guest_access (id,group_id,user_id,status) values (${guest},${group},${OWNER_ID},'active')`;
    await sql`insert into public.group_guest_role (id,group_guest_access_id,role_id) values (${id(22)},${guest},${groupRole})`;
    for (const status of ['active', 'invited', 'revoked']) {
      await sql`update public.group_guest_access set status=${status} where id=${guest}`;
      await check(
        'groups.byId',
        `guest-${status}`,
        { id: group },
        'owner',
        status === 'revoked' ? [] : [group]
      );
    }
    await sql`update public.group_membership set status='active' where id=${membership}`;
    await sql`delete from public.action_right where id=${id(20)}`;
    await check('groups.byId', 'right-revoked', { id: group }, 'owner', []);
    for (const visibility of ['public', 'authenticated', 'private']) {
      await sql`update public."group" set visibility=${visibility} where id=${group}`;
      await check(
        'groups.byId',
        `visibility-${visibility}-anonymous`,
        { id: group },
        'anonymous',
        visibility === 'public' ? [group] : []
      );
      await check(
        'groups.byId',
        `visibility-${visibility}-authenticated`,
        { id: group },
        'owner',
        visibility === 'private' ? [] : [group]
      );
    }
    await sql`insert into public.event (id,title,creator_id,visibility) values (${event},'Security event',${OUTSIDER_ID},'private')`;
    await sql`insert into public.role (id,name,scope,event_id) values (${eventRole},'Reader','event',${event})`;
    await sql`insert into public.action_right (id,role_id,event_id,resource,action) values (${id(23)},${eventRole},${event},'events','view')`;
    await sql`insert into public.event_participant (id,event_id,user_id,status) values (${participant},${event},${OWNER_ID},'active')`;
    await sql`insert into public.event_participant_role (id,event_participant_id,role_id) values (${id(24)},${participant},${eventRole})`;
    await sql`insert into public.agenda_item (id,event_id,creator_id,title,type) values (${privateAgendaItem},${event},${OUTSIDER_ID},'Private event agenda','discussion')`;
    for (const status of ['active', 'invited', 'declined']) {
      await sql`update public.event_participant set status=${status} where id=${participant}`;
      await check(
        'events.byId',
        `participant-${status}`,
        { id: event },
        'owner',
        status === 'declined' ? [] : [event]
      );
      const allowed = status !== 'declined';
      await check(
        'events.forAgenda',
        `agenda-participant-${status}`,
        { id: event },
        'owner',
        allowed ? [event] : []
      );
      await check(
        'events.byIdFull',
        `agenda-participant-${status}`,
        { id: event },
        'owner',
        allowed ? [event] : [],
        allowed ? { rootID: event, relations: { agenda_items: [privateAgendaItem] } } : undefined
      );
    }
    await check('events.byId', 'anonymous-private-event', { id: event }, 'anonymous', []);
    await check('events.byIdFull', 'agenda-private-anonymous', { id: event }, 'anonymous', []);
    await check('events.forAgenda', 'agenda-private-anonymous', { id: event }, 'anonymous', []);
    await check('events.forAgenda', 'agenda-private-creator', { id: event }, 'outsider', [event]);
    await check('events.byIdFull', 'agenda-private-creator', { id: event }, 'outsider', [event], {
      rootID: event,
      relations: { agenda_items: [privateAgendaItem] },
    });
    await sql`update public.event set visibility='public',group_id=${group} where id=${event}`;
    for (const name of ['events.byIdFull', 'events.forParticipation', 'events.forAgenda']) {
      for (const actor of ['owner', 'anonymous', 'outsider'] as const) {
        await check(name, `private-event-group-${actor}`, { id: event }, actor, [event], {
          rootID: event,
          relations: {
            group: actor === 'outsider' ? [group] : [],
            ...(name === 'events.byIdFull' ? { agenda_items: [privateAgendaItem] } : {}),
          },
        });
      }
    }
    // A readable agenda does not grant an election's independent private visibility.
    // This event has no group, roles, or participants that could grant another path.
    await sql`insert into public.event (id,title,creator_id,visibility) values (${electionEvent},'Election visibility benchmark',${OUTSIDER_ID},'public')`;
    await sql`insert into public.agenda_item (id,event_id,creator_id,title,type) values (${agendaItem},${electionEvent},${OUTSIDER_ID},'Election item','election')`;
    await sql`insert into public.election (id,agenda_item_id,title,visibility) values (${election},${agendaItem},'Private election','private')`;
    const eventElectionProjections = [
      {
        name: 'events.byIdFull',
        args: { id: electionEvent },
        rootID: electionEvent,
        path: 'agenda_items.election',
      },
      {
        name: 'events.forCancel',
        args: { id: electionEvent },
        rootID: electionEvent,
        path: 'agenda_items.election',
      },
      {
        name: 'events.streamEvent',
        args: { id: electionEvent },
        rootID: electionEvent,
        path: 'agenda_items.election',
      },
      ...['events.agendaWithElections', 'events.agendaItemsFull', 'events.wikiAgendaItems'].map(
        name => ({ name, args: { eventId: electionEvent }, rootID: agendaItem, path: 'election' })
      ),
      {
        name: 'events.agendaItemDetail',
        args: { id: agendaItem },
        rootID: agendaItem,
        path: 'election',
      },
    ];
    const checkEventElections = async (actor: Actor, expected: string[], suffix: string) => {
      for (const projection of eventElectionProjections)
        await check(
          projection.name,
          `election-${suffix}-${actor}`,
          projection.args,
          actor,
          [projection.rootID],
          {
            rootID: projection.rootID,
            relations: { [projection.path]: expected },
          }
        );
    };
    const checkNestedElection = async (actor: Actor, expected: string[], suffix: string) => {
      for (const name of ['agendas.byEventIds', 'agendas.timelineByEventIds']) {
        await check(
          name,
          `election-${suffix}-${actor}`,
          { event_ids: [electionEvent] },
          actor,
          [agendaItem],
          {
            rootID: agendaItem,
            relations: { election: expected },
          }
        );
      }
      await check(
        'search.searchableEvents',
        `election-${suffix}-${actor}`,
        { query: 'Election visibility', limit: 20 },
        actor,
        [electionEvent],
        {
          rootID: electionEvent,
          relations: { 'agenda_items.election': expected },
        }
      );
      await checkEventElections(actor, expected, suffix);
    };
    for (const actor of ['owner', 'outsider', 'anonymous'] as const)
      await checkNestedElection(actor, actor === 'outsider' ? [election] : [], 'private');
    for (const actor of ['owner', 'outsider'] as const)
      await check(
        'elections.byAgendaItem',
        `private-election-${actor}`,
        { agenda_item_id: agendaItem },
        actor,
        actor === 'outsider' ? [election] : []
      );
    await sql`insert into public.elector (id,election_id,user_id) values (${elector},${election},${OWNER_ID})`;
    await checkEventElections('owner', [election], 'elector');
    await check(
      'elections.byAgendaItem',
      'private-election-elector',
      { agenda_item_id: agendaItem },
      'owner',
      [election]
    );
    await check(
      'agendas.byEventIds',
      'private-election-elector',
      { event_ids: [electionEvent] },
      'owner',
      [agendaItem],
      { rootID: agendaItem, relations: { election: [election] } }
    );
    // Reading a public election independently grants no access to a private role.
    await sql`insert into public.role (id,name,scope,event_id,visibility) values (${electionRole},'Private elected role','event',${electionEvent},'private')`;
    await sql`update public.election set role_id=${electionRole},visibility='public',status='pending' where id=${election}`;
    const roleProjections = [
      ...eventElectionProjections.filter(projection => projection.name !== 'events.byIdFull'),
      ...[
        { name: 'elections.byAgendaItem', args: { agenda_item_id: agendaItem } },
        { name: 'elections.byId', args: { id: election } },
        { name: 'events.electionWithVotes', args: { id: election } },
        { name: 'elections.decisionOverviewPage', args: { query: 'Private election', limit: 20 } },
        { name: 'elections.decisionPage', args: { query: 'Private election', limit: 20 } },
        { name: 'elections.electionsWithDetails', args: {} },
        { name: 'elections.electionsForSearch', args: {} },
        { name: 'elections.pendingElections', args: {} },
      ].map(projection => ({ ...projection, rootID: election, path: '' })),
    ];
    const checkElectionRole = async (actor: Actor, expectedRoles: string[], state: string) => {
      for (const projection of roleProjections)
        await check(
          projection.name,
          `election-role-${state}-${actor}`,
          projection.args,
          actor,
          [projection.rootID],
          {
            rootID: projection.rootID,
            relations: {
              ...(projection.path ? { [projection.path]: [election] } : {}),
              [projection.path ? `${projection.path}.role` : 'role']: expectedRoles,
            },
          }
        );
    };
    for (const actor of ['owner', 'outsider', 'anonymous'] as const)
      await checkElectionRole(actor, [], 'private');
    await sql`insert into public.role_holder_history (id,role_id,user_id,start_date) values (${roleHolder},${electionRole},${OWNER_ID},now())`;
    await checkElectionRole('owner', [electionRole], 'holder');
    await sql`update public.role_holder_history set end_date=now() where id=${roleHolder}`;
    await checkElectionRole('owner', [], 'revoked');
    await sql`update public.role set visibility='public' where id=${electionRole}`;
    await checkElectionRole('anonymous', [electionRole], 'public');
    await sql`update public.election set visibility='private' where id=${election}`;
    await sql`delete from public.elector where id=${elector}`;
    await checkEventElections('owner', [], 'elector-revoked');
    await check(
      'elections.byAgendaItem',
      'private-election-elector-revoked',
      { agenda_item_id: agendaItem },
      'owner',
      []
    );
    await check(
      'agendas.byEventIds',
      'private-election-elector-revoked',
      { event_ids: [electionEvent] },
      'owner',
      [agendaItem],
      { rootID: agendaItem, relations: { election: [] } }
    );
    await sql`update public.election set visibility='public' where id=${election}`;
    await checkEventElections('anonymous', [election], 'public');
    // Independently private votes must also stay absent from a readable event.
    await sql`insert into public.vote (id,agenda_item_id,title,visibility,purpose) values (${vote},${agendaItem},'Private vote','private','closing')`;
    const voteProjections = [
      ...['events.byIdFull', 'events.withVoting', 'events.streamEvent'].map(name => ({
        name,
        args: { id: electionEvent },
        rootID: electionEvent,
        path: 'agenda_items.votes',
      })),
      {
        name: 'events.agendaItemsFull',
        args: { eventId: electionEvent },
        rootID: agendaItem,
        path: 'votes',
      },
      {
        name: 'events.agendaItemDetail',
        args: { id: agendaItem },
        rootID: agendaItem,
        path: 'votes',
      },
    ];
    const checkNestedVote = async (actor: Actor, expected: string[], suffix: string) => {
      for (const projection of voteProjections)
        await check(
          projection.name,
          `vote-${suffix}-${actor}`,
          projection.args,
          actor,
          [projection.rootID],
          {
            rootID: projection.rootID,
            relations: { [projection.path]: expected },
          }
        );
    };
    for (const actor of ['owner', 'outsider', 'anonymous'] as const)
      await checkNestedVote(actor, actor === 'outsider' ? [vote] : [], 'private');
    await sql`insert into public.voter (id,vote_id,user_id) values (${voter},${vote},${OWNER_ID})`;
    await checkNestedVote('owner', [vote], 'voter');
    await sql`delete from public.voter where id=${voter}`;
    await checkNestedVote('owner', [], 'voter-revoked');
    await sql`update public.vote set visibility='public' where id=${vote}`;
    await checkNestedVote('anonymous', [vote], 'public');
    await check(
      'elections.byAgendaItem',
      'public-election-anonymous',
      { agenda_item_id: agendaItem },
      'anonymous',
      [election]
    );
    await check(
      'agendas.byEventIds',
      'public-election-anonymous',
      { event_ids: [electionEvent] },
      'anonymous',
      [agendaItem],
      { rootID: agendaItem, relations: { election: [election] } }
    );
    await sql`insert into public.amendment (id,title,created_by_id,visibility) values (${amendment},'Security amendment',${OUTSIDER_ID},'private')`;
    await sql`insert into public.role (id,name,scope,amendment_id) values (${amendmentRole},'Reader','amendment',${amendment})`;
    await sql`insert into public.action_right (id,role_id,amendment_id,resource,action) values (${id(25)},${amendmentRole},${amendment},'amendments','view')`;
    await sql`insert into public.amendment_collaborator (id,amendment_id,user_id,role_id,status) values (${collaborator},${amendment},${OWNER_ID},${amendmentRole},'active')`;
    for (const status of ['active', 'invited', 'declined']) {
      await sql`update public.amendment_collaborator set status=${status} where id=${collaborator}`;
      await check(
        'amendments.byId',
        `collaborator-${status}`,
        { id: amendment },
        'owner',
        status === 'declined' ? [] : [amendment]
      );
    }
    await check(
      'amendments.byId',
      'anonymous-private-amendment',
      { id: amendment },
      'anonymous',
      []
    );
    // A visible connection must not hydrate the private endpoint without its own view right.
    await sql`insert into public."group" (id,name,owner_id,visibility) values (${publicGroup},'Public endpoint',${OUTSIDER_ID},'public')`;
    await sql`insert into public.group_connection (id,group_a_id,group_b_id,connection_type,status) values (${connection},${group},${publicGroup},'peer','active')`;
    for (const actor of ['owner', 'anonymous'] as const) {
      await check(
        'network.wikiNetwork',
        `private-related-group-${actor}`,
        { groupId: publicGroup },
        actor,
        [connection],
        { rootID: connection, relations: { group_a: [], group_b: [publicGroup] } }
      );
    }
    await check(
      'network.wikiNetwork',
      'authorized-related-private-group',
      { groupId: publicGroup },
      'outsider',
      [connection],
      { rootID: connection, relations: { group_a: [group], group_b: [publicGroup] } }
    );
    for (const actor of ['owner', 'anonymous', 'outsider'] as const) {
      await check(
        'groups.byIdForNetwork',
        `nested-network-${actor}`,
        { id: publicGroup },
        actor,
        [publicGroup],
        {
          rootID: publicGroup,
          relations: { 'connections_as_group_b.group_a': actor === 'outsider' ? [group] : [] },
        }
      );
    }
    await sql`insert into public.subscriber (id,subscriber_id,group_id) values (${subscription},${OWNER_ID},${group})`;
    await check(
      'common.subscriptionById',
      'revoked-related-subscription',
      { id: subscription },
      'owner',
      [subscription],
      { rootID: subscription, relations: { group: [] } }
    );
    await sql`insert into public.action_right (id,role_id,group_id,resource,action) values (${id(20)},${groupRole},${group},'groups','view')`;
    await check(
      'common.subscriptionById',
      'authorized-related-subscription',
      { id: subscription },
      'owner',
      [subscription],
      { rootID: subscription, relations: { group: [group] } }
    );
    await sql`delete from public.action_right where id=${id(20)}`;
    await sql`delete from public.subscriber where id=${subscription}`;
    await sql`delete from public.group_connection where id=${connection}`;
    await sql`delete from public."group" where id=${publicGroup}`;
    await sql`insert into public.app_tutorial_run (id,user_id,status,current_checkpoint_id,fixture_version) values (${tutorial},${OWNER_ID},'active','benchmark',1)`;
    await sql`update public."group" set visibility='public',tutorial_run_id=${tutorial} where id=${group}`;
    await sql`update public.event set tutorial_run_id=${tutorial} where id=${event}`;
    for (const status of ['active', 'paused', 'archived']) {
      await sql`update public.app_tutorial_run set status=${status} where id=${tutorial}`;
      await check(
        'groups.byId',
        `tutorial-${status}-owner`,
        { id: group },
        'owner',
        status === 'archived' ? [] : [group]
      );
      await check('groups.byId', `tutorial-${status}-other`, { id: group }, 'outsider', []);
      await check('groups.byId', `tutorial-${status}-anonymous`, { id: group }, 'anonymous', []);
      for (const actor of ['owner', 'outsider', 'anonymous'] as const) {
        const allowed = actor === 'owner' && status !== 'archived';
        await check(
          'events.forAgenda',
          `agenda-tutorial-${status}-${actor}`,
          { id: event },
          actor,
          allowed ? [event] : []
        );
        await check(
          'events.byIdFull',
          `agenda-tutorial-${status}-${actor}`,
          { id: event },
          actor,
          allowed ? [event] : [],
          allowed ? { rootID: event, relations: { agenda_items: [privateAgendaItem] } } : undefined
        );
      }
    }
  } finally {
    await sql`delete from public.role_holder_history where id=${roleHolder}`;
    await sql`delete from public.vote where id=${vote}`;
    await sql`delete from public.election where id=${election}`;
    await sql`delete from public.role where id=${electionRole}`;
    await sql`delete from public.agenda_item where id=${agendaItem}`;
    await sql`delete from public.agenda_item where id=${privateAgendaItem}`;
    await sql`delete from public.event where id=${electionEvent}`;
    // Event/amendment roles do not cascade when their scoped resource is deleted.
    // Preflight and live measurement use the same IDs on this isolated stack.
    await sql`delete from public.role where id in ${sql([groupRole, eventRole, amendmentRole])}`;
    await sql`delete from public.subscriber where id=${subscription}`;
    await sql`delete from public.group_connection where id=${connection}`;
    await sql`delete from public."group" where id=${publicGroup}`;
    await sql`delete from public."group" where id=${group}`;
    await sql`delete from public.event where id=${event}`;
    await sql`delete from public.amendment where id=${amendment}`;
    await sql`delete from public.app_tutorial_run where id=${tutorial}`;
  }
}

export interface SecurityCaseExpectation {
  key: string;
  expectedIDs: string[];
  related?: RelatedExpectation;
}

/** Enumerate the exact business expectations without touching a database. */
export async function securityCaseManifest(): Promise<SecurityCaseExpectation[]> {
  const cases: SecurityCaseExpectation[] = [];
  const sql = (async () => []) as unknown as Sql;
  await securityScenarios(sql, async (name, variant, _args, actor, expectedIDs, related) => {
    cases.push({
      key: `${name}/security-${variant}/security/${actor}`,
      expectedIDs,
      ...(related ? { related } : {}),
    });
  });
  if (
    cases.length !== SECURITY_SCENARIO_COUNT ||
    new Set(cases.map(item => item.key)).size !== cases.length
  )
    throw new Error('Invalid fixed security case manifest');
  return cases;
}
