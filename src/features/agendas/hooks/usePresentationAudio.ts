import { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '@/features/shared/hooks/use-translation';
import type { ShowState } from '@/features/communication-studio/logic/live-contract';
import {
  classifyPresentationAudioFailure,
  createPresentationAudioPlayer,
  type PresentationAudioFailure,
} from '@/features/communication-studio/logic/presentation-audio-player';

export type PresentationAudioStatus = 'idle' | 'activating' | 'ready' | 'blocked' | 'error';

/** Audio is exclusive to the selected output; browser restrictions require a local gesture. */
export function usePresentationAudio(
  state: ShowState | undefined,
  deviceId: string,
  online: boolean,
  clockOffset = 0
) {
  const player = useRef<ReturnType<typeof createPresentationAudioPlayer> | null>(null);
  const latest = useRef({ state, deviceId, online, clockOffset });
  latest.current = { state, deviceId, online, clockOffset };
  const mounted = useRef(true);
  const statusRef = useRef<PresentationAudioStatus>('idle');
  const attempted = useRef(false);
  const pending = useRef<{
    promise: Promise<void>;
    manual: boolean;
    output: string | null | undefined;
    deviceId: string;
  } | null>(null);
  const [status, setStatus] = useState<PresentationAudioStatus>('idle');
  const [error, setError] = useState('');
  const changeStatus = useCallback((next: PresentationAudioStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);
  const synchronize = useCallback(() => {
    const { state: s, deviceId: id, online: connected, clockOffset: offset } = latest.current;
    player.current?.update(
      s?.audio ?? {},
      !!(
        statusRef.current === 'ready' &&
        connected &&
        s?.audio_device_id === id &&
        s.running &&
        Number(s.lease_until) > Date.now() + offset
      ),
      offset,
      Number(s?.lease_until ?? 0)
    );
  }, []);
  const begin = useCallback(
    (manual: boolean): Promise<void> => {
      if (!mounted.current || !latest.current.online) return Promise.resolve();
      if (statusRef.current === 'ready') {
        synchronize();
        return Promise.resolve();
      }
      if (pending.current && (!manual || pending.current.manual)) return pending.current.promise;
      // A gesture supersedes an automatic attempt, so play() happens inside the click.
      player.current?.dispose();
      attempted.current = true;
      changeStatus('activating');
      setError('');
      const fail = (reason: PresentationAudioFailure) => {
        changeStatus(reason === 'blocked' ? 'blocked' : 'error');
        setError(
          translate(
            `features.studio.eventLive.${reason === 'blocked' ? 'audioPermission' : 'audioError'}`
          )
        );
        instance.dispose();
        player.current = null;
        pending.current = null;
      };
      const instance = createPresentationAudioPlayer((failed, reason) => {
        if (mounted.current && player.current === instance && failed) fail(reason ?? 'media');
      });
      player.current = instance;
      const promise = instance
        .activate()
        .then(() => {
          if (!mounted.current || player.current !== instance) return;
          pending.current = null;
          changeStatus('ready');
          setError('');
          synchronize();
        })
        .catch(cause => {
          if (mounted.current && player.current === instance)
            fail(classifyPresentationAudioFailure(cause));
        });
      pending.current = {
        promise,
        manual,
        output: latest.current.state?.audio_device_id,
        deviceId: latest.current.deviceId,
      };
      return promise;
    },
    [changeStatus, synchronize]
  );
  const activate = useCallback(() => begin(true), [begin]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      player.current?.dispose();
      player.current = null;
      pending.current = null;
      attempted.current = false;
      statusRef.current = 'idle';
    };
  }, []);
  useEffect(() => {
    const attempt = pending.current;
    if (
      attempt &&
      (!online ||
        attempt.deviceId !== deviceId ||
        (state?.audio_device_id !== attempt.output && state?.audio_device_id !== deviceId))
    ) {
      player.current?.dispose();
      player.current = null;
      pending.current = null;
      attempted.current = false;
      changeStatus('idle');
    }
    if (online && state?.audio_device_id === deviceId && !attempted.current) void begin(false);
    synchronize();
  }, [
    state?.audio,
    state?.audio_device_id,
    state?.running,
    state?.lease_until,
    deviceId,
    online,
    clockOffset,
    begin,
    changeStatus,
    synchronize,
  ]);
  return { status, enabled: status === 'ready', error, activate };
}
