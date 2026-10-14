import { z } from 'zod';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { presentationBuiltinIds } from '@/features/communication-studio/logic/presentation-audio';
export const presentationCommandSchema = z.object({
  operationId: z.string().uuid(),
  eventId: z.string().uuid(),
  deviceId: z.string().uuid(),
  action: z.enum(['device', 'heartbeat', 'claim', 'release', 'control']),
  name: z.string().trim().min(1).max(100).default('Screen'),
  takeover: z.boolean().default(false),
  expectedRevision: z.number().int().nonnegative().optional(),
  mode: z.enum(['studio', 'agenda', 'speakers']).optional(),
  frameId: z.string().uuid().optional(),
  followAgenda: z.boolean().optional(),
  resultsVisible: z.boolean().optional(),
  running: z.boolean().optional(),
  audioDeviceId: z.string().uuid().nullable().optional(),
  audio: z
    .object({
      assetId: z.string().uuid().optional(),
      builtin: z.enum(presentationBuiltinIds).optional(),
      status: z.enum(['playing', 'paused', 'stopped']),
      position: z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
      volume: z.number().min(0).max(1).optional(),
      loop: z.boolean().optional(),
      fadeSeconds: z.number().min(0).max(30).optional(),
      fadeInSeconds: z.number().min(0).max(30).optional(),
      fadeOutSeconds: z.number().min(0).max(30).optional(),
    })
    .refine(audio => !(audio.assetId && audio.builtin), {
      error: () => translateText('features.studio.eventLive.chooseOneAudioSource'),
    })
    .optional(),
});
export type PresentationCommand = z.input<typeof presentationCommandSchema>;
