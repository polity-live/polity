import assert from 'node:assert/strict';
import { queries } from '../../../src/zero/queries';
import type { MutationCase } from './mutation-case-types';
import { MutationFixtures, mutationFixtureID } from './mutation-fixtures';
import { eventAdminFixture } from './mutation-governance-fixtures';

export function presentationMutationCases(): MutationCase[] {
  return (['owner', 'outsider', 'anonymous'] as const).map(actor => {
    const success = actor === 'owner';
    return {
      name: 'studio.presentation',
      variant: success ? 'claim-authorized' : 'claim-denied',
      actor,
      outcome: success ? 'success' : 'server-error',
      ...(!success ? { error: 'permission_denied' } : {}),
      observer: { query: 'studio.eventPresentation' },
      specification: {
        action: 'claim',
        fixture:
          'fresh public event with owned manager rights and automatically created presentation',
        transition: success
          ? 'register owned device, acquire controller lease, set default audio output and record operation'
          : 'unchanged presentation, no device or operation',
        cleanup: 'fixture event, manager rights and all generated presentation records absent',
      },
      async prepare(ctx) {
        const f = new MutationFixtures(ctx.sql);
        const event = await eventAdminFixture(f, ctx, 'presentation-event');
        const deviceId = mutationFixtureID(ctx.id, 'presentation-device');
        const operationId = mutationFixtureID(ctx.id, 'presentation-operation');
        const [initial] =
          await ctx.sql`select * from event_presentation where event_id=${event.id}`;
        assert(initial, 'Event fixture must create its presentation');
        const beforeRevision = Number(initial.revision);
        await f.track('event_presentation_device', deviceId);
        await f.track('event_presentation_operation', operationId);
        return {
          args: {
            eventId: event.id,
            deviceId,
            operationId,
            action: 'claim',
            name: 'Fixture director',
          },
          observe: {
            request: queries.studio.eventPresentation({ eventId: event.id }),
            before: data =>
              !!data &&
              typeof data === 'object' &&
              'revision' in data &&
              data.revision === beforeRevision,
            after: data =>
              !!data &&
              typeof data === 'object' &&
              'revision' in data &&
              data.revision === beforeRevision + (success ? 1 : 0) &&
              (!success ||
                ('controller_device_id' in data && data.controller_device_id === deviceId)),
          },
          async verify() {
            const [state] =
              await ctx.sql`select * from event_presentation where event_id=${event.id}`;
            if (success) {
              assert.equal(state.revision, beforeRevision + 1);
              assert.equal(state.controller_id, ctx.ownerID);
              assert.equal(state.controller_device_id, deviceId);
              assert.equal(state.audio_device_id, deviceId);
              assert(Number(state.lease_until) > Number(state.updated_at));
              await f.expect('event_presentation_device', deviceId, {
                event_id: event.id,
                user_id: ctx.ownerID,
                name: 'Fixture director',
              });
              await f.expect('event_presentation_operation', operationId, {
                event_id: event.id,
                actor_id: ctx.ownerID,
              });
            } else {
              assert.deepEqual(state, initial);
              await f.expect('event_presentation_device', deviceId, null);
              await f.expect('event_presentation_operation', operationId, null);
            }
          },
          restore: () => f.restore(),
          async verifyRestored() {
            await f.verifyRestored();
            for (const table of [
              'event_presentation',
              'event_presentation_device',
              'event_presentation_operation',
            ])
              assert.equal(
                (await ctx.sql`select * from ${ctx.sql(table)} where event_id=${event.id}`).length,
                0
              );
            assert.equal(
              (await ctx.sql`select id from studio_project where event_id=${event.id}`).length,
              0
            );
          },
        };
      },
    } satisfies MutationCase;
  });
}
