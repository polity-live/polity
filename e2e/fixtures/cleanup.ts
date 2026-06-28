import { closeDb, db, runCleanupStep } from './db';

interface CleanupOptions {
  prefix?: string;
  includeWorkerUsers?: boolean;
  closeConnection?: boolean;
}

function patternFor(prefix?: string) {
  return prefix ? `${prefix}%` : 'E2E-%';
}

export async function cleanupE2ERows(options: CleanupOptions = {}) {
  const sql = db();
  const pattern = patternFor(options.prefix);
  const includeWorkerUsers = options.includeWorkerUsers ?? false;

  await runCleanupStep(
    'notifications',
    () => sql`
    delete from public.notification_read
    where read_by_user_id in (select id from public."user" where bio like ${pattern});

    delete from public.notification
    where title like ${pattern}
       or message like ${pattern}
       or action_url like ${pattern}
       or recipient_id in (select id from public."user" where bio like ${pattern})
       or sender_id in (select id from public."user" where bio like ${pattern});
  `
  );

  await runCleanupStep(
    'payments',
    () => sql`
    delete from public.payment
    where label like ${pattern}
       or payer_user_id in (select id from public."user" where bio like ${pattern})
       or receiver_user_id in (select id from public."user" where bio like ${pattern})
       or payer_group_id in (select id from public."group" where name like ${pattern})
       or receiver_group_id in (select id from public."group" where name like ${pattern});
  `
  );

  await runCleanupStep(
    'elections and votes',
    () => sql`
    delete from public.final_candidate_selection
    where election_id in (select id from public.election where title like ${pattern})
       or candidate_id in (
         select c.id
         from public.election_candidate c
         left join public.election e on e.id = c.election_id
         where c.name like ${pattern}
            or c.description like ${pattern}
            or c.image_url like ${pattern}
            or e.title like ${pattern}
       );

    delete from public.indicative_candidate_selection
    where election_id in (select id from public.election where title like ${pattern})
       or candidate_id in (
         select c.id
         from public.election_candidate c
         left join public.election e on e.id = c.election_id
         where c.name like ${pattern}
            or c.description like ${pattern}
            or c.image_url like ${pattern}
            or e.title like ${pattern}
       );

    delete from public.final_elector_participation
    where election_id in (select id from public.election where title like ${pattern});

    delete from public.indicative_elector_participation
    where election_id in (select id from public.election where title like ${pattern});

    delete from public.elector
    where election_id in (select id from public.election where title like ${pattern});

    delete from public.election_offline_tally
    where election_id in (select id from public.election where title like ${pattern});

    delete from public.election_candidate
    where name like ${pattern}
       or description like ${pattern}
       or image_url like ${pattern}
       or election_id in (select id from public.election where title like ${pattern});

    delete from public.election
    where title like ${pattern}
       or description like ${pattern}
       or agenda_item_id in (select id from public.agenda_item where title like ${pattern});
  `
  );

  await runCleanupStep(
    'agenda items',
    () => sql`
    delete from public.speaker_list
    where agenda_item_id in (select id from public.agenda_item where title like ${pattern});

    delete from public.agenda_item_change_request
    where agenda_item_id in (select id from public.agenda_item where title like ${pattern});

    delete from public.agenda_item
    where title like ${pattern}
       or description like ${pattern}
       or event_id in (select id from public.event where title like ${pattern})
       or amendment_id in (select id from public.amendment where title like ${pattern});
  `
  );

  await runCleanupStep(
    'documents and amendments',
    () => sql`
    update public.amendment
    set document_id = null
    where title like ${pattern};

    delete from public.document_cursor
    where document_id in (
      select id from public.document
      where content::text like ${pattern}
         or amendment_id in (select id from public.amendment where title like ${pattern})
    );

    delete from public.document_collaborator
    where document_id in (
      select id from public.document
      where content::text like ${pattern}
         or amendment_id in (select id from public.amendment where title like ${pattern})
    );

    delete from public.document_version
    where change_summary like ${pattern}
       or content::text like ${pattern}
       or amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.document
    where content::text like ${pattern}
       or amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.support_confirmation
    where amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.process_task
    where title like ${pattern}
       or description like ${pattern}
       or process_run_id in (
         select id from public.amendment_process_run
         where amendment_id in (select id from public.amendment where title like ${pattern})
       );

    delete from public.amendment_process_step_run
    where process_run_id in (
      select id from public.amendment_process_run
      where amendment_id in (select id from public.amendment where title like ${pattern})
    );

    delete from public.amendment_path_segment
    where path_id in (
      select id from public.amendment_path
      where amendment_id in (select id from public.amendment where title like ${pattern})
    );

    delete from public.amendment_path
    where title like ${pattern}
       or amendment_id in (select id from public.amendment where title like ${pattern});

    update public.amendment_process_run
    set active_branch_id = null, terminal_step_run_id = null
    where amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.amendment_process_branch
    where title like ${pattern}
       or process_run_id in (
         select id from public.amendment_process_run
         where amendment_id in (select id from public.amendment where title like ${pattern})
       );

    delete from public.amendment_process_run
    where amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.amendment_group_decision
    where amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.amendment_street_design
    where title like ${pattern}
       or amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.amendment_collaborator
    where amendment_id in (select id from public.amendment where title like ${pattern});

    delete from public.amendment
    where title like ${pattern}
       or reason like ${pattern}
       or image_url like ${pattern};
  `
  );

  await runCleanupStep(
    'events',
    () => sql`
    delete from public.event_participant_role
    where event_participant_id in (
      select id from public.event_participant
      where event_id in (select id from public.event where title like ${pattern})
    );

    delete from public.event_participant
    where event_id in (select id from public.event where title like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.event_offline_participant
    where event_id in (select id from public.event where title like ${pattern})
       or first_name like ${pattern}
       or last_name like ${pattern};

    delete from public.event_assembly_scope
    where event_id in (select id from public.event where title like ${pattern});

    delete from public.event_exception
    where parent_event_id in (select id from public.event where title like ${pattern})
       or new_title like ${pattern};

    delete from public.participant
    where event_id in (select id from public.event where title like ${pattern})
       or name like ${pattern}
       or email like ${pattern};

    delete from public.event
    where title like ${pattern}
       or image_url like ${pattern}
       or group_id in (select id from public."group" where name like ${pattern});
  `
  );

  await runCleanupStep(
    'todos',
    () => sql`
    delete from public.todo_assignment
    where todo_id in (select id from public.todo where title like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.todo
    where title like ${pattern}
       or description like ${pattern};
  `
  );

  await runCleanupStep(
    'statements and surveys',
    () => sql`
    delete from public.statement_survey_vote
    where option_id in (
      select o.id
      from public.statement_survey_option o
      join public.statement_survey s on s.id = o.survey_id
      join public.statement st on st.id = s.statement_id
      where st.title like ${pattern} or st.text like ${pattern}
    );

    delete from public.statement_survey_option
    where label like ${pattern}
       or survey_id in (
         select s.id
         from public.statement_survey s
         join public.statement st on st.id = s.statement_id
         where st.title like ${pattern} or st.text like ${pattern}
       );

    delete from public.statement_survey
    where question like ${pattern}
       or statement_id in (
         select id from public.statement
         where title like ${pattern} or text like ${pattern} or image_url like ${pattern} or video_url like ${pattern}
       );

    delete from public.statement_support_vote
    where statement_id in (
      select id from public.statement
      where title like ${pattern} or text like ${pattern} or image_url like ${pattern} or video_url like ${pattern}
    );

    delete from public.statement
    where title like ${pattern}
       or text like ${pattern}
       or image_url like ${pattern}
       or video_url like ${pattern};
  `
  );

  await runCleanupStep(
    'blogs',
    () => sql`
    delete from public.blog_support_vote
    where blog_id in (select id from public.blog where title like ${pattern} or image_url like ${pattern});

    delete from public.blog_blogger
    where blog_id in (select id from public.blog where title like ${pattern} or image_url like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.blog
    where title like ${pattern}
       or description like ${pattern}
       or image_url like ${pattern};
  `
  );

  await runCleanupStep(
    'timeline and search rows',
    () => sql`
    delete from public.reaction
    where user_id in (select id from public."user" where bio like ${pattern})
       or timeline_event_id in (select id from public.timeline_event where title like ${pattern});

    delete from public.timeline_event
    where title like ${pattern}
       or description like ${pattern}
       or image_url like ${pattern}
       or video_url like ${pattern}
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.search_document_acl
    where document_id in (
      select id from public.search_document
      where title like ${pattern}
         or subtitle like ${pattern}
         or summary like ${pattern}
         or search_text like ${pattern}
    );

    delete from public.search_document_topic
    where document_id in (
      select id from public.search_document
      where title like ${pattern}
         or subtitle like ${pattern}
         or summary like ${pattern}
         or search_text like ${pattern}
    );

    delete from public.search_document
    where title like ${pattern}
       or subtitle like ${pattern}
       or summary like ${pattern}
       or search_text like ${pattern};
  `
  );

  await runCleanupStep(
    'hashtags',
    () => sql`
    delete from public.user_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.group_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.amendment_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.event_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.blog_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.statement_hashtag where hashtag_id in (select id from public.hashtag where tag ilike 'e2e%');
    delete from public.hashtag where tag ilike 'e2e%';
  `
  );

  await runCleanupStep(
    'groups and roles',
    () => sql`
    delete from public.action_right
    where role_id in (select id from public.role where name like ${pattern})
       or group_id in (select id from public."group" where name like ${pattern})
       or event_id in (select id from public.event where title like ${pattern})
       or amendment_id in (select id from public.amendment where title like ${pattern})
       or blog_id in (select id from public.blog where title like ${pattern});

    delete from public.role_holder_history
    where role_id in (select id from public.role where name like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.group_guest_role
    where group_guest_access_id in (
      select id from public.group_guest_access
      where group_id in (select id from public."group" where name like ${pattern})
         or user_id in (select id from public."user" where bio like ${pattern})
    );

    delete from public.group_guest_access
    where group_id in (select id from public."group" where name like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.group_membership_role
    where group_membership_id in (
      select id from public.group_membership
      where group_id in (select id from public."group" where name like ${pattern})
         or user_id in (select id from public."user" where bio like ${pattern})
    )
       or role_id in (select id from public.role where name like ${pattern});

    delete from public.group_membership_origin
    where group_membership_id in (
      select id from public.group_membership
      where group_id in (select id from public."group" where name like ${pattern})
         or user_id in (select id from public."user" where bio like ${pattern})
    );

    delete from public.group_membership
    where group_id in (select id from public."group" where name like ${pattern})
       or user_id in (select id from public."user" where bio like ${pattern});

    delete from public.role
    where name like ${pattern}
       or group_id in (select id from public."group" where name like ${pattern});

    update public."group"
    set connected_group_id = null, sibling_role_id = null
    where name like ${pattern};

    delete from public."group"
    where name like ${pattern}
       or email like ${pattern}
       or image_url like ${pattern};
  `
  );

  await runCleanupStep(
    'fixture users',
    () => sql`
    delete from public.notification_setting
    where user_id in (select id from public."user" where bio like ${pattern});

    delete from public.user_preference
    where user_id in (select id from public."user" where bio like ${pattern});

    delete from public."user"
    where bio like ${pattern};

    delete from auth.identities
    where user_id in (
      select id
      from auth.users
      where raw_user_meta_data->>'e2e_prefix' like ${pattern}
    );

    delete from auth.users
    where raw_user_meta_data->>'e2e_prefix' like ${pattern};
  `
  );

  if (includeWorkerUsers) {
    await runCleanupStep(
      'worker auth users',
      () => sql`
      delete from public.notification_setting
      where user_id in (
        select id from public."user" where email like 'e2e-create-flow-worker-%@polity.local'
      );

      delete from public.user_preference
      where user_id in (
        select id from public."user" where email like 'e2e-create-flow-worker-%@polity.local'
      );

      delete from public."user"
      where email like 'e2e-create-flow-worker-%@polity.local';

      delete from auth.identities
      where user_id in (
        select id from auth.users where email like 'e2e-create-flow-worker-%@polity.local'
      );

      delete from auth.users
      where email like 'e2e-create-flow-worker-%@polity.local';
    `
    );
  }

  if (options.closeConnection) {
    await closeDb();
  }
}
