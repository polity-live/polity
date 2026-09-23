# Studio V5 canvas

The persisted Studio document uses semantic V5 nodes. The editor and preview use Konva. A selected rich-text node is painted from its Plate content in normal mode and edited in an HTML Plate overlay between lower and upper Konva layers. The Layers panel's `moveNode` command supplies the paint order in both modes.

The Studio export worker paints V5 nodes directly for PNG, PDF and video frames. PPTX and Canva import files flatten the same scene order to editable text, shapes, tables, charts and media where supported. Drawings are embedded as SVG.

New projects, insert-menu objects, drawn objects, media uploads and duplicated frames write semantic nodes. The V5 schema does not contain an Excalidraw payload. The Excalidraw SDK, canvas UI, native clipboard and export bundle have been removed.

The V5 database migration is `supabase/migrations/20260923020000_studio_document_v5.sql`. Existing projects require the planned database reset; there is no V4 document migration. Run the Studio unit/component suite, browser component tests, typecheck, build, database integration and authenticated multiuser tests before production rollout.
