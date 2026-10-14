import { expect, it } from 'vitest';
import postgres from 'postgres';
import { isLocalTestDatabase } from '@/test/local-database';
import { showCueSchema } from '@/features/communication-studio/logic/live-contract';
import { applyPresentationCommand } from '../presentation';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!isLocalTestDatabase(database)) throw new Error('Local database required');
it('executes both lanes once, prefers local transitions, preserves pause position and retains global rules on agenda removal', async () => {
  const sql = postgres(database, { max: 1, prepare: false });
  const rollback = new Error('rollback show audio fixtures');
  try {
    await sql.begin(async tx => {
      const [owner, event, a, b, device, vote] = Array.from({ length: 6 }, () =>
        crypto.randomUUID()
      );
      await tx`insert into "user"(id) values(${owner})`;
      await tx`insert into event(id,title,creator_id,start_date,visibility) values(${event},'Audio UX',${owner},'2026-10-11T18:00:00Z','public')`;
      await tx`insert into agenda_item(id,event_id,creator_id,title,type,status,duration,order_index) values(${a},${event},${owner},'A','speech','pending',10,1),(${b},${event},${owner},'B','vote','pending',10,2)`;
      await tx`set constraints all immediate`;
      const [project] = await tx`select id from studio_project where event_id=${event}`;
      const [stored] = await tx`select document from studio_state where project_id=${project.id}`;
      const doc = stored.document;
      const cover = doc.nodes.find(
        (n: any) => n.type === 'frame' && n.eventSource?.type === 'event'
      ).id;
      const fa = doc.nodes.find((n: any) => n.type === 'frame' && n.eventSource?.id === a).id;
      const fb = doc.nodes.find((n: any) => n.type === 'frame' && n.eventSource?.id === b).id;
      const cue = (
        frameId: string | undefined,
        builtin: string | undefined,
        extra: Record<string, unknown> = {}
      ) =>
        showCueSchema.parse({
          id: crypto.randomUUID(),
          frameId,
          builtin,
          trigger: 'enter',
          fadeInSeconds: 1,
          fadeOutSeconds: 1,
          ...extra,
        });
      const global = cue(undefined, 'test-tone', { channel: 'transition', scope: 'global' });
      doc.show.cues = [
        cue(cover, 'cinematic-sequence'),
        cue(fa, 'cinematic-thriller'),
        global,
        cue(fa, 'cinematic-hope', { channel: 'transition' }),
      ];
      const save = () =>
        tx`update studio_state set document=${tx.json(doc)} where project_id=${project.id}`;
      await save();
      const adapter = {
        location: 'server',
        dbTransaction: {
          query: (query: string, args: unknown[]) => tx.unsafe(query, args as never[]),
        },
      } as never;
      const command = (extra: Record<string, unknown> = {}, action = 'control') =>
        applyPresentationCommand(adapter, owner, {
          eventId: event,
          deviceId: device,
          operationId: crypto.randomUUID(),
          action,
          ...extra,
        } as never);
      const state = async () =>
        (await tx`select * from event_presentation where event_id=${event}`)[0];
      await command({}, 'claim');
      await command({ mode: 'studio', running: true, frameId: cover });
      let current = await state();
      expect(current.audio).toMatchObject({
        builtin: 'cinematic-sequence',
        status: 'playing',
        ownerFrameId: cover,
        transition: { builtin: 'test-tone', durationSeconds: 3, loop: false },
      });
      const ids = [current.audio.cueId, current.audio.transition.cueId];
      await command({ frameId: cover });
      current = await state();
      expect([current.audio.cueId, current.audio.transition.cueId]).toEqual(ids);
      await command({ frameId: fa });
      current = await state();
      expect(current.audio).toMatchObject({
        builtin: 'cinematic-thriller',
        ownerFrameId: fa,
        transition: { builtin: 'cinematic-hope', loop: false },
      });
      const manualIds = [current.audio.cueId, current.audio.transition.cueId];
      // Legacy sync calls are deduplicated against the authoritative entry evaluation.
      await tx`select studio_fire_show_cue(${event},${fa},'enter')`;
      expect([(await state()).audio.cueId, (await state()).audio.transition.cueId]).toEqual(
        manualIds
      );
      await tx`update event_presentation_device set last_seen=0 where id=${device}`;
      await command({ frameId: fb });
      current = await state();
      expect(current.audio).toMatchObject({
        status: 'stopped',
        transition: { builtin: 'test-tone' },
      });
      // Automatic agenda following uses the same evaluator and preserves output assignment.
      await command({ followAgenda: true });
      await tx`update event set current_agenda_item_id=${a} where id=${event}`;
      current = await state();
      expect(current.frame_id).toBe(fa);
      expect(current.audio_device_id).toBe(device);
      expect(current.audio.builtin).toBe('cinematic-thriller');
      expect(current.audio.transition.builtin).toBe('cinematic-hope');
      await command({ frameId: fb });
      doc.show.cues.push(
        cue(fb, undefined, { action: 'pause', trigger: 'final' }),
        cue(fb, undefined, { action: 'stop', trigger: 'closed' }),
        cue(fb, 'cinematic-atmosphere', { trigger: 'activate' })
      );
      await save();
      await tx`insert into vote(id,agenda_item_id,title,purpose,status,ballot_visibility,offline_electorate_size) values(${vote},${b},'Vote','closing','indicative','secret',0)`;
      await command({
        audio: { builtin: 'cinematic-hope', status: 'playing', position: 17, volume: 0.4 },
      });
      await command({ audio: { status: 'playing', position: 17 } });
      const effectId = (await state()).audio.transition.cueId;
      await tx`update vote set status='final' where id=${vote}`;
      current = await state();
      expect(current.audio.status).toBe('paused');
      expect(current.audio.builtin).toBe('cinematic-hope');
      expect(current.audio.position).toBeGreaterThanOrEqual(17);
      expect(current.audio.transition.cueId).toBe(effectId);
      await tx`update vote set status='closed' where id=${vote}`;
      expect((await state()).audio).toMatchObject({ status: 'stopped', position: 0 });
      await tx`update agenda_item set status='active' where id=${b}`;
      expect((await state()).audio).toMatchObject({
        builtin: 'cinematic-atmosphere',
        status: 'playing',
      });
      await tx`delete from agenda_item where id=${a}`;
      const [remaining] =
        await tx`select document from studio_state where project_id=${project.id}`;
      expect(remaining.document.show.cues.some((c: any) => c.id === global.id)).toBe(true);
      expect(remaining.document.show.cues.some((c: any) => c.frameId === fa)).toBe(false);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});
