-- Group Studio has three internal modes. Keep the legacy view mode available to whiteboards.
UPDATE public.canvas_control AS control
SET phase = 'suggest_internal'
FROM public.studio_project AS project
WHERE control.project_id = project.id
  AND project.group_id IS NOT NULL
  AND project.kind <> 'whiteboard'
  AND control.phase = 'view';
