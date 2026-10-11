import { translate as translateText } from '@/features/shared/hooks/use-translation';
import {
  lazy,
  Suspense,
  useRef,
  useEffect,
  useState,
  type ComponentProps,
  type RefObject,
} from 'react';
import { useEventPresentation } from '@/zero/communication-studio/useEventPresentation';
import { getStudioRootFramesInLayerOrder } from '@/features/communication-studio/logic/frame-order';
import {
  formatLiveValue,
  hydrateLiveSources,
} from '@/features/communication-studio/logic/live-projection';
import { usePresentationAudio } from '../hooks/usePresentationAudio';
import { useAnimatedStudioDocument } from '../hooks/useAnimatedStudioDocument';
import { Button } from '@/features/shared/ui/ui/button';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import { Slider } from '@/features/shared/ui/ui/slider';
import { StudioLoadingScreen } from '@/features/communication-studio/ui/StudioLoadingScreen';
import { EventLiveFocusContent } from './EventLiveFocusDialog';
import { AgendaVoteSection } from './AgendaVoteSection';
import { AgendaElectionSection } from './AgendaElectionSection';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import type { LiveResult } from '@/features/communication-studio/logic/live-contract';
import type { ShowMode } from '@/features/communication-studio/logic/live-contract';
import {
  getPresentationMusicCredits,
  normalizePresentationAudioPosition,
  parsePresentationBuiltinSelection,
  presentationMusicCredits,
} from '@/features/communication-studio/logic/presentation-audio';
import { PresentationAudioOptions } from '@/features/communication-studio/ui/PresentationAudioOptions';
import './event-presentation.css';

const Canvas = lazy(() => import('@/features/communication-studio/ui/KonvaStudioCanvas'));

function PresentationLoadingScreen() {
  return <StudioLoadingScreen label={translateText('features.studio.eventLive.loading')} />;
}

function usePresentationButtons(root: RefObject<HTMLDivElement | null>, pinned: boolean) {
  const toolbar = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const interaction = useRef({
    hovering: false,
    keyboardFocus: false,
    keyboardInput: true,
    swallowClick: false,
  });
  useEffect(() => {
    const screen = root.current;
    const buttons = toolbar.current;
    if (!screen || !buttons) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let showing = true;
    const held = () => pinned || interaction.current.hovering || interaction.current.keyboardFocus;
    const clear = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const hide = () => {
      clear();
      if (held()) return;
      showing = false;
      setVisible(false);
    };
    const reveal = () => {
      clear();
      showing = true;
      setVisible(true);
      if (!held()) timer = setTimeout(hide, 3000);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') reveal();
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      interaction.current.hovering = false;
      hide();
    };
    const hover = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      interaction.current.hovering = true;
      reveal();
    };
    const unhover = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      interaction.current.hovering = false;
      reveal();
    };
    const press = (event: PointerEvent) => {
      const state = interaction.current;
      state.keyboardInput = false;
      state.keyboardFocus = false;
      state.swallowClick = event.pointerType === 'touch' && !showing;
      if (state.swallowClick) {
        event.preventDefault();
        event.stopPropagation();
      }
      reveal();
    };
    const click = (event: MouseEvent) => {
      if (!interaction.current.swallowClick) return;
      interaction.current.swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const cancel = () => {
      interaction.current.swallowClick = false;
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.key !== 'Tab' &&
        !screen.contains(event.target as Node) &&
        document.fullscreenElement !== screen
      )
        return;
      interaction.current.keyboardInput = true;
      interaction.current.keyboardFocus = buttons.contains(document.activeElement);
      cancel();
      reveal();
    };
    const focus = (event: FocusEvent) => {
      interaction.current.keyboardFocus =
        interaction.current.keyboardInput && buttons.contains(event.target as Node);
      reveal();
    };
    const unfocus = (event: FocusEvent) => {
      interaction.current.keyboardFocus =
        interaction.current.keyboardInput && buttons.contains(event.relatedTarget as Node | null);
      reveal();
    };
    const blur = () => {
      interaction.current.hovering = false;
      hide();
    };
    screen.addEventListener('pointerenter', enter);
    screen.addEventListener('pointermove', reveal);
    screen.addEventListener('pointerleave', leave);
    screen.addEventListener('pointerdown', press, true);
    screen.addEventListener('pointercancel', cancel);
    screen.addEventListener('click', click, true);
    buttons.addEventListener('pointerenter', hover);
    buttons.addEventListener('pointerleave', unhover);
    buttons.addEventListener('focusin', focus);
    buttons.addEventListener('focusout', unfocus);
    document.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', reveal);
    window.addEventListener('blur', blur);
    interaction.current.keyboardFocus =
      interaction.current.keyboardInput && buttons.contains(document.activeElement);
    reveal();
    return () => {
      clear();
      screen.removeEventListener('pointerenter', enter);
      screen.removeEventListener('pointermove', reveal);
      screen.removeEventListener('pointerleave', leave);
      screen.removeEventListener('pointerdown', press, true);
      screen.removeEventListener('pointercancel', cancel);
      screen.removeEventListener('click', click, true);
      buttons.removeEventListener('pointerenter', hover);
      buttons.removeEventListener('pointerleave', unhover);
      buttons.removeEventListener('focusin', focus);
      buttons.removeEventListener('focusout', unfocus);
      document.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', reveal);
      window.removeEventListener('blur', blur);
    };
  }, [root, pinned]);
  return { toolbar, visible };
}

// Reuse the Live Focus result widgets with anonymous aggregate counts. No ballot identities are created.
function PresentationResults({
  result,
  election,
  visible,
}: {
  result?: LiveResult | null;
  election: boolean;
  visible: boolean;
}) {
  if (!result) return null;
  if (!visible)
    return (
      <p role="status" className="bg-card rounded-xl border p-5">
        {translateText('features.studio.eventLive.pendingResult')}
      </p>
    );
  if (election)
    return (
      <AgendaElectionSection
        roleName={result.title}
        electionMode={normalizeElectionMode(result.election_mode)}
        seatCount={result.seat_count}
        candidates={
          result.options.map((option, order_index) => ({
            id: option.id,
            name: option.label,
            order_index,
            user: { first_name: option.label, last_name: '', avatar: option.image_url },
          })) as ComponentProps<typeof AgendaElectionSection>['candidates']
        }
        indicativeSelections={[]}
        finalSelections={[]}
        offlineTallies={result.options.flatMap(option => [
          { candidate_id: option.id, phase: 'indicative', count: option.indicative },
          { candidate_id: option.id, phase: 'final', count: option.final },
        ])}
        attendanceMode={null}
        electionStatus={result.status}
        canVote={false}
        canBeCandidate={false}
        isUserCandidate={false}
        userHasVoted={false}
        userSelectedCandidateIds={[]}
      />
    );
  return (
    <AgendaVoteSection
      voteTitle={result.title}
      choices={
        result.options.map((option, order_index) => ({
          id: option.id,
          label: option.label,
          order_index,
        })) as ComponentProps<typeof AgendaVoteSection>['choices']
      }
      indicativeDecisions={[]}
      finalDecisions={[]}
      offlineTallies={result.options.flatMap(option => [
        { choice_id: option.id, phase: 'indicative', count: option.indicative },
        { choice_id: option.id, phase: 'final', count: option.final },
      ])}
      attendanceMode={null}
      voteStatus={result.status}
      majorityType={result.majority_type}
      totalEligibleVoters={result.eligible}
      userHasVoted={false}
      userSelectedChoiceIds={[]}
    />
  );
}

export function EventPresentation({
  eventId,
  initialMode,
  regie = false,
}: {
  eventId: string;
  initialMode?: ShowMode;
  regie?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [topOffset, setTopOffset] = useState(0);
  const [controls, setControls] = useState(regie);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'pptx'>('pdf');
  const [creditsStatus, setCreditsStatus] = useState('');
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [selectingOutput, setSelectingOutput] = useState(false);
  const show = useEventPresentation(eventId, portrait);
  const selectedOutput = show.devices.find(d => d.id === show.state?.audio_device_id);
  const outputConnected = Boolean(selectedOutput && selectedOutput.last_seen > show.now - 15000);
  const buttons = usePresentationButtons(root, controls && show.canManage);
  const animated = useAnimatedStudioDocument(show.projected);
  const audio = usePresentationAudio(
    show.state,
    show.deviceId,
    show.online && (show.state?.audio_device_id !== show.deviceId || outputConnected),
    show.clockOffset
  );
  const frames = show.projected
    ? getStudioRootFramesInLayerOrder(show.projected).filter(f => f.visible)
    : [];
  const frame =
    frames.find(f => f.id === show.state?.frame_id) ??
    frames.find(f => f.eventSource?.type === 'event') ??
    frames[0];
  const mode = initialMode ?? show.state?.mode ?? 'studio';
  const eventSource = show.eventSources.find(s => s.source_type === 'event');
  const hydratedSources = hydrateLiveSources([
    ...new Map(
      [...show.eventSources, ...(show.sources ?? [])].map(source => [
        `${source.source_type}:${source.source_id}`,
        source,
      ])
    ).values(),
  ]);
  const activeSource = hydratedSources.find(
    s =>
      s.source_type === 'agenda_item' && s.source_id === eventSource?.payload.current_agenda_item_id
  );
  const pageSize = portrait ? 4 : 6;
  const agenda = hydratedSources
    .filter(
      s =>
        s.source_type === 'agenda_item' &&
        !['withdrawn', 'cancelled'].includes(String(s.payload.status))
    )
    .sort((a, b) => Number(a.payload.order_index ?? 1e9) - Number(b.payload.order_index ?? 1e9));
  const focusSource =
    activeSource ?? agenda.find(s => !['completed', 'finished'].includes(String(s.payload.status)));
  const speakerRows = Array.isArray(activeSource?.payload.speakers)
    ? activeSource.payload.speakers.filter(s => !s.completed)
    : [];
  const speakerPage = activeSource
    ? {
        ...activeSource,
        payload: {
          ...activeSource.payload,
          speakers: speakerRows.slice(
            (show.page % Math.max(1, Math.ceil(speakerRows.length / pageSize))) * pageSize,
            ((show.page % Math.max(1, Math.ceil(speakerRows.length / pageSize))) + 1) * pageSize
          ),
        },
      }
    : undefined;
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  useEffect(() => {
    if (!root.current) return;
    const measure = () =>
      setTopOffset(Math.max(0, Math.round(root.current?.getBoundingClientRect().top ?? 0)));
    measure();
    const resize = new ResizeObserver(entries => {
      measure();
      const r = entries[0].contentRect;
      setPortrait(r.height > r.width);
    });
    resize.observe(root.current);
    window.addEventListener('resize', measure);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const act = (input: Parameters<typeof show.command>[0]) => {
    const selecting = input.action === 'control' && input.audioDeviceId !== undefined;
    if (selecting) setSelectingOutput(true);
    const localOutput = show.state?.audio_device_id === show.deviceId;
    if (
      (input.action === 'claim' && (localOutput || !outputConnected)) ||
      (input.action === 'control' &&
        (input.audioDeviceId === show.deviceId ||
          (localOutput && (input.running === true || input.audio?.status === 'playing'))))
    )
      void audio.activate();
    void show
      .command(input)
      .catch(() => {
        /* The shared command hook reports failures to the user. */
      })
      .finally(() => {
        if (selecting) setSelectingOutput(false);
      });
  };
  const start = async () => {
    if (document.fullscreenElement === root.current) {
      try {
        await document.exitFullscreen();
      } catch {
        /* The fullscreenchange listener retains the actual browser state. */
      }
      return;
    }
    if (show.state?.audio_device_id === show.deviceId) void audio.activate();
    try {
      await root.current?.requestFullscreen?.();
    } catch {
      /* CSS still fills the available screen. */
    }
  };
  const color = show.document?.theme[show.document.theme.mode];
  const music = [
    ...new Map(
      [
        ...getPresentationMusicCredits(show.state?.audio.builtin),
        ...getPresentationMusicCredits(show.state?.audio.transition?.builtin),
      ].map(track => [track.id, track])
    ).values(),
  ];
  const audioPosition = () =>
    normalizePresentationAudioPosition(
      show.state?.audio ?? {},
      (show.state?.audio.position ?? 0) +
        (show.state?.audio.status === 'playing'
          ? Math.max(0, (show.now - (show.state.audio.at ?? show.now)) / 1000)
          : 0)
    );
  return (
    <div
      ref={root}
      className="polity-event-screen bg-background text-foreground relative flex h-[100dvh] w-full flex-col overflow-hidden"
      style={{
        height: fullscreen
          ? '100dvh'
          : `calc(100dvh - ${topOffset + 1}px - var(--app-shell-mobile-bottom-offset, 0px))`,
        ...(mode === 'agenda'
          ? {}
          : { background: color?.background ?? '#0a1420', color: color?.foreground ?? '#fff' }),
      }}
    >
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        {!show.online && (
          <span role="status" className="rounded bg-amber-600 p-2 text-white">
            {translateText('features.studio.eventLive.disconnected')}
          </span>
        )}
        {show.canManage &&
          show.state?.audio_device_id &&
          (show.connectionChecking || !outputConnected) && (
            <span role="status" className="rounded bg-amber-600 p-2 text-white">
              {translateText(
                show.connectionChecking
                  ? 'features.studio.eventLive.audioConnecting'
                  : 'features.studio.eventLive.audioDisconnected'
              )}
            </span>
          )}
        <div
          ref={buttons.toolbar}
          className="polity-presentation-buttons flex gap-2"
          data-visible={buttons.visible}
        >
          <Button
            variant="outline"
            data-action-id="event.show.fullscreen"
            onClick={() => void start()}
          >
            {translateText(
              fullscreen
                ? 'features.studio.eventLive.exitFullscreen'
                : 'features.studio.eventLive.fullscreen'
            )}
          </Button>
          {show.state?.audio_device_id === show.deviceId &&
            (audio.enabled || audio.status === 'activating' ? (
              <span
                role="status"
                className="bg-background text-foreground rounded border px-3 py-2 text-sm"
              >
                {translateText(
                  audio.enabled
                    ? 'features.studio.eventLive.audioReady'
                    : 'features.studio.eventLive.audioActivating'
                )}
              </span>
            ) : (
              <>
                {audio.error && (
                  <span
                    role="status"
                    className="bg-background text-foreground rounded border px-3 py-2 text-sm"
                  >
                    {audio.error}
                  </span>
                )}
                <Button
                  variant="outline"
                  data-action-id="event.show.audio.activate"
                  disabled={!show.online || !outputConnected}
                  onClick={() => void audio.activate()}
                >
                  {translateText(
                    audio.status === 'error'
                      ? 'features.studio.eventLive.audioRetry'
                      : 'features.studio.eventLive.activateAudio'
                  )}
                </Button>
              </>
            ))}
          {show.canManage && show.hasControl && show.state?.audio_device_id !== show.deviceId && (
            <Button
              variant="outline"
              data-action-id="event.show.audio.here"
              disabled={!show.online || show.connectionChecking || selectingOutput}
              onClick={() => act({ action: 'control', audioDeviceId: show.deviceId })}
            >
              {translateText('features.studio.eventLive.audioHere')}
            </Button>
          )}
          {show.canManage && (
            <Button
              variant="outline"
              data-action-id="event.show.controls"
              onClick={() => setControls(v => !v)}
            >
              {translateText('features.studio.eventLive.controls')}
            </Button>
          )}
        </div>
      </div>
      <main
        className="min-h-0 flex-1"
        aria-label={translateText('features.studio.eventLive.presentation')}
      >
        {!show.projected ? (
          <PresentationLoadingScreen />
        ) : mode === 'studio' && frame ? (
          <div
            key={frame.id}
            className={`h-full polity-show-${(frame.intro ? frame.intro.mode !== 'static' : frame.eventSource?.template === 'cover') ? 'none' : (frame.showAnimation?.preset ?? 'fade')}`}
            style={{ animationDuration: `${frame.showAnimation?.duration ?? 0.8}s` }}
          >
            <Suspense fallback={<PresentationLoadingScreen />}>
              <Canvas
                clockOffset={show.clockOffset}
                showCue={`${frame.id}:${show.state?.cue_id ?? ''}`}
                document={animated ?? show.projected}
                activeFrameId={frame.id}
                fit="contain"
                assets={show.assets}
                selected={[]}
                editable={false}
                guides={false}
              />
            </Suspense>
          </div>
        ) : mode === 'agenda' ? (
          <div className="flex h-full min-h-0 flex-col pt-16">
            <EventLiveFocusContent
              t={translateText}
              currentAgendaItem={
                focusSource
                  ? {
                      id: focusSource.source_id,
                      ...focusSource.payload,
                      description: focusSource.payload.details,
                    }
                  : null
              }
              currentAgendaItemTopNumber={
                focusSource
                  ? agenda.findIndex(s => s.source_id === focusSource.source_id) + 1
                  : undefined
              }
              streamRuntimeStatus={focusSource ? String(focusSource.payload.status) : null}
              streamIsLive={Boolean(
                activeSource &&
                ['active', 'in-progress'].includes(String(activeSource.payload.status))
              )}
              eventStartTimestamp={
                typeof eventSource?.payload.start_time === 'number'
                  ? eventSource.payload.start_time
                  : undefined
              }
              speakerList={[]}
              showSpeakers={false}
              canManageAgenda={false}
              showLivestream={false}
              votingWorkspace={
                <PresentationResults
                  result={focusSource?.payload.results}
                  election={
                    focusSource?.payload.result_source_type === 'election' ||
                    focusSource?.payload.type === 'election'
                  }
                  visible={show.state?.results_visible !== false}
                />
              }
            />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-8 py-20">
            <h1 className="mb-8 text-4xl font-semibold">
              {translateText('features.studio.eventLive.speakers')}
            </h1>
            <div className="text-3xl leading-loose whitespace-pre-line">
              {activeSource
                ? formatLiveValue(
                    {
                      sourceType: activeSource.source_type,
                      sourceId: activeSource.source_id,
                      field: 'speakers',
                      format: 'speakers',
                    },
                    speakerPage,
                    show.now
                  )
                : translateText('features.studio.eventLive.emptySpeakers')}
            </div>
          </div>
        )}
      </main>
      {controls && show.canManage && (
        <aside className="bg-background text-foreground z-20 max-h-[40dvh] overflow-auto border-t p-4">
          <div className="flex flex-wrap items-center gap-3">
            {!show.hasControl ? (
              <Button
                data-action-id="event.show.claim"
                onClick={() =>
                  act({ action: 'claim', takeover: Boolean(show.state?.controller_device_id) })
                }
              >
                {show.state?.controller_device_id
                  ? translateText('features.studio.eventLive.takeover')
                  : translateText('features.studio.eventLive.claim')}
              </Button>
            ) : (
              <>
                <Button
                  data-action-id="event.show.follow"
                  onClick={() => act({ action: 'control', followAgenda: true })}
                >
                  {translateText('features.studio.eventLive.follow')}
                </Button>
                <select
                  data-action-id="event.show.select1.change"
                  aria-label={translateText('features.studio.eventLive.display')}
                  className="bg-background rounded border p-2"
                  value={show.state?.mode}
                  onChange={e => act({ action: 'control', mode: e.target.value as ShowMode })}
                >
                  <option value="studio">
                    {translateText('features.studio.eventLive.studio')}
                  </option>
                  <option value="agenda">
                    {translateText('features.studio.eventLive.agenda')}
                  </option>
                  <option value="speakers">
                    {translateText('features.studio.eventLive.speakers')}
                  </option>
                </select>
                <select
                  data-action-id="event.show.select2.change"
                  aria-label={translateText('features.studio.eventLive.frame')}
                  className="bg-background max-w-xs rounded border p-2"
                  value={frame?.id}
                  onChange={e => act({ action: 'control', frameId: e.target.value })}
                >
                  {frames.map(f => (
                    <option key={f.id} value={f.id}>
                      {String(
                        show.eventSources.find(s => s.source_id === f.eventSource?.id)?.payload
                          .title || f.name
                      )}
                    </option>
                  ))}
                </select>
                <Button
                  data-action-id="event.show.previous"
                  onClick={() => {
                    const i = frames.findIndex(f => f.id === frame?.id);
                    if (i > 0) act({ action: 'control', frameId: frames[i - 1].id });
                  }}
                >
                  {translateText('features.studio.eventLive.previous')}
                </Button>
                <Button
                  data-action-id="event.show.next"
                  onClick={() => {
                    const i = frames.findIndex(f => f.id === frame?.id);
                    if (i < frames.length - 1)
                      act({ action: 'control', frameId: frames[i + 1].id });
                  }}
                >
                  {translateText('features.studio.eventLive.next')}
                </Button>
                <Button
                  data-action-id="event.show.reveal"
                  onClick={() =>
                    act({ action: 'control', resultsVisible: !show.state?.results_visible })
                  }
                >
                  {show.state?.results_visible
                    ? translateText('features.studio.eventLive.hide')
                    : translateText('features.studio.eventLive.reveal')}
                </Button>
                <Button
                  data-action-id="event.show.running"
                  onClick={() => act({ action: 'control', running: !show.state?.running })}
                >
                  {show.state?.running
                    ? translateText('features.studio.eventLive.stop')
                    : translateText('features.studio.eventLive.start')}
                </Button>
                <Button
                  variant="outline"
                  data-action-id="event.show.release"
                  onClick={() => act({ action: 'release' })}
                >
                  {translateText('features.studio.eventLive.release')}
                </Button>
              </>
            )}
            <Button asChild variant="outline" data-action-scope="presentation">
              <a
                data-action-id="event.show.viewer.open"
                href={`/event/${eventId}/presentation`}
                target="_blank"
                rel="noreferrer"
              >
                {translateText('features.studio.eventLive.viewer')}
              </a>
            </Button>
            <Button asChild variant="outline" data-action-scope="presentation">
              <a data-action-id="event.show.editor.open" href={`/studio/${show.project?.id}`}>
                {translateText('features.studio.eventLive.editor')}
              </a>
            </Button>
            <Button
              variant="outline"
              data-action-id="event.show.audio.credits.copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(presentationMusicCredits());
                  setCreditsStatus(translateText('features.studio.eventLive.creditsCopied'));
                } catch {
                  setCreditsStatus(translateText('features.studio.eventLive.creditsCopyFailed'));
                }
              }}
            >
              {translateText('features.studio.eventLive.copyMusicCredits')}
            </Button>
            {creditsStatus && <span role="status">{creditsStatus}</span>}
            <select
              data-action-id="event.show.select3.change"
              aria-label={translateText('features.studio.eventLive.snapshotFormat')}
              value={exportFormat}
              className="bg-background rounded border p-2"
              onChange={e => setExportFormat(e.target.value as typeof exportFormat)}
            >
              <option value="png">
                {translateText('features.studio.eventLive.snapshotFormats.png')}
              </option>
              <option value="pdf">
                {translateText('features.studio.eventLive.snapshotFormats.pdf')}
              </option>
              <option value="pptx">
                {translateText('features.studio.eventLive.snapshotFormats.pptx')}
              </option>
            </select>
            <Button
              data-action-id="event.show.export"
              disabled={
                !frame ||
                show.exportJob?.status === 'queued' ||
                show.exportJob?.status === 'running'
              }
              onClick={() => frame && void show.exportSnapshot(frame.id, exportFormat)}
            >
              {translateText('features.studio.eventLive.snapshot')}
            </Button>
            {show.exportJob?.status === 'completed' && (
              <a
                className="underline"
                data-action-id="event.show.export.download"
                href={`/api/studio/exports/${show.exportJob.id}`}
                download
              >
                {translateText('features.studio.eventLive.download')}
              </a>
            )}
            {show.exportJob && show.exportJob.status !== 'completed' && (
              <span role="status">
                {show.exportJob.error || `${show.exportJob.status} · ${show.exportJob.progress}%`}
              </span>
            )}
          </div>
          {show.hasControl && (
            <div className="mt-3 flex flex-wrap gap-3">
              <label>
                {translateText('features.studio.eventLive.output')}
                <select
                  data-action-id="event.show.select4.change"
                  className="bg-background mx-2 rounded border p-2"
                  value={show.state?.audio_device_id ?? ''}
                  disabled={!show.online || show.connectionChecking || selectingOutput}
                  onChange={e => act({ action: 'control', audioDeviceId: e.target.value || null })}
                >
                  <option value="">{translateText('features.studio.eventLive.silent')}</option>
                  {show.state?.audio_device_id && !outputConnected && (
                    <option value={show.state.audio_device_id} disabled>
                      {show.state.audio_device_id === show.deviceId
                        ? translateText('features.studio.eventLive.thisDevice')
                        : (selectedOutput?.name ??
                          translateText('features.studio.eventLive.output'))}{' '}
                      ·{' '}
                      {translateText(
                        show.connectionChecking
                          ? 'features.studio.eventLive.audioConnecting'
                          : 'features.studio.eventLive.audioDisconnected'
                      )}
                    </option>
                  )}
                  {show.devices
                    .filter(d => d.last_seen > show.now - 15000)
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.id === show.deviceId
                          ? translateText('features.studio.eventLive.thisDevice')
                          : d.name}
                      </option>
                    ))}
                </select>
              </label>
              <select
                data-action-id="event.show.select5.change"
                aria-label={translateText('features.studio.eventLive.music')}
                className="bg-background max-w-full min-w-0 rounded border p-2"
                value={
                  show.state?.audio.builtin
                    ? `builtin:${show.state.audio.builtin}`
                    : (show.state?.audio.assetId ?? '')
                }
                onChange={e => {
                  if (!e.target.value) return;
                  const builtin = parsePresentationBuiltinSelection(e.target.value);
                  act({
                    action: 'control',
                    audio: builtin
                      ? {
                          builtin,
                          status: 'playing',
                          position: 0,
                          loop: builtin !== 'test-tone',
                          ...(builtin !== 'test-tone' ? { volume: 0.65 } : {}),
                          fadeSeconds: builtin === 'test-tone' ? 0.05 : 1,
                        }
                      : { assetId: e.target.value, status: 'playing' },
                    running: true,
                  });
                }}
              >
                <option value="">{translateText('features.studio.eventLive.selectMusic')}</option>
                <PresentationAudioOptions assets={show.assets} />
              </select>
              {['playing', 'paused', 'stopped'].map(status => (
                <Button
                  key={status}
                  data-action-id={`event.show.audio.${status}`}
                  onClick={() =>
                    act({
                      action: 'control',
                      audio: {
                        ...show.state?.audio,
                        status: status as 'playing',
                        position:
                          status === 'stopped' ||
                          (status === 'playing' && show.state?.audio.builtin === 'test-tone')
                            ? 0
                            : audioPosition(),
                      },
                    })
                  }
                >
                  {status === 'playing' ? 'Play' : status === 'paused' ? 'Pause' : 'Stop'}
                </Button>
              ))}
              <label className="flex items-center gap-2">
                <Checkbox
                  data-action-id="event.show.audio.loop"
                  checked={!!show.state?.audio.loop && show.state?.audio.builtin !== 'test-tone'}
                  disabled={
                    (!show.state?.audio.assetId && !show.state?.audio.builtin) ||
                    show.state?.audio.builtin === 'test-tone'
                  }
                  onCheckedChange={checked =>
                    act({
                      action: 'control',
                      audio: {
                        status:
                          show.state?.audio.status === 'playing'
                            ? 'playing'
                            : show.state?.audio.status === 'paused'
                              ? 'paused'
                              : 'stopped',
                        loop: checked === true,
                      },
                    })
                  }
                />
                {translateText('features.studio.eventLive.loop')}
              </label>
              <div className="flex min-w-48 items-center gap-3">
                <span id="presentation-volume-label" className="whitespace-nowrap">
                  {translateText('features.studio.eventLive.volume')}{' '}
                  {Math.round((volumeDraft ?? show.state?.audio.volume ?? 0.65) * 100)} %
                </span>
                <Slider
                  aria-labelledby="presentation-volume-label"
                  className="w-32"
                  data-action-id="event.show.input1.change"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[volumeDraft ?? show.state?.audio.volume ?? 0.65]}
                  onValueChange={([value]) => setVolumeDraft(value)}
                  onValueCommit={([value]) => {
                    void show
                      .command({
                        action: 'control',
                        audio: {
                          ...show.state?.audio,
                          status: (show.state?.audio.status as 'playing') || 'paused',
                          volume: value,
                          position: audioPosition(),
                        },
                      })
                      .catch(() => {
                        /* The command hook reports errors. */
                      })
                      .finally(() => setVolumeDraft(null));
                  }}
                />
              </div>
            </div>
          )}
        </aside>
      )}
      {music.length > 0 && (
        <footer
          aria-label={translateText('features.studio.eventLive.musicCredits')}
          className="bg-background text-foreground shrink-0 border-t px-3 py-2 text-center text-xs leading-relaxed sm:text-sm"
        >
          {music.map(track => (
            <span key={track.id} className="inline-block px-2">
              <a
                data-action-id="event.show.audio.credit.source"
                className="underline underline-offset-2"
                href={track.source}
                target="_blank"
                rel="noreferrer"
              >
                {track.title}
              </a>
              {' · '}
              {track.author}
              {' · '}
              <a
                data-action-id="event.show.audio.credit.license"
                className="underline underline-offset-2"
                href={track.license.url}
                target="_blank"
                rel="noreferrer"
              >
                {track.license.name}
              </a>
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
