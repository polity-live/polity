import { z } from 'zod';

// Only document records cross the persistence boundary. AppState contains local
// selection, camera and potentially third-party URLs and must never be stored.
export const canvasElementSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.enum([
      'rectangle',
      'diamond',
      'ellipse',
      'line',
      'arrow',
      'freedraw',
      'text',
      'image',
      'frame',
      'magicframe',
    ]),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative(),
    angle: z.number().finite(),
    isDeleted: z.boolean(),
    link: z
      .string()
      .max(2000)
      .nullable()
      .optional()
      .refine(v => !v || /^(https?:\/\/|\/[^/]|#)/i.test(v), 'Unsupported canvas link'),
  })
  .catchall(z.json());

export const canvasSceneSchema = z
  .object({
    version: z.literal(1),
    nativeTemplates: z.boolean().optional(),
    elements: z.array(canvasElementSchema).max(10000),
    files: z
      .record(
        z.string(),
        z.object({
          id: z.string(),
          mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
          dataURL: z
            .string()
            .max(12_000_000)
            .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
          created: z.number(),
          lastRetrieved: z.number().optional(),
        })
      )
      .default({}),
  })
  .superRefine((scene, ctx) => {
    if (new Set(scene.elements.map(e => e.id)).size !== scene.elements.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate canvas element IDs' });
    if (JSON.stringify(scene.files).length > 24_000_000)
      ctx.addIssue({ code: 'custom', message: 'Canvas media exceeds 24 MB' });
  });
export type CanvasScene = z.infer<typeof canvasSceneSchema>;
export const emptyCanvasScene = (): CanvasScene => ({ version: 1, elements: [], files: {} });

export function durableElements(elements: readonly Record<string, unknown>[]) {
  return elements
    .filter(e => !(e.customData as { polityElement?: string } | undefined)?.polityElement)
    .map(e => {
      // SDK clocks are not content. Keeping them in diff operations would make
      // independent color and geometry edits conflict on the version field.
      const {
        version: _version,
        versionNonce: _nonce,
        updated: _updated,
        index: _index,
        ...content
      } = e;
      // SDK records contain explicitly undefined optional fields (customData,
      // bindings). They are absent in JSON, not invalid document values.
      return canvasElementSchema.parse(JSON.parse(JSON.stringify(content)));
    });
}
