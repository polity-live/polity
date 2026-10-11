import type { Transaction } from '@rocicorp/zero';
import type { Schema } from '@/zero/schema';
import { rows, sqlTransaction, lockAuthority } from '@/server/transaction';
import { checksum } from '@/server/checksum';
import { encodeAppError } from '@/features/shared/errors/app-error';
import {
  presentationCommandSchema,
  type PresentationCommand,
} from '@/zero/communication-studio/presentation-schema';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';
import {
  normalizePresentationAudioPosition,
  presentationSequenceEnd,
} from '@/features/communication-studio/logic/presentation-audio';

export async function applyPresentationCommand(
  tx: Transaction<Schema>,
  userId: string,
  input: PresentationCommand
) {
  const args = presentationCommandSchema.parse(input),
    sql = sqlTransaction(tx);
  const actor = userId && userId !== 'anon' ? userId : null;
  await lockAuthority(sql);
  const [access] = await rows<{ read: boolean; manage: boolean }>(
    sql,
    'select event_studio_can_read($1::uuid,$2::uuid) as read,event_studio_can_manage($1::uuid,$2::uuid) as manage',
    [actor, args.eventId]
  );
  if (!access?.read) throw new Error(encodeAppError('permission_denied'));
  const [state] = await rows<ShowState>(
    sql,
    'select * from event_presentation where event_id=$1 for update',
    [args.eventId]
  );
  if (!state) throw new Error('Presentation unavailable');
  const now = Date.now();
  const [device] = await rows<{ user_id: string | null; event_id: string }>(
    sql,
    'select user_id,event_id from event_presentation_device where id=$1',
    [args.deviceId]
  );
  if (device && (device.user_id !== actor || device.event_id !== args.eventId))
    throw new Error(encodeAppError('permission_denied'));
  if (args.action === 'device' || args.action === 'heartbeat') {
    await sql.query(
      'insert into event_presentation_device(id,event_id,user_id,name,last_seen) values($1,$2,$3,$4,$5) on conflict(id) do update set last_seen=$5,name=$4',
      [args.deviceId, args.eventId, actor, args.name, now]
    );
    if (
      access.manage &&
      state.controller_id === actor &&
      state.controller_device_id === args.deviceId &&
      Number(state.lease_until) > now
    ) {
      await sql.query('update event_presentation set lease_until=$2 where event_id=$1', [
        args.eventId,
        now + 15000,
      ]);
    }
    return;
  }
  if (!access.manage || !actor) throw new Error(encodeAppError('permission_denied'));
  const hash = checksum(args);
  const [prior] = await rows<{ actor_id: string; input_hash: string }>(
    sql,
    'select actor_id,input_hash from event_presentation_operation where id=$1',
    [args.operationId]
  );
  if (prior) {
    if (prior.actor_id !== actor || prior.input_hash !== hash)
      throw new Error('Operation ID reused');
    return;
  }
  if (args.action === 'claim') {
    if (
      state.controller_device_id &&
      state.controller_device_id !== args.deviceId &&
      Number(state.lease_until) > now &&
      !args.takeover
    )
      throw new Error('Regie ist bereits aktiv. Übernehmen auswählen.');
    // Claim and default output registration must succeed together, including before the first heartbeat.
    await sql.query(
      'insert into event_presentation_device(id,event_id,user_id,name,last_seen) values($1,$2,$3,$4,$5) on conflict(id) do update set last_seen=$5',
      [args.deviceId, args.eventId, actor, args.name, now]
    );
    const [connectedOutput] = state.audio_device_id
      ? await rows(
          sql,
          'select id from event_presentation_device where id=$1 and event_id=$2 and last_seen>$3',
          [state.audio_device_id, args.eventId, now - 15000]
        )
      : [];
    await sql.query(
      'update event_presentation set controller_id=$2,controller_device_id=$3,lease_until=$4,audio_device_id=$6,revision=revision+1,updated_at=$5 where event_id=$1',
      [
        args.eventId,
        actor,
        args.deviceId,
        now + 15000,
        now,
        connectedOutput ? state.audio_device_id : args.deviceId,
      ]
    );
  } else {
    if (
      state.controller_id !== actor ||
      state.controller_device_id !== args.deviceId ||
      Number(state.lease_until) <= now
    )
      throw new Error('Regie muss übernommen werden');
    if (args.action === 'release') {
      await sql.query(
        "update event_presentation set controller_id=null,controller_device_id=null,lease_until=null,audio='{}',revision=revision+1,updated_at=$2 where event_id=$1",
        [args.eventId, now]
      );
    } else {
      if (args.expectedRevision !== undefined && args.expectedRevision !== state.revision)
        throw new Error('Präsentation wurde zwischenzeitlich geändert. Erneut versuchen.');
      const [stored] = await rows<{ document: unknown }>(
        sql,
        'select document from studio_state where project_id=$1',
        [state.project_id]
      );
      const document = studioDocumentV3Schema.parse(stored.document);
      let frameId = args.frameId ?? state.frame_id;
      const [event] = await rows<{ current_agenda_item_id: string | null; status: string | null }>(
        sql,
        'select current_agenda_item_id,status from event where id=$1',
        [args.eventId]
      );
      if (event.status === 'cancelled' && args.running) throw new Error('Event ist abgesagt');
      const follow = args.followAgenda ?? (args.frameId ? false : state.follow_agenda);
      if (follow) {
        frameId =
          document.nodes.find(
            n =>
              n.type === 'frame' && n.visible && n.eventSource?.id === event.current_agenda_item_id
          )?.id ??
          document.nodes.find(
            n => n.type === 'frame' && n.visible && n.eventSource?.type === 'event'
          )?.id ??
          null;
      }
      if (
        frameId &&
        !document.nodes.some(
          n => n.type === 'frame' && n.visible && !n.parentFrameId && n.id === frameId
        )
      )
        throw new Error('Frame ist nicht verfügbar');
      const audioDevice =
        args.audioDeviceId === undefined ? state.audio_device_id : args.audioDeviceId;
      // An inherited output may temporarily disconnect without blocking visual controls.
      if (args.audioDeviceId && audioDevice) {
        const [output] = await rows(
          sql,
          'select id from event_presentation_device where id=$1 and event_id=$2 and last_seen>$3',
          [audioDevice, args.eventId, now - 15000]
        );
        if (!output) throw new Error('Audiogerät ist nicht verbunden');
      }
      const elapsed =
        state.audio.status === 'playing' ? Math.max(0, (now - (state.audio.at ?? now)) / 1000) : 0;
      const position =
        (args.audio?.assetId && args.audio.assetId !== state.audio.assetId) ||
        (args.audio?.builtin && args.audio.builtin !== state.audio.builtin) ||
        args.audio?.status === 'stopped'
          ? 0
          : (args.audio?.position ?? (state.audio.position ?? 0) + elapsed);
      let audio: ShowState['audio'] = args.audio
        ? { ...state.audio, ...args.audio, position, at: now }
        : state.audio;
      if (args.audio?.builtin) delete audio.assetId;
      if (args.audio?.assetId) delete audio.builtin;
      if (audio.builtin === 'test-tone') audio = { ...audio, loop: false };
      if (args.audio) {
        if (audio.builtin !== 'cinematic-sequence' || audio.loop || position === 0) {
          delete audio.sequenceEndPosition;
        } else if (state.audio.loop || state.audio.builtin !== 'cinematic-sequence') {
          audio.sequenceEndPosition = presentationSequenceEnd(position);
        }
      }
      if (args.audio) audio.position = normalizePresentationAudioPosition(audio, position);
      // Cue execution is authoritative in studio_presentation_audio_rules. The same
      // database evaluator also handles agenda-follow and voting phase changes.
      const cueTrigger =
        (args.mode ?? state.mode) === 'studio' &&
        (frameId !== state.frame_id ||
          state.mode !== 'studio' ||
          (args.running === true && !state.running));
      if (args.audio && audio.assetId) {
        const [asset] = await rows(
          sql,
          "select id from studio_asset where id=$1 and project_id=$2 and workspace_id is null and ready=true and mime_type in ('audio/mpeg','audio/wav')",
          [audio.assetId, state.project_id]
        );
        if (!asset) throw new Error('Audiodatei ist nicht verfügbar');
      }
      if (args.running === false) audio = { ...audio, status: 'stopped', at: now };
      await sql.query(
        'update event_presentation set mode=$2,frame_id=$3,follow_agenda=$4,results_visible=$5,running=$6,audio_device_id=$7,audio=$8::jsonb,cue_id=$9,cue_at=$10,revision=revision+1,updated_at=$10 where event_id=$1',
        [
          args.eventId,
          args.mode ?? state.mode,
          frameId,
          follow,
          args.resultsVisible ?? state.results_visible,
          args.running ?? state.running,
          audioDevice,
          audio,
          cueTrigger ? crypto.randomUUID() : state.cue_id,
          now,
        ]
      );
    }
  }
  await sql.query(
    'insert into event_presentation_operation(id,event_id,actor_id,input_hash,created_at) values($1,$2,$3,$4,$5)',
    [args.operationId, args.eventId, actor, hash, now]
  );
}
