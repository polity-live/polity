import { z } from 'zod';
export const studioEditorCommandSchemas = {
  studio_select_page: z.object({ pageId: z.string().uuid() }),
  studio_select_elements: z.object({
    pageId: z.string().uuid(),
    elementIds: z.array(z.string().uuid()).max(100),
  }),
  studio_preview: z.object({ playing: z.boolean() }),
  studio_guides: z.object({ visible: z.boolean() }),
  studio_copy_selection: z.object({}),
  studio_paste_selection: z.object({}),
  studio_undo_local: z.object({}),
  studio_redo_local: z.object({}),
  studio_copy_project: z.object({}),
  studio_save_template: z.object({}),
  studio_open_panel: z.object({
    panel: z.enum([
      'project',
      'insert',
      'pages',
      'arrange',
      'text',
      'tools',
      'ai',
      'captions',
      'exports',
    ]),
  }),
};
export type StudioEditorCommandName = keyof typeof studioEditorCommandSchemas;
export interface StudioEditorRequest {
  id: string;
  name: StudioEditorCommandName;
  input: unknown;
}
