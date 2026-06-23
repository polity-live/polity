import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  getDirectSubgroups,
  calculateDelegateAllocations,
  finalizeDelegateSelection,
} from '@/features/shared/utils/delegate-calculations';
import { notifyDelegatesFinalized } from '@/features/notifications/utils/notification-helpers.ts';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

const finalizeDelegatesSchema = z.object({
  eventId: z.string(),
  senderId: z.string().optional(),
});

export const finalizeDelegatesFn = createServerFn({ method: 'POST' })
  .validator(finalizeDelegatesSchema.parse)
  .handler(async ({ data }) => {
    const supabase = getSupabase();

    try {
      const { eventId, senderId } = data;

      if (!eventId) {
        throw new Error('Event ID is required');
      }

      // Query event with its group
      const { data: eventRow, error: eventError } = await supabase
        .from('event')
        .select('*, group:group_id(*)')
        .eq('id', eventId)
        .single();

      if (eventError || !eventRow) {
        throw new Error('Event not found');
      }

      const parentGroupId = eventRow.group_id;
      if (!parentGroupId) {
        throw new Error('Event has no associated group');
      }

      // Query delegates for this event
      const { data: delegates } = await supabase
        .from('event_delegate')
        .select('*, user:user_id(*), group:group_id(*)')
        .eq('event_id', eventId);

      const { data: hierarchyConnections } = await supabase
        .from('group_connection')
        .select('id, parent_group_id, child_group_id')
        .eq('connection_type', 'hierarchy')
        .eq('parent_group_id', parentGroupId)
        .eq('status', 'active');

      const childGroupIds = [
        ...new Set(
          (hierarchyConnections || [])
            .map(connection => connection.child_group_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      const { data: childGroups } =
        childGroupIds.length > 0
          ? await supabase.from('group').select('id, name, member_count').in('id', childGroupIds)
          : { data: [] };
      const childGroupsById = new Map((childGroups || []).map(group => [group.id, group]));
      const groupRelationships = (hierarchyConnections || [])
        .filter((connection): connection is typeof connection & { child_group_id: string } =>
          Boolean(connection.child_group_id)
        )
        .map(connection => ({
          id: connection.id,
          childGroup: {
            id: connection.child_group_id,
            name: childGroupsById.get(connection.child_group_id)?.name || 'Group',
            memberCount: childGroupsById.get(connection.child_group_id)?.member_count || 0,
          },
          parentGroup: { id: parentGroupId },
        }));

      // Attach delegates to event for business logic compatibility
      const event = { ...eventRow, delegates: delegates || [] };

      // --- Business logic (mirrors buildFinalizeDelegatesTransactions) ---

      if (event.event_type !== 'delegate_conference') {
        throw new Error('Event is not a delegate conference');
      }

      if (event.delegates_finalized) {
        throw new Error('Delegates already finalized for this event');
      }

      const subgroups = getDirectSubgroups(parentGroupId, groupRelationships || []);

      if (subgroups.length === 0) {
        throw new Error('No subgroups found for this group');
      }

      const totalMembers = subgroups.reduce((sum: number, g) => sum + g.memberCount, 0);
      const totalDelegates = Math.max(1, Math.floor(totalMembers / 50));

      const allocations = calculateDelegateAllocations(
        subgroups.map(g => ({ id: g.id, memberCount: g.memberCount })),
        totalDelegates
      );

      const nominations = event.delegates || [];

      const finalizedDelegates = finalizeDelegateSelection(
        nominations.map(
          (d: {
            id: string;
            group?: { id?: string } | null;
            group_id?: string | null;
            user?: { id?: string } | null;
            user_id?: string | null;
            priority?: number | null;
            status?: string | null;
          }) => ({
            id: d.id,
            groupId: d.group?.id || d.group_id || '',
            userId: d.user?.id || d.user_id || '',
            priority: d.priority || 0,
            status: d.status || 'nominated',
          })
        ),
        allocations
      );

      // --- Execute mutations with Supabase ---

      // 1. Mark event delegates as finalized
      await supabase
        .from('event')
        .update({
          delegates_finalized: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      // 2. Upsert group delegate allocations
      for (const allocation of allocations) {
        await supabase.from('group_delegate_allocation').upsert(
          {
            event_id: event.id,
            group_id: allocation.groupId,
            allocated_delegates: allocation.allocatedDelegates,
            member_count: allocation.memberCount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'event_id,group_id' }
        );
      }

      // 3. Update delegate statuses
      for (const { id, status } of finalizedDelegates) {
        await supabase
          .from('event_delegate')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      // 4. Send notification
      if (senderId) {
        await notifyDelegatesFinalized({
          senderId,
          eventId: event.id,
          eventTitle: event.title || 'Event',
        });
      }

      return {
        success: true,
        message: translateText('generated.inline.0654_delegates_finalized_successfully_16440aae'),
      };
    } catch (error) {
      console.error('Error finalizing delegates:', error);
      const message = error instanceof Error ? error.message : 'Failed to finalize delegates';
      throw new Error(message, { cause: error });
    }
  });
