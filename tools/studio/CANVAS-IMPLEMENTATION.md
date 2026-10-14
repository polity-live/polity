# Studio V5 canvas

The persisted Studio document uses semantic V5 nodes. The editor and preview use Konva. A selected rich-text node is painted from its Plate content in normal mode and edited in an HTML Plate overlay between lower and upper Konva layers. The Layers panel's `moveNode` command supplies the paint order in both modes.

The Studio export worker paints V5 nodes directly for PNG, PDF and video frames. PPTX and Canva import files flatten the same scene order to editable text, shapes, tables, charts and media where supported. Drawings are embedded as SVG.

New projects, insert-menu objects, drawn objects, media uploads and duplicated frames write semantic nodes. The V5 schema does not contain an Excalidraw payload. The Excalidraw SDK, canvas UI, native clipboard and export bundle have been removed.

The current database contract lives in `supabase/schemas/`, including the canonical Studio definitions, Zero commands and private Presence policies. Its generated initial migration and manual supplement replace the earlier incremental migrations; see `supabase/declarative_schema_application_migration.md` for generation and the explicitly destructive baseline rollout. Studio and Canvas are active in all environments. Run the Studio unit/component suite, browser component tests, typecheck, build, database integration and authenticated multiuser tests before production rollout.
