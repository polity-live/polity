# Studio V3 implementation status

Studio V3 is implemented behind rollout flags. Production activation still requires the environment-specific acceptance described in `docs/studio-zero-rollout.md`.

## Implemented

- `StudioDocumentV3` with stable frame, rich-text, shape, drawing, media, table, chart and embed nodes; deliverables and campaign planning reference frame IDs.
- Typed commands for create, update, transform, resize, reparent, reorder, delete, align and distribute, including cycle protection, world-position-preserving reparenting and optional frame-content scaling.
- Explicit V2/V3 database separation through `studio_project.document_schema_version`. New Studio APIs and Zero queries only expose V3 projects; V2 data is retained unchanged.
- Excalidraw 0.18.x as the sole canvas interaction engine. Plate remains the semantic rich-text editor. Complex content is rendered as a derived projection and is not rasterized as its source of truth.
- Full-screen personal and group routes for Studio and Whiteboards, Amendment-style fixed toolbar, responsive panels/Sheets, contextual selection toolbar and Polity light/dark tokens.
- Frame presets and sets, position/size/rotation, constraints, frame clipping, safe areas, grid and snapping settings, free/horizontal/vertical/wrap layout metadata, searchable layers, visibility, locking and ordering.
- Assets, Brand Kit, sources, AI/project chat, captions, campaign planning, comments, proposals, voting, revisions, Presence, offline drafts and visible conflict resolution.
- Confirmed-revision exports for the existing PNG, SVG, PDF, PPTX, Canva, MP4, XLSX, ZIP and `.excalidraw` paths.
- Full-screen project URLs replace the former `?project=` navigation.

## Verification

- Studio unit/component suite: 27 files and 204 tests.
- TypeScript, targeted Oxlint, route catalog, action catalog, accountability ledger and database coverage checks pass.
- Production client/server build passes.
- Database integration, pgTAP, multi-user browser, touch-device and export-golden suites remain required against each target environment before production activation.

## Rollout boundary

Production requires `STUDIO_V3_ENABLED=true`, `VITE_STUDIO_V3_ENABLED=true`, `CANVAS_ENABLED=true` and the existing Studio enablement. V2 projects are not migrated, surfaced or deleted. Rollout and rollback details are documented in `docs/studio-zero-rollout.md`.
