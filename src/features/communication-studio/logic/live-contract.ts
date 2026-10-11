import { z } from 'zod';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { presentationBuiltinIds, type PresentationBuiltinId } from './presentation-audio';
export { presentationTestTone } from './presentation-audio';

export const politySourceTypes = [
  'event',
  'agenda_item',
  'vote',
  'election',
  'amendment',
  'user',
  'group',
] as const;
export const liveBindingSchema = z.object({
  sourceType: z.enum(politySourceTypes),
  sourceId: z.string().uuid(),
  field: z.enum([
    'title',
    'description',
    'status',
    'start_time',
    'end_time',
    'duration',
    'location',
    'organizer',
    'countdown',
    'times',
    'results',
    'speakers',
    'current_speaker',
    'details',
    'image_url',
  ]),
  format: z
    .enum(['text', 'time', 'date', 'datetime', 'countdown', 'results', 'speakers'])
    .default('text'),
});
export const responsiveOverrideSchema = z.object({
  transform: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  visible: z.boolean().optional(),
  fontSize: z.number().min(8).max(300).optional(),
});
export const showCueSchema = z
  .object({
    id: z.string().uuid(),
    frameId: z.string().uuid().optional(),
    scope: z.enum(['frame', 'global']).optional(),
    channel: z.enum(['music', 'transition']).optional(),
    trigger: z.enum(['enter', 'activate', 'indicative', 'final', 'closed', 'reveal']),
    assetId: z.string().uuid().optional(),
    builtin: z.enum(presentationBuiltinIds).optional(),
    action: z.enum(['play', 'pause', 'stop']).default('play'),
    volume: z.number().min(0).max(1).default(0.65),
    loop: z.boolean().optional(),
    fadeSeconds: z.number().min(0).max(30).default(1),
    fadeInSeconds: z.number().min(0).max(30).optional(),
    fadeOutSeconds: z.number().min(0).max(30).optional(),
    durationSeconds: z.number().min(1).max(30).optional(),
  })
  .refine(cue => cue.action !== 'play' || Boolean(cue.assetId) !== Boolean(cue.builtin), {
    error: () => translateText('features.studio.eventLive.chooseExactlyOneAudioSource'),
  })
  .refine(cue => !(cue.assetId && cue.builtin), {
    error: () => translateText('features.studio.eventLive.chooseOneAudioSource'),
  })
  .refine(cue => cue.scope === 'global' || !!cue.frameId, {
    error: () => translateText('features.studio.eventLive.chooseFrame'),
  })
  .refine(
    cue => cue.scope !== 'global' || (cue.channel === 'transition' && cue.trigger === 'enter'),
    { error: () => translateText('features.studio.eventLive.globalRulesAreTransitions') }
  )
  .refine(
    cue => cue.channel !== 'transition' || (cue.trigger === 'enter' && cue.action === 'play'),
    { error: () => translateText('features.studio.eventLive.transitionsPlayOnEntry') }
  )
  .transform(cue => ({
    ...cue,
    loop:
      cue.channel === 'transition' || cue.builtin === 'test-tone'
        ? false
        : (cue.loop ?? Boolean(cue.builtin)),
  }));
export const eventFrameSourceSchema = z.object({
  type: z.enum(['event', 'agenda_item']),
  id: z.string().uuid(),
  template: z.string().min(1).max(80),
});
export type LiveBinding = z.infer<typeof liveBindingSchema>;
export type ShowCue = z.infer<typeof showCueSchema>;
export interface LiveOption {
  id: string;
  label: string;
  indicative: number;
  final: number;
  image_url?: string | null;
}
export interface LiveResult {
  title: string;
  status: string;
  majority_type?: string;
  eligible: number;
  options: LiveOption[];
  election_mode?: string;
  seat_count?: number;
  max_votes?: number;
}
export interface LiveSource {
  source_type: LiveBinding['sourceType'];
  source_id: string;
  event_id?: string | null;
  agenda_item_id?: string | null;
  payload: Record<string, unknown> & { results?: LiveResult | null; timezone?: string };
}
export type ShowMode = 'studio' | 'agenda' | 'speakers';
export interface PresentationAudioState {
  assetId?: string;
  builtin?: PresentationBuiltinId;
  status?: string;
  position?: number;
  volume?: number;
  loop?: boolean;
  fadeSeconds?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  durationSeconds?: number;
  ownerFrameId?: string;
  sequenceEndPosition?: number;
  at?: number;
  cueId?: string;
}
export interface ShowState {
  event_id: string;
  project_id: string;
  mode: string;
  frame_id: string | null;
  follow_agenda: boolean;
  results_visible: boolean;
  running: boolean;
  revision: number;
  cue_id: string | null;
  cue_at: number | null;
  controller_id: string | null;
  controller_device_id: string | null;
  lease_until: number | null;
  audio_device_id: string | null;
  audio: PresentationAudioState & { transition?: PresentationAudioState };
  updated_at: number;
}
