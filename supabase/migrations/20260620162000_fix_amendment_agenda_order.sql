WITH agenda_items_to_reorder AS (
  SELECT
    id,
    event_id,
    row_number() OVER (PARTITION BY event_id ORDER BY created_at, id) AS reorder_offset
  FROM public.agenda_item
  WHERE event_id IS NOT NULL
    AND order_index = 999
    AND COALESCE(forwarding_status, '') <> 'previous_decision_outstanding'
),
target_events AS (
  SELECT DISTINCT event_id
  FROM agenda_items_to_reorder
),
confirmed_agenda_tail AS (
  SELECT
    target_events.event_id,
    COALESCE(MAX(agenda_item.order_index), 0) AS max_order_index
  FROM target_events
  LEFT JOIN public.agenda_item ON agenda_item.event_id = target_events.event_id
    AND COALESCE(agenda_item.forwarding_status, '') <> 'previous_decision_outstanding'
    AND NOT EXISTS (
      SELECT 1
      FROM agenda_items_to_reorder
      WHERE agenda_items_to_reorder.id = agenda_item.id
    )
  GROUP BY target_events.event_id
)
UPDATE public.agenda_item
SET
  order_index = confirmed_agenda_tail.max_order_index + agenda_items_to_reorder.reorder_offset,
  updated_at = now()
FROM agenda_items_to_reorder
JOIN confirmed_agenda_tail ON confirmed_agenda_tail.event_id = agenda_items_to_reorder.event_id
WHERE agenda_item.id = agenda_items_to_reorder.id;
