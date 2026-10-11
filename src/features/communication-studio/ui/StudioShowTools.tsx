import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Music,
  Play,
  Film,
  Frame,
  ChevronDown,
  ChevronRight,
  Plus,
  PencilLine,
  Trash2,
  Sparkles,
  ArrowRightLeft,
  Presentation,
  Flag,
  Vote,
  LockKeyhole,
  Eye,
  Pause,
  Square,
} from 'lucide-react';
import { InlineNotice } from '@/features/shared/ui/feedback';
import { FileDropzone } from '@/features/file-upload/ui/FileDropzone';
import { buildStudioLayerTree } from './StudioLayersPanel';
import { getStudioRootFramesInLayerOrder } from '../logic/frame-order';
import { translate } from '@/features/shared/hooks/use-translation';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/features/shared/ui/ui/tooltip';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Slider } from '@/features/shared/ui/ui/slider';
import { Checkbox } from '@/features/shared/ui/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/features/shared/ui/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/features/shared/ui/ui/sheet';
import type { FrameNode, StudioDocumentV3, StudioNode } from '../logic/document-v3';
import {
  showCueSchema,
  type ShowCue,
  type LiveSource,
  type ShowState,
} from '../logic/live-contract';
import { frameIntro, defaultEventIntro } from '../logic/event-intro';
import { projectLiveDocument } from '../logic/live-projection';
import {
  getPresentationBuiltin,
  getPresentationMusicCredits,
  presentationMusic,
  parsePresentationBuiltinSelection,
} from '../logic/presentation-audio';
import {
  cueChannel,
  cueScope,
  cueFadeIn,
  cueFadeOut,
  conflictingCue,
  audioPosition,
} from '../logic/show-cues';
import { createPresentationAudioPlayer } from '../logic/presentation-audio-player';
import { createIntroPlayer } from '../logic/event-intro-player';
import { useStudioMobile } from './StudioPanel';

const Canvas = lazy(() => import('./KonvaStudioCanvas'));
const t = (key: string, values?: Record<string, string | number>) =>
  translate(`features.studio.showTools.${key}`, values);
const live = (key: string) => translate(`features.studio.eventLive.${key}`);
interface Asset {
  id: string;
  name: string;
  mime: string;
}
interface Option {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export function ShowSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const groups = [...new Set(options.map(o => o.group ?? ''))];
  return (
    <div className="space-y-1.5">
      <label id={id} className="text-sm font-medium">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder={t('chooseSource')} />
        </SelectTrigger>
        <SelectContent data-studio-show-select className="z-[100]">
          {groups.map(group => (
            <SelectGroup key={group}>
              {group && <SelectLabel>{group}</SelectLabel>}
              {options
                .filter(o => (o.group ?? '') === group)
                .map(o => (
                  <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="z-[110]">{label}</TooltipContent>
    </Tooltip>
  );
}
function ShowDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const mobile = useStudioMobile();
  const description = t('previewHelp');
  if (mobile)
    return (
      <Sheet
        open
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          data-studio-show-dialog
          side="bottom"
          className="z-[80] flex max-h-[94dvh] flex-col gap-3 overflow-auto p-4"
        >
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    );
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        data-studio-show-dialog
        className="z-[80] flex max-h-[90dvh] max-w-2xl flex-col overflow-auto"
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max = 30,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      <Input
        type="number"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={e => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}
function PercentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <span id={id} className="text-sm font-medium">
        {label} {Math.round(value * 100)} %
      </span>
      <Slider
        aria-labelledby={id}
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function useLocalPreview() {
  const mixer = useRef<ReturnType<typeof createPresentationAudioPlayer> | null>(null);
  const specification = useRef<ShowState['audio']>({});
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const stop = () => {
    mixer.current?.dispose();
    mixer.current = null;
    specification.current = {};
    setPlaying(false);
    setError('');
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      mixer.current?.dispose();
      mixer.current = null;
    };
  }, []);
  const play = async (audio: ShowState['audio']) => {
    setError('');
    try {
      if (!mixer.current) {
        const instance = createPresentationAudioPlayer(failed =>
          setError(failed ? t('previewError') : '')
        );
        mixer.current = instance;
        await instance.activate();
        if (mixer.current !== instance) return;
      }
      const started = Date.now();
      const localAudio = {
        ...audio,
        at: started,
        ...(audio.transition ? { transition: { ...audio.transition, at: started } } : {}),
      };
      specification.current = localAudio;
      mixer.current.update(localAudio, true);
      setError('');
      setPlaying(true);
    } catch {
      stop();
      setError(t('previewError'));
    }
  };
  const pause = () => {
    const spec = specification.current;
    specification.current = {
      ...spec,
      status: 'paused',
      position: audioPosition(spec, Date.now()),
      at: Date.now(),
      transition: undefined,
    };
    mixer.current?.update(specification.current, true);
    setPlaying(false);
  };
  return { playing, error, play, pause, stop };
}
function cueAudio(cue: ShowCue): ShowState['audio'] {
  return {
    ...(cue.builtin ? { builtin: cue.builtin } : { assetId: cue.assetId }),
    status: cue.action === 'play' ? 'playing' : cue.action === 'pause' ? 'paused' : 'stopped',
    position: 0,
    at: Date.now(),
    volume: cue.volume,
    loop: cueChannel(cue) === 'music' && cue.loop,
    fadeInSeconds: cueFadeIn(cue),
    fadeOutSeconds: cueFadeOut(cue),
    ...(cueChannel(cue) === 'transition' ? { durationSeconds: cue.durationSeconds ?? 3 } : {}),
    cueId: crypto.randomUUID(),
  };
}
function sourceTitle(cue: ShowCue, assets: Asset[]) {
  if (cue.action !== 'play') return t(cue.action);
  if (cue.builtin === 'cinematic-sequence') return live('cinematicSequence');
  if (cue.builtin === 'test-tone') return live('testTone');
  const builtin = getPresentationBuiltin(cue.builtin);
  return builtin && 'title' in builtin
    ? builtin.title
    : (assets.find(a => a.id === cue.assetId)?.name ?? t('missing'));
}
function AudioDuration({ assetId, builtin }: { assetId?: string; builtin?: string }) {
  const [duration, setDuration] = useState<number>();
  useEffect(() => {
    setDuration(undefined);
    if (!assetId) return;
    const media = new Audio();
    const ready = () => {
      if (Number.isFinite(media.duration)) setDuration(media.duration);
    };
    media.preload = 'metadata';
    media.addEventListener('loadedmetadata', ready);
    media.src = `/api/studio/media/${assetId}`;
    return () => {
      media.removeEventListener('loadedmetadata', ready);
      media.pause();
      media.removeAttribute('src');
      media.load();
    };
  }, [assetId]);
  const value = getPresentationBuiltin(builtin)?.duration ?? duration;
  return (
    <p className="text-muted-foreground text-xs">
      {value === undefined
        ? t('durationUnknown')
        : t('sourceDuration', {
            duration: `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`,
          })}
    </p>
  );
}
function MusicCredits({ builtin }: { builtin?: string }) {
  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      {getPresentationMusicCredits(builtin).map(track => (
        <p key={track.id}>
          {track.title} · {track.author} ·{' '}
          <a href={track.source} target="_blank" rel="noreferrer" className="underline">
            {t('creditSource')}
          </a>{' '}
          ·{' '}
          <a href={track.license.url} target="_blank" rel="noreferrer" className="underline">
            {track.license.name}
          </a>
        </p>
      ))}
    </div>
  );
}
function SceneThumbnail({
  scene,
  theme,
}: {
  scene: NonNullable<FrameNode['intro']>['scene'];
  theme: StudioDocumentV3['theme'];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const dispose = createIntroPlayer(
      canvas.current,
      { ...defaultEventIntro, scene, snapshotAt: 15000, epochMs: 0 },
      theme,
      undefined,
      () => 15000,
      () => {
        /* The thumbnail renders one frozen frame. */
      }
    );
    dispose();
  }, [scene, theme]);
  return (
    <canvas
      ref={canvas}
      width={160}
      height={90}
      className="aspect-video w-full rounded"
      aria-hidden
    />
  );
}

function FramePreview({
  document,
  frameId,
  sources,
  assets,
  portrait,
  running = false,
  elapsed = 0,
  replay = 0,
  animateElements = false,
}: {
  document: StudioDocumentV3;
  frameId: string;
  sources: LiveSource[];
  assets: Asset[];
  portrait: boolean;
  running?: boolean;
  elapsed?: number;
  replay?: number;
  animateElements?: boolean;
}) {
  const [position, setPosition] = useState(elapsed / 1000);
  useEffect(() => {
    setPosition(elapsed / 1000);
    if (!running) return;
    const started = performance.now();
    let id = 0,
      previous = 0;
    const tick = (now: number) => {
      if (now - previous >= 50) {
        setPosition((elapsed + now - started) / 1000);
        previous = now;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running, elapsed, replay]);
  const epoch = useMemo(() => Date.now() - elapsed, [running, elapsed, replay]);
  const second = Math.floor(position);
  const projected = useMemo(() => {
    const d = projectLiveDocument(document, sources, { now: Date.now(), portrait });
    const f = d.nodes.find(n => n.id === frameId && n.type === 'frame') as FrameNode | undefined;
    if (f) {
      const intro = frameIntro(f);
      if (intro)
        f.intro = {
          ...intro,
          epochMs: epoch,
          ...(running ? { snapshotAt: undefined } : { snapshotAt: Date.now() }),
        };
    }
    return d;
  }, [document, frameId, sources, portrait, running, elapsed, replay, epoch, second]);
  return (
    <div
      className={`bg-muted overflow-hidden rounded border ${portrait ? 'aspect-[9/16] max-h-96' : 'aspect-video'}`}
    >
      <Suspense fallback={<span>{live('load')}</span>}>
        <Canvas
          document={projected}
          activeFrameId={frameId}
          assets={assets.map(a => ({ ...a, url: `/api/studio/media/${a.id}` }))}
          selected={[]}
          editable={false}
          fit="contain"
          guides={false}
          showCue={animateElements ? `preview:${replay}` : undefined}
          showPosition={animateElements ? position : undefined}
        />
      </Suspense>
    </div>
  );
}

type AnimationDraft =
  | { targetId: string; kind: 'background'; intro: NonNullable<FrameNode['intro']> }
  | { targetId: string; kind: 'element'; animation: NonNullable<StudioNode['showAnimation']> };

export function StudioShowTools({
  document,
  frameId,
  selectedId,
  selectedNodeIds = selectedId ? [selectedId] : [],
  onSelect,
  sources,
  assets,
  update,
  portrait,
  disabled = false,
  onUpload,
}: {
  document: StudioDocumentV3;
  frameId: string;
  selectedId?: string;
  selectedNodeIds?: string[];
  onSelect?: (node: StudioNode, rootFrameId: string) => void;
  sources: LiveSource[];
  assets: Asset[];
  update: (edit: (d: StudioDocumentV3) => void) => unknown;
  portrait: boolean;
  disabled?: boolean;
  onUpload?: (file: File, background?: boolean) => Promise<Asset | undefined>;
}) {
  const frames = getStudioRootFramesInLayerOrder(document);
  const layers = useMemo(() => buildStudioLayerTree(document), [document]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([frameId]));
  useEffect(() => {
    setExpanded(old => new Set([...old, frameId]));
  }, [frameId, selectedId]);
  const frame = frames.find(f => f.id === frameId);
  const rules = document.show?.cues ?? [];
  const [draft, setDraft] = useState<ShowCue | null>(null);
  const [animation, setAnimation] = useState<AnimationDraft | null>(null);
  const [removed, setRemoved] = useState<{
    kind: 'rule' | 'animation';
    restore: (d: StudioDocumentV3) => void;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [replay, setReplay] = useState(0);
  const [withAudio, setWithAudio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const uploadGeneration = useRef(0);
  const audioPreview = useLocalPreview();
  const closeEditor = () => {
    uploadGeneration.current++;
    setUploading(false);
    audioPreview.stop();
    setDraft(null);
    setAnimation(null);
    setPreviewOpen(false);
    setRunning(false);
    setWithAudio(false);
    setElapsed(0);
    setUploadError('');
  };
  useEffect(() => {
    if (disabled) audioPreview.stop();
  }, [disabled]);
  useEffect(() => {
    const pause = () => {
      if (window.document.hidden) setRunning(false);
    };
    window.document.addEventListener('visibilitychange', pause);
    return () => window.document.removeEventListener('visibilitychange', pause);
  }, []);
  const previewDocument = useMemo(() => {
    const d = structuredClone(document);
    if (draft) {
      d.show ??= { order: 'agenda', cues: [] };
      d.show.cues = [...d.show.cues.filter(c => c.id !== draft.id), draft];
    }
    if (animation) {
      const n = d.nodes.find(n => n.id === animation.targetId);
      if (n && animation.kind === 'element') n.showAnimation = animation.animation;
      if (n?.type === 'frame' && animation.kind === 'background') n.intro = animation.intro;
    }
    return d;
  }, [document, draft, animation]);
  const targetFrameId =
    draft?.scope !== 'global' && draft?.frameId
      ? draft.frameId
      : animation
        ? (layers.find(l => l.node.id === animation.targetId)?.rootFrameId ?? frameId)
        : frameId;
  const targetFrame = frames.find(f => f.id === targetFrameId);
  const targetSource = sources.find(s => s.source_id === targetFrame?.eventSource?.id);
  const missing =
    draft?.action === 'play' &&
    !!draft.assetId &&
    !assets.some(a => a.id === draft.assetId && a.mime.startsWith('audio/'));
  const validDraft =
    draft &&
    showCueSchema.safeParse(draft).success &&
    !missing &&
    (cueScope(draft) === 'global' || frames.some(f => f.id === draft.frameId));
  const conflict = draft && conflictingCue(rules, draft);
  const intro = targetFrame && frameIntro(targetFrame);
  const add = (
    channel: 'music' | 'transition',
    targetId = frameId,
    scope: 'frame' | 'global' = 'frame'
  ) => {
    audioPreview.stop();
    setDraft({
      id: crypto.randomUUID(),
      frameId: scope === 'global' ? undefined : targetId,
      scope,
      channel,
      trigger: 'enter',
      action: 'play',
      volume: 0.65,
      loop: channel === 'music',
      fadeSeconds: 1,
      fadeInSeconds: 1,
      fadeOutSeconds: 1,
      ...(channel === 'transition' ? { durationSeconds: 3 } : {}),
    });
  };
  const changeDraft = (patch: Partial<ShowCue>) => {
    audioPreview.stop();
    setDraft(d => d && { ...d, ...patch });
  };
  const save = () => {
    if (!draft || !validDraft || conflict || disabled) return;
    const cue = showCueSchema.parse(draft);
    update(d => {
      d.show ??= { order: 'agenda', cues: [] };
      const index = d.show.cues.findIndex(c => c.id === cue.id);
      if (index < 0) d.show.cues.push(cue);
      else d.show.cues[index] = cue;
    });
    closeEditor();
  };
  const upload = async (file: File | undefined, background: boolean) => {
    if (!file || !onUpload || disabled) return;
    const generation = ++uploadGeneration.current;
    setUploading(true);
    setUploadError('');
    try {
      const asset = await onUpload(file, background);
      if (generation !== uploadGeneration.current) return;
      if (asset) {
        if (background)
          setAnimation(a =>
            a?.kind === 'background'
              ? { ...a, intro: { ...a.intro, mode: 'video', assetId: asset.id } }
              : a
          );
        else changeDraft({ assetId: asset.id, builtin: undefined, loop: false });
      } else setUploadError(t('uploadError'));
    } catch {
      if (generation === uploadGeneration.current) setUploadError(t('uploadError'));
    } finally {
      if (generation === uploadGeneration.current) setUploading(false);
    }
  };
  const musicOptions: Option[] = [
    {
      value: 'builtin:cinematic-sequence',
      label: live('cinematicSequence'),
      group: live('builtinMusic'),
    },
    ...presentationMusic.map(track => ({
      value: `builtin:${track.id}`,
      label: `${track.title} · ${live(`musicMoods.${track.mood}`)} · ${Math.floor(track.duration / 60)}:${String(Math.round(track.duration % 60)).padStart(2, '0')}`,
      group: live('builtinMusic'),
    })),
    ...assets
      .filter(a => a.mime.startsWith('audio/'))
      .map(a => ({ value: a.id, label: a.name, group: live('uploadedMusic') })),
    { value: 'builtin:test-tone', label: `${live('testTone')} · 3 s`, group: live('testSound') },
  ];
  if (draft?.assetId && missing)
    musicOptions.push({
      value: draft.assetId,
      label: t('missing'),
      disabled: true,
      group: live('uploadedMusic'),
    });
  const renderRule = (cue: ShowCue) => {
    const title = frames.find(f => f.id === cue.frameId)?.name ?? t('noFrame');
    const sentence =
      cueScope(cue) === 'global'
        ? t('whenGlobal', { source: sourceTitle(cue, assets) })
        : cueChannel(cue) === 'transition'
          ? t('whenTransition', { title, source: sourceTitle(cue, assets) })
          : cue.trigger === 'enter'
            ? t('whenMusic', { title, source: sourceTitle(cue, assets) })
            : `${title} · ${live(`triggers.${cue.trigger}`)}: ${sourceTitle(cue, assets)}`;
    const summary = t('summary', {
      volume: Math.round(cue.volume * 100),
      enter: cueFadeIn(cue),
      leave: cueFadeOut(cue),
    });
    const TriggerIcon = {
      enter: Presentation,
      activate: Flag,
      indicative: Vote,
      final: Vote,
      closed: LockKeyhole,
      reveal: Eye,
    }[cue.trigger];
    const ActionIcon = { play: Play, pause: Pause, stop: Square }[cue.action];
    return (
      <article key={cue.id} data-cue-id={cue.id}>
        <div className="flex min-h-8 items-center gap-1 rounded-sm px-2 text-sm">
          {cueChannel(cue) === 'music' ? (
            <Music className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <ArrowRightLeft className="text-muted-foreground size-4 shrink-0" />
          )}
          <Hint label={`${sentence} ${summary}`}>
            <button
              type="button"
              className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded px-1 py-1 text-left focus-visible:ring-2"
              aria-label={sentence}
              disabled={disabled}
              onClick={() => {
                audioPreview.stop();
                setDraft(structuredClone(cue));
              }}
            >
              {sourceTitle(cue, assets)}
              <span className="text-muted-foreground ml-2 text-xs">
                {cueChannel(cue) === 'music' ? live(`triggers.${cue.trigger}`) : t('onChange')}
              </span>
            </button>
          </Hint>
          <Hint label={`${t('trigger')}: ${live(`triggers.${cue.trigger}`)}`}>
            <span
              tabIndex={0}
              role="img"
              aria-label={`${t('trigger')}: ${live(`triggers.${cue.trigger}`)}`}
              className="text-muted-foreground focus-visible:ring-ring shrink-0 rounded p-1 focus-visible:ring-2"
            >
              <TriggerIcon className="size-3.5" />
            </span>
          </Hint>
          <Hint label={`${t('action')}: ${t(cue.action)}`}>
            <span
              tabIndex={0}
              role="img"
              aria-label={`${t('action')}: ${t(cue.action)}`}
              className="text-muted-foreground focus-visible:ring-ring shrink-0 rounded p-1 focus-visible:ring-2"
            >
              <ActionIcon className="size-3.5" />
            </span>
          </Hint>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('edit')}
            disabled={disabled}
            onClick={() => {
              audioPreview.stop();
              setDraft(structuredClone(cue));
            }}
          >
            <PencilLine className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={t('remove')}
            disabled={disabled}
            onClick={() => {
              update(d => {
                if (d.show) d.show.cues = d.show.cues.filter(c => c.id !== cue.id);
              });
              setRemoved({
                kind: 'rule',
                restore: d => {
                  d.show ??= { order: 'agenda', cues: [] };
                  if (!d.show.cues.some(c => c.id === cue.id)) d.show.cues.push(cue);
                },
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        {conflictingCue(rules, cue) && (
          <p role="status" className="text-muted-foreground px-2 text-xs">
            {t('legacyConflict')}
          </p>
        )}
        {cue.assetId && !assets.some(a => a.id === cue.assetId) && (
          <p role="status" className="text-muted-foreground px-2 text-xs">
            {t('missing')}
          </p>
        )}
      </article>
    );
  };
  const startPreview = async (reset = false, transition = false) => {
    const at = reset ? 0 : elapsed;
    if (reset) {
      setElapsed(0);
      setReplay(r => r + 1);
    }
    setRunning(true);
    if (!withAudio) return;
    const candidates = previewDocument.show?.cues ?? [];
    const music = candidates.find(
      c => cueChannel(c) === 'music' && c.frameId === targetFrameId && c.trigger === 'enter'
    );
    const effects = candidates.filter(c => cueChannel(c) === 'transition' && c.trigger === 'enter');
    const effect =
      effects.find(c => c.frameId === targetFrameId && cueScope(c) !== 'global') ??
      effects.find(c => cueScope(c) === 'global');
    await audioPreview.play({
      ...(music ? { ...cueAudio(music), position: at / 1000 } : {}),
      ...(transition && effect ? { transition: cueAudio(effect) } : {}),
    });
  };
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    return () => {
      setElapsed(e => e + Date.now() - started);
    };
  }, [running]);
  if (!frame) return <p>{t('noFrame')}</p>;
  return (
    <div className="space-y-5 p-3">
      {disabled && <p className="text-muted-foreground text-sm">{t('readOnly')}</p>}
      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
        >
          {t(removed.kind === 'rule' ? 'removed' : 'removedAnimation')}
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              update(removed.restore);
              setRemoved(null);
            }}
          >
            {t('undo')}
          </Button>
        </div>
      )}
      <div role="tree" aria-label={t('tree')} aria-multiselectable className="space-y-1">
        {frames.map((f, index) => {
          const open = expanded.has(f.id);
          const background = frameIntro(f);
          const hasBackground = background && background.mode !== 'static';
          const descendants = layers.filter(
            l => l.rootFrameId === f.id && l.node.id !== f.id && l.node.type !== 'frame'
          );
          const animated = descendants.filter(
            l => l.node.showAnimation && l.node.showAnimation.preset !== 'none'
          );
          const selectedElement = descendants.find(l => selectedNodeIds.includes(l.node.id))?.node;
          const elementTarget = selectedElement ?? descendants[0]?.node;
          return (
            <div
              key={f.id}
              role="treeitem"
              aria-level={1}
              aria-expanded={open}
              aria-selected={frameId === f.id}
              data-show-frame-id={f.id}
            >
              <div
                className={`flex min-h-9 items-center gap-1 rounded-sm px-1 text-sm ${frameId === f.id ? 'bg-accent text-accent-foreground' : ''}`}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  aria-label={t(open ? 'collapse' : 'expand', { title: f.name })}
                  onClick={() =>
                    setExpanded(old => {
                      const next = new Set(old);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                >
                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
                <button
                  type="button"
                  className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left focus-visible:ring-2"
                  onClick={() => {
                    onSelect?.(f, f.id);
                    setExpanded(old => new Set([...old, f.id]));
                  }}
                >
                  <Frame className="size-4 shrink-0" />
                  <span className="truncate">
                    {t('frame', { number: index + 1, title: f.name })}
                  </span>
                </button>
              </div>
              {open && (
                <div role="group" className="ml-4 space-y-0.5 border-l py-1 pl-2">
                  <section aria-label={t('music')}>
                    {rules
                      .filter(
                        c =>
                          cueChannel(c) === 'music' &&
                          cueScope(c) !== 'global' &&
                          c.frameId === f.id
                      )
                      .map(renderRule)}
                    <Button
                      className="w-full justify-start"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => add('music', f.id)}
                    >
                      <Music className="text-muted-foreground size-4" />
                      <span className="flex-1 text-left">{t('addMusic')}</span>
                      <Plus className="size-3.5" />
                    </Button>
                  </section>
                  <section aria-label={t('transitions')}>
                    {rules
                      .filter(
                        c =>
                          cueChannel(c) === 'transition' &&
                          cueScope(c) !== 'global' &&
                          c.frameId === f.id
                      )
                      .map(renderRule)}
                    <Button
                      className="w-full justify-start"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => add('transition', f.id)}
                    >
                      <ArrowRightLeft className="text-muted-foreground size-4" />
                      <span className="flex-1 text-left">{t('addTransition')}</span>
                      <Plus className="size-3.5" />
                    </Button>
                  </section>
                  <section aria-label={t('animations')}>
                    {hasBackground && (
                      <div className="flex min-h-8 items-center gap-1 rounded-sm px-2 text-sm">
                        <Film className="text-muted-foreground size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate px-1">
                          {background.mode === 'spatial'
                            ? live(`intro.scenes.${background.scene ?? 'architecture'}`)
                            : t('video')}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          aria-label={t('edit')}
                          disabled={disabled}
                          onClick={() =>
                            setAnimation({
                              kind: 'background',
                              targetId: f.id,
                              intro: { ...background },
                            })
                          }
                        >
                          <PencilLine className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          aria-label={t('removeBackground')}
                          disabled={disabled}
                          onClick={() => {
                            update(d => {
                              const target = d.nodes.find(n => n.id === f.id);
                              if (target?.type === 'frame')
                                target.intro = { ...background, mode: 'static', assetId: null };
                            });
                            setRemoved({
                              kind: 'animation',
                              restore: d => {
                                const target = d.nodes.find(n => n.id === f.id);
                                if (target?.type === 'frame') target.intro = background;
                              },
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                    {!hasBackground && (
                      <Button
                        className="w-full justify-start"
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() =>
                          setAnimation({
                            kind: 'background',
                            targetId: f.id,
                            intro: { ...(background ?? defaultEventIntro), mode: 'spatial' },
                          })
                        }
                      >
                        <Film className="text-muted-foreground size-4" />
                        <span className="flex-1 text-left">{t('addBackground')}</span>
                        <Plus className="size-3.5" />
                      </Button>
                    )}
                    {animated.map(({ node }) => (
                      <div
                        key={node.id}
                        role="treeitem"
                        aria-level={2}
                        aria-selected={selectedNodeIds.includes(node.id)}
                        data-show-layer-id={node.id}
                        className={`flex min-h-8 items-center gap-1 rounded-sm px-2 text-sm ${selectedNodeIds.includes(node.id) ? 'bg-accent text-accent-foreground' : ''}`}
                      >
                        <Sparkles className="text-muted-foreground size-4 shrink-0" />
                        <Hint label={t('animationFor', { title: node.name })}>
                          <button
                            type="button"
                            className="focus-visible:ring-ring min-w-0 flex-1 truncate rounded px-1 py-1 text-left focus-visible:ring-2"
                            aria-label={node.name}
                            onClick={() => onSelect?.(node, f.id)}
                          >
                            {node.name}
                            <span className="text-muted-foreground ml-2 text-xs">
                              {live(`animations.${node.showAnimation?.preset ?? 'none'}`)}
                            </span>
                          </button>
                        </Hint>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={disabled}
                          aria-label={t('editElement', { title: node.name })}
                          onClick={() => {
                            onSelect?.(node, f.id);
                            setAnimation({
                              kind: 'element',
                              targetId: node.id,
                              animation: node.showAnimation ?? {
                                preset: 'fade',
                                duration: 0.8,
                                intensity: 0.5,
                              },
                            });
                          }}
                        >
                          <PencilLine className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={disabled}
                          aria-label={t('removeElementFrom', { title: node.name })}
                          onClick={() => {
                            update(d => {
                              const target = d.nodes.find(n => n.id === node.id);
                              if (target)
                                target.showAnimation = {
                                  preset: 'none',
                                  duration: 0.8,
                                  intensity: 0.5,
                                };
                            });
                            setRemoved({
                              kind: 'animation',
                              restore: d => {
                                const target = d.nodes.find(n => n.id === node.id);
                                if (target) target.showAnimation = node.showAnimation;
                              },
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      className="w-full justify-start"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || !elementTarget}
                      onClick={() => {
                        if (!elementTarget) return;
                        onSelect?.(elementTarget, f.id);
                        setAnimation({
                          kind: 'element',
                          targetId: elementTarget.id,
                          animation: elementTarget.showAnimation ?? {
                            preset: 'fade',
                            duration: 0.8,
                            intensity: 0.5,
                          },
                        });
                      }}
                    >
                      <Sparkles className="text-muted-foreground size-4" />
                      <span className="flex-1 text-left">{t('addAnimation')}</span>
                      <Plus className="size-3.5" />
                    </Button>
                  </section>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <section aria-label={t('globalHeading')} className="space-y-1 border-t pt-3">
        <h3 className="flex items-center gap-2 px-2 text-sm font-semibold">
          <ArrowRightLeft className="size-4" />
          {t('globalHeading')}
        </h3>
        {rules
          .filter(c => cueChannel(c) === 'transition' && cueScope(c) === 'global')
          .map(renderRule)}
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => add('transition', frameId, 'global')}
        >
          <Plus className="size-3.5" />
          {t('addGlobal')}
        </Button>
      </section>
      <Button
        variant="outline"
        onClick={() => {
          setPreviewOpen(true);
          setElapsed(0);
        }}
      >
        <Play />
        {t('openPreview')}
      </Button>
      {(draft || animation || previewOpen) && (
        <ShowDialog
          title={
            draft
              ? t(cueChannel(draft) === 'music' ? 'editMusic' : 'editTransition')
              : animation
                ? t(animation.kind === 'background' ? 'background' : 'element')
                : t('previewTitle')
          }
          onClose={closeEditor}
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold">
              {draft?.scope === 'global'
                ? t('global')
                : t('frame', {
                    number: frames.findIndex(f => f.id === targetFrameId) + 1,
                    title: targetFrame?.name ?? frame.name,
                  })}
            </p>
            {draft && (
              <>
                {cueChannel(draft) === 'transition' && (
                  <ShowSelect
                    label={t('assignment')}
                    value={cueScope(draft)}
                    options={[
                      { value: 'frame', label: t('local') },
                      { value: 'global', label: t('global') },
                    ]}
                    onChange={scope =>
                      changeDraft({
                        scope: scope as 'frame' | 'global',
                        frameId: scope === 'global' ? undefined : frameId,
                      })
                    }
                  />
                )}
                {cueScope(draft) !== 'global' && (
                  <ShowSelect
                    label={t('target')}
                    value={draft.frameId ?? frameId}
                    options={frames.map(f => ({
                      value: f.id,
                      label: `${frames.indexOf(f) + 1} · ${f.name}`,
                    }))}
                    onChange={frameId => changeDraft({ frameId })}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <ShowSelect
                    label={t('trigger')}
                    value={draft.trigger}
                    disabled={cueChannel(draft) === 'transition'}
                    options={['enter', 'activate', 'indicative', 'final', 'closed', 'reveal'].map(
                      trigger => {
                        const linked = targetFrame?.eventSource?.type === 'agenda_item';
                        const vote = linked && !!targetSource?.payload.results;
                        const unavailable =
                          trigger === 'activate' ? !linked : trigger !== 'enter' && !vote;
                        return {
                          value: trigger,
                          label: `${live(`triggers.${trigger}`)}${unavailable ? ` · ${t(trigger === 'activate' ? 'eventUnavailable' : 'voteUnavailable')}` : ''}`,
                          disabled: unavailable && draft.trigger !== trigger,
                        };
                      }
                    )}
                    onChange={trigger => changeDraft({ trigger: trigger as ShowCue['trigger'] })}
                  />
                  <ShowSelect
                    label={t('action')}
                    value={draft.action}
                    disabled={cueChannel(draft) === 'transition'}
                    options={['play', 'pause', 'stop'].map(action => ({
                      value: action,
                      label: t(action),
                    }))}
                    onChange={action =>
                      changeDraft({
                        action: action as ShowCue['action'],
                        ...(action !== 'play'
                          ? { assetId: undefined, builtin: undefined, loop: false }
                          : {}),
                      })
                    }
                  />
                </div>
                {draft.action !== 'play' && (
                  <p className="text-muted-foreground text-xs">{t('pausedHelp')}</p>
                )}
                {draft.action === 'play' && (
                  <>
                    <ShowSelect
                      label={t('source')}
                      value={draft.builtin ? `builtin:${draft.builtin}` : (draft.assetId ?? '')}
                      options={musicOptions}
                      onChange={value => {
                        const builtin = parsePresentationBuiltinSelection(value);
                        changeDraft({
                          builtin,
                          assetId: builtin ? undefined : value,
                          loop:
                            cueChannel(draft) === 'music' && builtin !== 'test-tone' && !!builtin,
                        });
                      }}
                    />
                    <FileDropzone
                      accept="audio/mpeg,audio/wav,.mp3,.wav"
                      disabled={disabled || !onUpload}
                      busy={uploading}
                      idleLabel={t('dropAudio')}
                      activeLabel={t('dropActive')}
                      browseLabel={t('upload')}
                      busyLabel={t('uploading')}
                      hint={t('audioHint')}
                      testId="studio-audio-dropzone"
                      inputProps={{ 'aria-label': t('upload') }}
                      onFilesSelected={files => upload(files[0], false)}
                      onFilesRejected={() => setUploadError(t('audioRejected'))}
                    />
                    <Button
                      variant="outline"
                      disabled={!validDraft}
                      onClick={() => {
                        if (audioPreview.playing) audioPreview.stop();
                        else {
                          const spec = cueAudio(draft);
                          void audioPreview.play(
                            cueChannel(draft) === 'transition' ? { transition: spec } : spec
                          );
                        }
                      }}
                    >
                      {t(audioPreview.playing ? 'stopPreview' : 'preview')}
                    </Button>
                    <AudioDuration assetId={draft.assetId} builtin={draft.builtin} />
                    <MusicCredits builtin={draft.builtin} />
                    <PercentField
                      label={t('volume')}
                      value={draft.volume}
                      onChange={volume => changeDraft({ volume })}
                    />
                    {cueChannel(draft) === 'music' && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={draft.loop && draft.builtin !== 'test-tone'}
                          disabled={draft.builtin === 'test-tone'}
                          onCheckedChange={v => changeDraft({ loop: v === true })}
                        />
                        {t('loop')}
                      </label>
                    )}
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label={t('fadeIn')}
                    value={cueFadeIn(draft)}
                    onChange={fadeInSeconds => changeDraft({ fadeInSeconds })}
                  />
                  <NumberField
                    label={t('fadeOut')}
                    value={cueFadeOut(draft)}
                    onChange={fadeOutSeconds => changeDraft({ fadeOutSeconds })}
                  />
                </div>
                {cueChannel(draft) === 'transition' ? (
                  <>
                    <NumberField
                      label={t('duration')}
                      value={draft.durationSeconds ?? 3}
                      min={1}
                      onChange={durationSeconds => changeDraft({ durationSeconds })}
                    />
                    <p className="text-muted-foreground text-xs">{t('loopHelp')}</p>
                  </>
                ) : null}
                {missing && <p role="alert">{t('missing')}</p>}
                {conflict && <p role="alert">{t('conflict')}</p>}
              </>
            )}
            {animation?.kind === 'background' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['architecture', 'democracy-illustrated', 'democracy-sculptural'] as const).map(
                    scene => (
                      <Button
                        key={scene}
                        variant={
                          animation.intro.mode === 'spatial' &&
                          (animation.intro.scene ?? 'architecture') === scene
                            ? 'default'
                            : 'outline'
                        }
                        className="h-auto flex-col p-2 text-xs whitespace-normal"
                        aria-pressed={
                          animation.intro.mode === 'spatial' &&
                          (animation.intro.scene ?? 'architecture') === scene
                        }
                        onClick={() =>
                          setAnimation({
                            ...animation,
                            intro: { ...animation.intro, mode: 'spatial', scene, assetId: null },
                          })
                        }
                      >
                        <SceneThumbnail scene={scene} theme={document.theme} />
                        {live(`intro.scenes.${scene}`)}
                      </Button>
                    )
                  )}
                  {(['video', 'static'] as const).map(mode => (
                    <Button
                      key={mode}
                      variant={animation.intro.mode === mode ? 'default' : 'outline'}
                      aria-pressed={animation.intro.mode === mode}
                      className="h-auto min-h-20 flex-col"
                      onClick={() =>
                        setAnimation({
                          ...animation,
                          intro: { ...animation.intro, mode, assetId: null },
                        })
                      }
                    >
                      <Film />
                      {t(mode)}
                    </Button>
                  ))}
                </div>
                {animation.intro.mode === 'spatial' && (
                  <PercentField
                    label={t('intensity')}
                    value={animation.intro.intensity}
                    onChange={intensity =>
                      setAnimation({ ...animation, intro: { ...animation.intro, intensity } })
                    }
                  />
                )}
                {animation.intro.mode === 'video' && (
                  <>
                    <ShowSelect
                      label={t('videoFile')}
                      value={animation.intro.assetId ?? ''}
                      options={assets
                        .filter(a => a.mime === 'video/mp4')
                        .map(a => ({ value: a.id, label: a.name }))}
                      onChange={assetId =>
                        setAnimation({ ...animation, intro: { ...animation.intro, assetId } })
                      }
                    />
                    <FileDropzone
                      accept="video/mp4,.mp4"
                      disabled={disabled || !onUpload}
                      busy={uploading}
                      idleLabel={t('dropVideo')}
                      activeLabel={t('dropActive')}
                      browseLabel={t('uploadVideo')}
                      busyLabel={t('uploading')}
                      hint="MP4"
                      testId="studio-video-dropzone"
                      inputProps={{ 'aria-label': t('uploadVideo') }}
                      onFilesSelected={files => upload(files[0], true)}
                      onFilesRejected={() => setUploadError(t('videoRejected'))}
                    />
                    {!animation.intro.assetId && <p role="status">{t('noVideo')}</p>}
                  </>
                )}
              </>
            )}
            {animation?.kind === 'element' && (
              <>
                <ShowSelect
                  label={t('targetElement')}
                  value={animation.targetId}
                  options={layers
                    .filter(l => l.rootFrameId === targetFrameId && l.node.type !== 'frame')
                    .map(l => ({ value: l.node.id, label: l.node.name }))}
                  onChange={targetId => {
                    const node = document.nodes.find(n => n.id === targetId);
                    if (!node) return;
                    onSelect?.(node, targetFrameId);
                    setAnimation({
                      kind: 'element',
                      targetId,
                      animation: node.showAnimation ?? {
                        preset: 'fade',
                        duration: 0.8,
                        intensity: 0.5,
                      },
                    });
                  }}
                />

                <p>
                  {t('selectedElement', {
                    title: document.nodes.find(n => n.id === animation.targetId)?.name ?? '',
                  })}
                </p>
                <ShowSelect
                  label={t('effect')}
                  value={animation.animation.preset}
                  options={['none', 'fade', 'slide', 'stagger', 'pulse', 'reveal'].map(p => ({
                    value: p,
                    label: live(`animations.${p}`),
                  }))}
                  onChange={preset =>
                    setAnimation({
                      ...animation,
                      animation: { ...animation.animation, preset: preset as 'fade' },
                    })
                  }
                />
                <NumberField
                  label={t('effectDuration')}
                  value={animation.animation.duration}
                  min={0.1}
                  max={10}
                  onChange={duration =>
                    setAnimation({ ...animation, animation: { ...animation.animation, duration } })
                  }
                />
                <PercentField
                  label={t('effectIntensity')}
                  value={animation.animation.intensity}
                  onChange={intensity =>
                    setAnimation({ ...animation, animation: { ...animation.animation, intensity } })
                  }
                />
                {intro && intro.mode !== 'static' && <p role="status">{t('suppressed')}</p>}
              </>
            )}
            {uploadError && (
              <div role="alert">
                <InlineNotice variant="destructive">{uploadError}</InlineNotice>
              </div>
            )}
            {audioPreview.error && (
              <div role="alert">
                <InlineNotice variant="destructive">{audioPreview.error}</InlineNotice>
              </div>
            )}
            <div className="space-y-2 border-t pt-3">
              <FramePreview
                document={previewDocument}
                frameId={targetFrameId}
                animateElements
                {...{ sources, assets, portrait, running, elapsed, replay }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (running) {
                      setRunning(false);
                      audioPreview.pause();
                    } else void startPreview();
                  }}
                >
                  {t(running ? 'pausePreview' : 'start')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void startPreview(true)}>
                  {t('replay')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void startPreview(true, true)}>
                  {t('simulate')}
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={withAudio}
                  onCheckedChange={v => {
                    setWithAudio(v === true);
                    if (v !== true) audioPreview.stop();
                  }}
                />
                {t('withAudio')}
              </label>
              <p className="text-muted-foreground text-xs">{t('silent')}</p>
            </div>
          </div>
          <footer className="bg-background sticky bottom-0 flex justify-end gap-2 border-t py-3">
            <Button variant="outline" onClick={closeEditor}>
              {t('cancel')}
            </Button>
            {draft && (
              <Button disabled={!validDraft || !!conflict || uploading || disabled} onClick={save}>
                {t('save')}
              </Button>
            )}
            {animation && (
              <Button
                disabled={
                  disabled ||
                  uploading ||
                  (animation.kind === 'background' &&
                    animation.intro.mode === 'video' &&
                    !animation.intro.assetId)
                }
                onClick={() => {
                  update(d => {
                    const n = d.nodes.find(n => n.id === animation.targetId);
                    if (n && animation.kind === 'element') n.showAnimation = animation.animation;
                    if (n?.type === 'frame' && animation.kind === 'background')
                      n.intro = animation.intro;
                  });
                  closeEditor();
                }}
              >
                {t('save')}
              </Button>
            )}
          </footer>
        </ShowDialog>
      )}
    </div>
  );
}
