import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useQuery, useZero } from '@/zero/observed-query';
import { queries } from '../queries';
import { mutators } from '../mutators';
import { serverConfirmed } from '../mutate-with-server-check';
import { studioDocumentV3Schema } from '@/features/communication-studio/logic/document-v3';
import { useLiveStudioState } from './useLiveStudioState';
import type { ShowState, LiveSource } from '@/features/communication-studio/logic/live-contract';
import type { PresentationCommand } from './presentation-schema';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useStudioClient } from './useStudioClient';

export function useEventPresentation(eventId: string, portrait = false) {
  const zero = useZero();
  const studio = useStudioClient();
  const [exportId, setExportId] = useState('');
  const [deviceId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = `polity-show:${eventId}:device`;
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  });
  const [project] = useQuery(queries.studio.eventProject({ eventId }));
  const [row, status] = useQuery(queries.studio.eventPresentation({ eventId }));
  const [manager] = useQuery(queries.studio.eventManager({ eventId }));
  const [stored] = useQuery(project ? queries.studio.document({ id: project.id }) : undefined);
  const [eventSources] = useQuery(queries.studio.liveSources({ refs: [], eventId }));
  const [devices, deviceStatus] = useQuery(
    deviceId ? queries.studio.presentationDevices({ eventId, deviceId }) : undefined
  );
  const [assets] = useQuery(project ? queries.studio.assets({ projectId: project.id }) : undefined);
  const [exports] = useQuery(
    project && manager ? queries.studio.exports({ projectId: project.id }) : undefined
  );
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState(0);
  const state = row as unknown as ShowState | undefined;
  const sent = useRef(0);
  const clockOffset = useRef(0);
  const heartbeatPending = useRef<Promise<boolean> | null>(null);
  const deviceName = useRef('Screen');
  const ownDevice = devices?.find(d => d.id === deviceId);
  useEffect(() => {
    if (ownDevice && sent.current) {
      clockOffset.current = ownDevice.last_seen - (sent.current + Date.now()) / 2;
      setNow(Date.now() + clockOffset.current);
    }
  }, [ownDevice?.last_seen]);
  const parsed = useMemo(
    () => (stored ? studioDocumentV3Schema.safeParse(stored.document) : null),
    [stored?.document]
  );
  const document = parsed?.success ? parsed.data : null;
  deviceName.current = document?.title?.slice(0, 80) || 'Screen';
  const live = useLiveStudioState(document, {
    portrait,
    resultsVisible: state?.results_visible,
    page,
    now,
  });
  const command = useCallback(
    async (input: Omit<PresentationCommand, 'eventId' | 'deviceId' | 'operationId'>) => {
      try {
        await serverConfirmed(
          zero.mutate(
            mutators.studio.presentation({
              ...input,
              eventId,
              deviceId,
              operationId: crypto.randomUUID(),
            })
          )
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : translateText('features.studio.eventLive.commandError')
        );
        throw error;
      }
    },
    [eventId, deviceId, zero]
  );
  useEffect(() => {
    let alive = true;
    setConnectionChecked(false);
    const heartbeat = async () => {
      if (!navigator.onLine) {
        if (alive) {
          setOnline(false);
          setConnectionChecked(true);
        }
        return;
      }
      if (!heartbeatPending.current) {
        sent.current = Date.now();
        heartbeatPending.current = (async () => {
          try {
            await serverConfirmed(
              zero.mutate(
                mutators.studio.presentation({
                  action: 'heartbeat',
                  eventId,
                  deviceId,
                  operationId: crypto.randomUUID(),
                  name: deviceName.current,
                })
              )
            );
            return true;
          } catch {
            return false;
          }
        })().finally(() => {
          heartbeatPending.current = null;
        });
      }
      const connected = await heartbeatPending.current;
      if (alive) {
        setOnline(connected && navigator.onLine);
        setConnectionChecked(true);
      }
    };
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 5000);
    const lost = () => setOnline(false);
    const restored = () => void heartbeat();
    const visible = () => {
      if (window.document.visibilityState === 'visible') void heartbeat();
    };
    window.addEventListener('offline', lost);
    window.addEventListener('online', restored);
    window.addEventListener('focus', restored);
    window.document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('offline', lost);
      window.removeEventListener('online', restored);
      window.removeEventListener('focus', restored);
      window.document.removeEventListener('visibilitychange', visible);
    };
  }, [eventId, deviceId, zero]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setPage(0);
  }, [state?.frame_id]);
  useEffect(() => {
    const t = setInterval(() => setPage(p => p + 1), 10000);
    return () => clearInterval(t);
  }, []);
  const exportSnapshot = async (frameId: string, format: 'png' | 'pdf' | 'pptx') => {
    if (!project || !stored) return;
    try {
      const result = await studio.requestExport({
        projectId: project.id,
        revision: stored.content_revision,
        format,
        pageIds: [frameId],
        snapshot: { portrait, presentation: true },
      });
      setExportId(result.id);
    } catch (error) {
      studio.notifyError(error);
    }
  };
  return {
    project,
    state,
    document,
    projected: live.projected,
    sources: live.sources,
    eventSources: (eventSources ?? []) as unknown as LiveSource[],
    devices: devices ?? [],
    assets: (assets ?? []).map(a => ({
      id: a.id,
      name: a.name,
      mime: a.mime_type,
      url: `/api/studio/media/${a.id}`,
    })),
    deviceId,
    online: online && status.type !== 'error' && deviceStatus.type !== 'error',
    connectionChecking:
      !connectionChecked || (deviceStatus.type !== 'complete' && deviceStatus.type !== 'error'),
    now,
    canManage: Boolean(manager),
    hasControl: state?.controller_device_id === deviceId && Number(state?.lease_until) > now,
    clockOffset: clockOffset.current,
    command,
    page,
    setPage,
    exportSnapshot,
    exportJob: exports?.find(job => job.id === exportId),
  };
}
