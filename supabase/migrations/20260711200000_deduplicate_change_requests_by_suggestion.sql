create temporary table _change_request_duplicate_keepers on commit drop as
with duplicate_groups as (
  select amendment_id, process_branch_id, suggestion_id
  from public.change_request
  where suggestion_id is not null
  group by amendment_id, process_branch_id, suggestion_id
  having count(*) > 1
), explicit_links as (
  select
    change_request.amendment_id,
    change_request.process_branch_id,
    change_request.suggestion_id,
    change_request.id as keeper_id
  from duplicate_groups duplicate_group
  join public.amendment amendment
    on amendment.id = duplicate_group.amendment_id
   and duplicate_group.process_branch_id is null
  cross join lateral jsonb_array_elements(coalesce(amendment.discussions, '[]'::jsonb)) discussion(value)
  join public.change_request change_request
    on change_request.amendment_id = duplicate_group.amendment_id
   and change_request.process_branch_id is null
   and change_request.suggestion_id = duplicate_group.suggestion_id
   and change_request.id::text = discussion.value ->> 'changeRequestEntityId'
   and change_request.suggestion_id = discussion.value ->> 'id'

  union all

  select
    change_request.amendment_id,
    change_request.process_branch_id,
    change_request.suggestion_id,
    change_request.id as keeper_id
  from duplicate_groups duplicate_group
  join public.amendment_process_branch branch
    on branch.id = duplicate_group.process_branch_id
  cross join lateral jsonb_array_elements(coalesce(branch.discussions, '[]'::jsonb)) discussion(value)
  join public.change_request change_request
    on change_request.amendment_id = duplicate_group.amendment_id
   and change_request.process_branch_id = duplicate_group.process_branch_id
   and change_request.suggestion_id = duplicate_group.suggestion_id
   and change_request.id::text = discussion.value ->> 'changeRequestEntityId'
   and change_request.suggestion_id = discussion.value ->> 'id'
)
select
  amendment_id,
  process_branch_id,
  suggestion_id,
  (array_agg(distinct keeper_id order by keeper_id))[1] as keeper_id
from explicit_links
group by amendment_id, process_branch_id, suggestion_id
having count(distinct keeper_id) = 1;

-- Dependent votes or agenda entries make a duplicate unsafe to remove
-- automatically. Those rows remain available for manual reconciliation.
delete from public.change_request duplicate
using _change_request_duplicate_keepers keeper
where duplicate.amendment_id = keeper.amendment_id
  and duplicate.process_branch_id is not distinct from keeper.process_branch_id
  and duplicate.suggestion_id = keeper.suggestion_id
  and duplicate.id <> keeper.keeper_id
  and not exists (
    select 1
    from public.change_request_vote vote
    where vote.change_request_id = duplicate.id
  )
  and not exists (
    select 1
    from public.agenda_item_change_request timeline_item
    where timeline_item.change_request_id = duplicate.id
  );

create temporary table _change_request_repair_numbering on commit drop as
select
  change_request.id,
  change_request.amendment_id,
  change_request.process_branch_id,
  row_number() over (
    partition by change_request.amendment_id, change_request.process_branch_id
    order by change_request.created_at asc, change_request.id asc
  )::integer as sequence_number
from public.change_request change_request;

update public.change_request change_request
set branch_sequence_number = null
from _change_request_repair_numbering numbered
where numbered.id = change_request.id;

update public.change_request change_request
set
  branch_sequence_number = numbered.sequence_number,
  title = case
    when change_request.title is null or change_request.title ~ '^CR-[0-9]+$'
      then 'CR-' || numbered.sequence_number
    else change_request.title
  end,
  updated_at = now()
from _change_request_repair_numbering numbered
where numbered.id = change_request.id;

create temporary table _change_request_repair_links on commit drop as
with candidates as (
  select
    'amendment'::text as scope_type,
    amendment.id as scope_id,
    discussion.value ->> 'id' as discussion_id,
    change_request.id as change_request_id
  from public.amendment amendment
  cross join lateral jsonb_array_elements(coalesce(amendment.discussions, '[]'::jsonb)) discussion(value)
  join public.change_request change_request
    on change_request.amendment_id = amendment.id
   and change_request.process_branch_id is null
   and (
     change_request.suggestion_id = discussion.value ->> 'id'
     or change_request.id::text = discussion.value ->> 'changeRequestEntityId'
   )
  where discussion.value ->> 'id' is not null

  union all

  select
    'branch'::text as scope_type,
    branch.id as scope_id,
    discussion.value ->> 'id' as discussion_id,
    change_request.id as change_request_id
  from public.amendment_process_branch branch
  join public.amendment_process_run process_run on process_run.id = branch.process_run_id
  cross join lateral jsonb_array_elements(coalesce(branch.discussions, '[]'::jsonb)) discussion(value)
  join public.change_request change_request
    on change_request.amendment_id = process_run.amendment_id
   and change_request.process_branch_id = branch.id
   and (
     change_request.suggestion_id = discussion.value ->> 'id'
     or change_request.id::text = discussion.value ->> 'changeRequestEntityId'
   )
  where discussion.value ->> 'id' is not null
), unique_discussion_links as (
  select
    scope_type,
    scope_id,
    discussion_id,
    (array_agg(distinct change_request_id order by change_request_id))[1] as change_request_id
  from candidates
  group by scope_type, scope_id, discussion_id
  having count(distinct change_request_id) = 1
), unique_change_request_links as (
  select
    scope_type,
    scope_id,
    change_request_id,
    (array_agg(discussion_id order by discussion_id))[1] as discussion_id
  from unique_discussion_links
  group by scope_type, scope_id, change_request_id
  having count(*) = 1
)
select scope_type, scope_id, discussion_id, change_request_id
from unique_change_request_links;

update public.change_request change_request
set
  suggestion_id = link.discussion_id,
  updated_at = now()
from _change_request_repair_links link
where link.change_request_id = change_request.id
  and change_request.suggestion_id is distinct from link.discussion_id;

with rebuilt as (
  select
    amendment.id,
    jsonb_agg(
      case
        when link.change_request_id is null then discussion.value
        else discussion.value || jsonb_build_object(
          'crId', 'CR-' || numbered.sequence_number,
          'displayCrId', 'CR-' || numbered.sequence_number,
          'changeRequestEntityId', link.change_request_id,
          'branchSequenceNumber', numbered.sequence_number,
          'branchScopedCrNumber', numbered.sequence_number
        )
      end
      order by discussion.ordinality
    ) as discussions
  from public.amendment amendment
  cross join lateral jsonb_array_elements(coalesce(amendment.discussions, '[]'::jsonb))
    with ordinality as discussion(value, ordinality)
  left join _change_request_repair_links link
    on link.scope_type = 'amendment'
   and link.scope_id = amendment.id
   and link.discussion_id = discussion.value ->> 'id'
  left join _change_request_repair_numbering numbered
    on numbered.id = link.change_request_id
  group by amendment.id
)
update public.amendment amendment
set discussions = rebuilt.discussions, updated_at = now()
from rebuilt
where rebuilt.id = amendment.id
  and exists (
    select 1 from _change_request_repair_links link
    where link.scope_type = 'amendment' and link.scope_id = amendment.id
  );

with rebuilt as (
  select
    branch.id,
    jsonb_agg(
      case
        when link.change_request_id is null then discussion.value
        else discussion.value || jsonb_build_object(
          'crId', 'CR-' || numbered.sequence_number,
          'displayCrId', 'CR-' || numbered.sequence_number,
          'changeRequestEntityId', link.change_request_id,
          'branchSequenceNumber', numbered.sequence_number,
          'branchScopedCrNumber', numbered.sequence_number
        )
      end
      order by discussion.ordinality
    ) as discussions
  from public.amendment_process_branch branch
  cross join lateral jsonb_array_elements(coalesce(branch.discussions, '[]'::jsonb))
    with ordinality as discussion(value, ordinality)
  left join _change_request_repair_links link
    on link.scope_type = 'branch'
   and link.scope_id = branch.id
   and link.discussion_id = discussion.value ->> 'id'
  left join _change_request_repair_numbering numbered
    on numbered.id = link.change_request_id
  group by branch.id
)
update public.amendment_process_branch branch
set discussions = rebuilt.discussions, updated_at = now()
from rebuilt
where rebuilt.id = branch.id
  and exists (
    select 1 from _change_request_repair_links link
    where link.scope_type = 'branch' and link.scope_id = branch.id
  );
