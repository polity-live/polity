create temporary table _change_request_first_branch_targets on commit drop as
select distinct
  amendment.id as amendment_id,
  first_branch.id as branch_id
from public.amendment amendment
join lateral (
  select branch.id
  from public.amendment_process_branch branch
  where branch.process_run_id = amendment.current_process_run_id
  order by branch.created_at asc, branch.id asc
  limit 1
) first_branch on true
where amendment.current_process_run_id is not null
  and exists (
    select 1
    from public.change_request change_request
    where change_request.amendment_id = amendment.id
      and change_request.process_branch_id is null
  );

-- Free the branch-scoped unique sequence before combining the two scopes.
update public.change_request change_request
set branch_sequence_number = null
from _change_request_first_branch_targets target
where change_request.amendment_id = target.amendment_id
  and change_request.process_branch_id = target.branch_id;

update public.change_request change_request
set
  process_branch_id = target.branch_id,
  updated_at = now()
from _change_request_first_branch_targets target
where change_request.amendment_id = target.amendment_id
  and change_request.process_branch_id is null;

-- Keep branch discussions authoritative while retaining pre-process discussions
-- that belong to the document snapshot copied into the first branch.
with merged as (
  select
    target.branch_id,
    coalesce(
      jsonb_agg(entry.value order by entry.source_order, entry.element_order)
        filter (where entry.value is not null),
      '[]'::jsonb
    ) as discussions
  from _change_request_first_branch_targets target
  join public.amendment amendment on amendment.id = target.amendment_id
  join public.amendment_process_branch branch on branch.id = target.branch_id
  left join lateral (
    select ranked.value, ranked.source_order, ranked.element_order
    from (
      select
        source.value,
        source.source_order,
        source.element_order,
        row_number() over (
          partition by coalesce(source.value ->> 'id', source.value::text)
          order by source.source_order desc, source.element_order desc
        ) as duplicate_rank
      from (
        select value, 1 as source_order, ordinality as element_order
        from jsonb_array_elements(coalesce(amendment.discussions, '[]'::jsonb))
          with ordinality as amendment_discussion(value, ordinality)
        union all
        select value, 2 as source_order, ordinality as element_order
        from jsonb_array_elements(coalesce(branch.discussions, '[]'::jsonb))
          with ordinality as branch_discussion(value, ordinality)
      ) source
    ) ranked
    where ranked.duplicate_rank = 1
  ) entry on true
  group by target.branch_id
)
update public.amendment_process_branch branch
set
  discussions = merged.discussions,
  updated_at = now()
from merged
where branch.id = merged.branch_id;

update public.amendment amendment
set
  discussions = '[]'::jsonb,
  updated_at = now()
from _change_request_first_branch_targets target
where amendment.id = target.amendment_id;

update public.agenda_item_change_request timeline_item
set
  process_branch_id = target.branch_id,
  updated_at = now()
from public.change_request change_request
join _change_request_first_branch_targets target
  on target.amendment_id = change_request.amendment_id
where timeline_item.change_request_id = change_request.id
  and change_request.process_branch_id = target.branch_id
  and timeline_item.process_branch_id is null;

with numbered as (
  select
    change_request.id,
    row_number() over (
      partition by change_request.amendment_id, change_request.process_branch_id
      order by change_request.created_at asc, change_request.id asc
    )::integer as sequence_number
  from public.change_request change_request
  join _change_request_first_branch_targets target
    on target.amendment_id = change_request.amendment_id
   and target.branch_id = change_request.process_branch_id
)
update public.change_request change_request
set
  branch_sequence_number = numbered.sequence_number,
  title = case
    when change_request.title is null or change_request.title ~ '^CR-[0-9]+$'
      then 'CR-' || numbered.sequence_number
    else change_request.title
  end,
  updated_at = now()
from numbered
where change_request.id = numbered.id;
