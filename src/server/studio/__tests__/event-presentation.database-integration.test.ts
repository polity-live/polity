import { expect, it } from 'vitest';
import postgres from 'postgres';
import { isLocalTestDatabase } from '@/test/local-database';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { applyPresentationCommand } from '../presentation';
import { dbProvider } from '@/zero/db-provider';
import { studioQueries } from '@/zero/communication-studio/queries';
import { hydrateLiveSources } from '@/features/communication-studio/logic/live-projection';
import type { LiveSource } from '@/features/communication-studio/logic/live-contract';
import { queueCommittedExport } from '../export';

const database =
  process.env.STUDIO_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!isLocalTestDatabase(database))
  throw new Error('Event Studio tests require the local development database');

it('creates cover intro defaults, preserves manual opt-outs, and fades music during agenda handoff', async () => {
  const sql = postgres(database, { max: 1, prepare: false });
  const rollback = new Error('rollback intro fixtures');
  const [owner, event, agenda] = Array.from({ length: 3 }, () => crypto.randomUUID());
  try {
    await sql.begin(async tx => {
      await tx`insert into "user"(id) values(${owner})`;
      await tx`insert into event(id,title,creator_id,start_date,visibility) values(${event},'Intro test',${owner},'2026-10-11T18:00:00Z','public')`;
      await tx`insert into agenda_item(id,event_id,creator_id,title,type,status,duration,order_index) values(${agenda},${event},${owner},'Opening','speech','pending',10,1)`;
      await tx`set constraints event_studio_structure,agenda_studio_structure,studio_source_changed immediate`;
      const [project] = await tx`select id from studio_project where event_id=${event}`;
      const [row] = await tx`select document from studio_state where project_id=${project.id}`;
      const doc = studioDocumentV3Schema.parse(row.document);
      const cover = doc.nodes.find(n => n.type === 'frame' && n.eventSource?.template === 'cover')!;
      if (cover.type !== 'frame') throw new Error('frame');
      expect(cover.intro).toMatchObject({ mode: 'spatial', intensity: 0.45 });
      delete cover.intro;
      cover.transform.width = 1777;
      const expected = structuredClone(doc);
      await tx`update studio_state set document=${tx.json(JSON.parse(JSON.stringify(doc)))} where project_id=${project.id}`;
      const [changed] = await tx`select document from studio_state where project_id=${project.id}`;
      const parsed = studioDocumentV3Schema.parse(changed.document);
      const f = parsed.nodes.find(n => n.id === cover.id)!;
      expect(f.type === 'frame' && f.intro).toBeUndefined();
      expect(parsed).toEqual(expected);
      await tx`update event_presentation set mode='studio',running=true,frame_id=${cover.id},audio='{"builtin":"test-tone","status":"playing","position":1}'::jsonb where event_id=${event}`;
      await tx`update event set current_agenda_item_id=${agenda} where id=${event}`;
      const [presentation] = await tx`select audio from event_presentation where event_id=${event}`;
      expect(presentation.audio).toMatchObject({ status: 'stopped', fadeSeconds: 1 });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await sql.end();
  }
});

it('creates, couples, removes and protects event frames transactionally; preserves manual layouts and manages one controller', async () => {
  const sql = postgres(database, { max: 2, prepare: false });
  const rollback = new Error('rollback event studio fixtures');
  const [owner, reader, event, agenda, device, other] = Array.from({ length: 6 }, () =>
    crypto.randomUUID()
  );
  try {
    await sql.begin(async tx => {
      await tx`insert into "user"(id) values(${owner}),(${reader})`;
      await tx`insert into event(id,title,creator_id,start_date,visibility) values(${event},'Show',${owner},'2026-10-11T18:00:00Z','public')`;
      await tx`insert into agenda_item(id,event_id,creator_id,title,type,status,duration,order_index) values(${agenda},${event},${owner},'Rede','speech','pending',10,1)`;
      await tx`set constraints event_studio_structure,agenda_studio_structure,studio_source_changed immediate`;
      const [project] = await tx`select * from studio_project where event_id=${event}`;
      const load = async () => {
        const [state] = await tx`select * from studio_state where project_id=${project.id}`;
        return {
          content_revision: Number(state.content_revision),
          document: studioDocumentV3Schema.parse(state.document),
        };
      };
      let state = await load();
      expect(state.document.nodes.filter(n => n.type === 'frame')).toHaveLength(2);
      expect(project.visibility).toBe('public');
      const frame = state.document.nodes.find(
        n => n.type === 'frame' && n.eventSource?.id === agenda
      )!;
      frame.transform.width = 1600;
      await tx`update studio_state set document=${tx.json(JSON.parse(JSON.stringify(state.document)))} where project_id=${project.id}`;
      const revision = (await load()).content_revision;
      await tx`update agenda_item set title='Aktualisierte Rede',duration=20 where id=${agenda}`;
      state = await load();
      expect(state.document.nodes.find(n => n.id === frame.id)?.transform.width).toBe(1600);
      expect(state.content_revision).toBe(revision);
      const [source] =
        await tx`select payload from studio_live_source where source_type='agenda_item' and source_id=${agenda}`;
      expect(source.payload.title).toBe('Aktualisierte Rede');
      expect(source.payload.end_time - source.payload.start_time).toBe(20 * 60000);
      const [access] =
        await tx`select studio_access(null,${project.id}::uuid,false) as audience,studio_access(${reader}::uuid,${project.id}::uuid,true) as reader_edit,studio_access(${owner}::uuid,${project.id}::uuid,true) as owner_edit`;
      expect(access).toEqual({ audience: true, reader_edit: false, owner_edit: true });
      const adapter = {
        location: 'server',
        dbTransaction: {
          query: (query: string, args: unknown[]) => tx.unsafe(query, args as never[]),
        },
      } as never;
      const command = (
        action: string,
        extras: Record<string, unknown> = {},
        actor = owner,
        d = device
      ) =>
        applyPresentationCommand(adapter, actor, {
          operationId: crypto.randomUUID(),
          eventId: event,
          deviceId: d,
          action,
          ...extras,
        } as never);
      await command('heartbeat', { name: 'Leinwand' });
      await command('heartbeat', { name: 'Regie 2' }, owner, other);
      await command('claim');
      const [defaultOutput] =
        await tx`select audio_device_id from event_presentation where event_id=${event}`;
      expect(defaultOutput.audio_device_id).toBe(device);
      await command('claim', { takeover: true }, owner, other);
      const [retainedOutput] =
        await tx`select audio_device_id,controller_device_id from event_presentation where event_id=${event}`;
      expect(retainedOutput).toMatchObject({
        audio_device_id: device,
        controller_device_id: other,
      });
      await tx`update event_presentation_device set last_seen=${Date.now() - 15000} where id=${device}`;
      await command('claim', { takeover: true }, owner, other);
      const [replacedOutput] =
        await tx`select audio_device_id from event_presentation where event_id=${event}`;
      expect(replacedOutput.audio_device_id).toBe(other);
      // Missing device records must also be replaced, without altering permissions.
      await tx`update event_presentation set audio_device_id=${crypto.randomUUID()} where event_id=${event}`;
      await command('claim', { takeover: true });
      const [missingOutput] =
        await tx`select audio_device_id from event_presentation where event_id=${event}`;
      expect(missingOutput.audio_device_id).toBe(device);
      await command('claim', { takeover: true });
      await command('control', { audioDeviceId: null });
      const [muted] =
        await tx`select audio_device_id from event_presentation where event_id=${event}`;
      expect(muted.audio_device_id).toBeNull();
      await command('claim');
      const [claimedAgain] =
        await tx`select audio_device_id from event_presentation where event_id=${event}`;
      expect(claimedAgain.audio_device_id).toBe(device);
      // Use savepoints because intentionally rejected SQL/commands must not abort the fixture.
      await expect(command('claim', {}, owner, other)).rejects.toThrow('Regie ist bereits aktiv');
      await expect(command('control', {}, reader)).rejects.toThrow();
      const operationId = crypto.randomUUID();
      const input = {
        operationId,
        eventId: event,
        deviceId: device,
        action: 'control',
        frameId: frame.id,
        resultsVisible: false,
        running: true,
      } as const;
      await applyPresentationCommand(adapter, owner, input);
      const [first] = await tx`select revision from event_presentation where event_id=${event}`;
      await applyPresentationCommand(adapter, owner, input);
      const [second] = await tx`select revision from event_presentation where event_id=${event}`;
      expect(second.revision).toBe(first.revision);
      await tx`update agenda_item set type='vote' where id=${agenda}`;
      state = await load();
      expect(state.document.nodes.find(n => n.id === frame.id)?.transform.width).toBe(1600);
      expect(
        state.document.nodes.some(n => n.parentFrameId === frame.id && n.type === 'chart')
      ).toBe(true);
      expect(
        state.document.nodes.some(
          n => n.parentFrameId === frame.id && n.eventTemplateSlot === 'speakers'
        )
      ).toBe(false);
      expect(
        state.document.nodes.some(
          n => n.parentFrameId === frame.id && n.liveBinding?.field === 'speakers'
        )
      ).toBe(false);
      const [vote, yes, no, asset] = Array.from({ length: 4 }, () => crypto.randomUUID());
      await tx`insert into vote(id,agenda_item_id,title,purpose,status,ballot_visibility,offline_electorate_size) values(${vote},${agenda},'Secret vote','closing','indicative','secret',5)`;
      await tx`insert into vote_choice(id,vote_id,label,order_index) values(${yes},${vote},'Yes',0),(${no},${vote},'No',1)`;
      await tx`insert into voter(vote_id,user_id,participation_channel) values(${vote},${owner},'online'),(${vote},${reader},'offline')`;
      await tx`insert into studio_asset(id,project_id,name,mime_type,byte_size,storage_path,ready,created_at) values(${asset},${project.id},'Cue','audio/mpeg',1,${`${project.id}/cue.mp3`},true,0)`;
      state = await load();
      state.document.show = {
        order: 'agenda',
        cues: ['final', 'closed', 'reveal'].map(trigger => ({
          id: crypto.randomUUID(),
          frameId: frame.id,
          trigger: trigger as 'final',
          assetId: asset,
          action: 'play',
          volume: 0.5,
          loop: false,
          fadeSeconds: 1,
        })),
      };
      await tx`update studio_state set document=${tx.json(JSON.parse(JSON.stringify(state.document)))} where project_id=${project.id}`;
      await tx`update vote set status='final' where id=${vote}`;
      const [cue] = await tx`select audio from event_presentation where event_id=${event}`;
      expect(cue.audio).toMatchObject({ assetId: asset, status: 'playing' });
      await tx`insert into final_choice_decision(vote_id,choice_id) values(${vote},${yes})`;
      await tx`insert into vote_offline_tally(vote_id,choice_id,phase,count) values(${vote},${yes},'final',3),(${vote},${no},'final',2)`;
      const [aggregate] =
        await tx`select payload from studio_live_source where source_type='vote' and source_id=${vote}`;
      expect(aggregate.payload.results.eligible).toBe(6);
      expect(aggregate.payload.results.options.map((o: { final: number }) => o.final)).toEqual([
        4, 2,
      ]);
      expect(JSON.stringify(aggregate.payload)).not.toContain('voter_id');
      expect(JSON.stringify(aggregate.payload)).not.toContain('voter_participation_id');
      const [safeAgenda] =
        await tx`select payload from studio_live_source where source_type='agenda_item' and source_id=${agenda}`;
      expect(safeAgenda.payload.results).toBeUndefined();
      expect(safeAgenda.payload.result_source_id).toBe(vote);
      await tx`update vote set status='closed' where id=${vote}`;
      await command('control', { resultsVisible: true, audioDeviceId: device });
      const [revealed] =
        await tx`select audio,results_visible from event_presentation where event_id=${event}`;
      expect(revealed).toMatchObject({
        results_visible: true,
        audio: { assetId: asset, status: 'playing' },
      });
      // A previously selected output going offline must not roll back visual navigation.
      await tx`update event_presentation_device set last_seen=0 where id=${device}`;
      const cover = state.document.nodes.find(
        n => n.type === 'frame' && n.eventSource?.type === 'event'
      )!;
      await command('control', { frameId: cover.id });
      const [disconnected] =
        await tx`select frame_id,audio_device_id,audio from event_presentation where event_id=${event}`;
      expect(disconnected).toMatchObject({
        frame_id: cover.id,
        audio_device_id: device,
        audio: { assetId: asset },
      });
      await expect(command('control', { audioDeviceId: device })).rejects.toThrow('Audiogerät');
      await command('heartbeat', { name: 'Leinwand' });
      await command('control', {
        audioDeviceId: device,
        audio: { builtin: 'test-tone', status: 'playing', position: 0 },
      });
      const [testAudio] = await tx`select audio from event_presentation where event_id=${event}`;
      expect(testAudio.audio).toMatchObject({
        builtin: 'test-tone',
        status: 'playing',
        loop: false,
      });
      expect(testAudio.audio.assetId).toBeUndefined();
      await command('control', { audio: { assetId: asset, status: 'playing' }, frameId: frame.id });
      const [uploadedAudio] =
        await tx`select audio from event_presentation where event_id=${event}`;
      expect(uploadedAudio.audio.builtin).toBeUndefined();
      await tx`update agenda_item set status='withdrawn' where id=${agenda}`;
      state = await load();
      expect(
        state.document.nodes.some(n => n.id === frame.id || n.parentFrameId === frame.id)
      ).toBe(false);
      const [show] = await tx`select frame_id from event_presentation where event_id=${event}`;
      expect(show.frame_id).not.toBe(frame.id);
      await tx`update agenda_item set status='pending' where id=${agenda}`;
      expect((await load()).document.nodes.filter(n => n.type === 'frame')).toHaveLength(2);
      await tx`update event set visibility='private',status='cancelled' where id=${event}`;
      const [privateShow] =
        await tx`select running,audio from event_presentation where event_id=${event}`;
      expect(privateShow).toEqual({ running: false, audio: {} });
      const [privateAccess] =
        await tx`select studio_access(null,${project.id}::uuid,false) as audience`;
      expect(privateAccess.audience).toBe(false);
      await tx
        .savepoint(async sp => {
          await expect(sp`delete from studio_project where id=${project.id}`).rejects.toThrow();
          throw rollback;
        })
        .catch(e => {
          if (e !== rollback) throw e;
        });
      await tx`delete from event where id=${event}`;
      expect(await tx`select id from studio_project where id=${project.id}`).toHaveLength(0);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback)
      throw new Error(String(error) + ' ' + (error as any).detail + ' ' + (error as any).where, {
        cause: error,
      });
  } finally {
    await sql.end();
  }
});

it('applies canonical voting visibility before exposing a public agenda result to audience queries', async () => {
  const sql = postgres(database, { max: 2, prepare: false });
  const [owner, event, agenda, vote, choice] = Array.from({ length: 5 }, () => crypto.randomUUID());
  try {
    await sql.begin(async tx => {
      await tx`insert into "user"(id) values(${owner})`;
      await tx`insert into event(id,title,creator_id,visibility) values(${event},'Public event with private ballot',${owner},'public')`;
      await tx`insert into agenda_item(id,event_id,creator_id,title,type) values(${agenda},${event},${owner},'Visible agenda','vote')`;
      await tx`insert into vote(id,agenda_item_id,title,purpose,status,visibility,offline_electorate_size) values(${vote},${agenda},'Restricted results','closing','final','private',10)`;
      await tx`insert into vote_choice(id,vote_id,label) values(${choice},${vote},'Private option')`;
      await tx`insert into vote_offline_tally(vote_id,choice_id,phase,count) values(${vote},${choice},'final',9)`;
    });
    const read = (actor: string) =>
      dbProvider.transaction(
        async tx =>
          (await tx.run(
            studioQueries.liveSources.fn({
              args: { refs: [], eventId: event },
              ctx: { userID: actor, email: '' },
            })
          )) as unknown as LiveSource[]
      );
    const audience = await read('anon');
    expect(audience.find(s => s.source_id === agenda)?.payload.title).toBe('Visible agenda');
    expect(audience.some(s => s.source_id === vote)).toBe(false);
    expect(
      hydrateLiveSources(audience).find(s => s.source_id === agenda)?.payload.results
    ).toBeNull();
    const operator = await read(owner);
    expect(
      hydrateLiveSources(operator).find(s => s.source_id === agenda)?.payload.results?.options[0]
        .final
    ).toBe(9);
    const [project] = await sql`select id from studio_project where event_id=${event}`;
    const [state] =
      await sql`select content_revision from studio_state where project_id=${project.id}`;
    const job = await queueCommittedExport(
      owner,
      project.id,
      'pdf',
      [],
      Number(state.content_revision),
      undefined,
      { portrait: true }
    );
    await sql`update vote_offline_tally set count=1 where vote_id=${vote}`;
    const [captured] =
      await sql`select r.document as snapshot from studio_export e join studio_revision r on r.id=e.revision_id where e.id=${job.id}`;
    const frozen = studioDocumentV3Schema.parse(captured.snapshot);
    expect(frozen.nodes.every(n => !n.liveBinding && !n.showAnimation)).toBe(true);
    expect(
      frozen.nodes.find(n => n.type === 'chart' && n.data.series[1].values[0] === 9)
    ).toBeDefined();
    await sql`delete from studio_export where id=${job.id}`;
    await sql`update event set visibility='private' where id=${event}`;
    expect(await read('anon')).toHaveLength(0);
  } finally {
    await sql`delete from vote where id=${vote}`;
    await sql`delete from event where id=${event}`;
    await sql`delete from "user" where id=${owner}`;
    await sql.end();
  }
});
