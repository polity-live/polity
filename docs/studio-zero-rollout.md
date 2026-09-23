# Studio V3: Rollout und Abnahme

Stand: 22. September 2026. Studio V3 ist implementiert und hinter separaten Server- und Client-Flags abgesichert. Die Produktion wird durch das Einspielen des Codes allein nicht umgestellt.

## Architektur

- `StudioDocumentV3` ist das einzige kanonische Speicherformat des neuen Studios. Es enthält stabile Nodes, Frame-Hierarchien, Deliverables, Kampagnenplanung, Brand-Daten und Assets.
- Excalidraw übernimmt Auswahl, Transformation, Zeichnung, Bindungen, Pan und Zoom. Rich Text wird semantisch als Plate-Inhalt gespeichert; Canvas-Darstellungen komplexer Nodes sind abgeleitete Projektionen.
- Lokale Auswahl, Werkzeug, Panels und Viewport sind kein Dokumentinhalt. Zero synchronisiert bestätigte V3-Operationen, Supabase autorisiert Assets und Presence.
- Undo/Redo arbeitet auf den eigenen V3-Änderungen. Konflikte werden sichtbar aufgelöst und nicht still überschrieben.
- Geöffnete Projekte verwenden Full-Screen-Routen wie `/studio/<projectId>`, `/whiteboards/<projectId>` und die entsprechenden Gruppenrouten.

## Datenabgrenzung

Die Migration `20260921280000_studio_document_v3.sql` ergänzt `studio_project.document_schema_version` so, dass bereits vorhandene Zeilen als Version 2 markiert werden und neue Zeilen standardmäßig Version 3 erhalten.

- V2-Projekte werden nicht migriert, nicht im V3-Studio angezeigt und nicht automatisch gelöscht.
- V3-Abfragen, Studio-APIs, Zero-Operationen, Governance und Exportpfade filtern explizit auf `document_schema_version = 3`.
- V3-Endpunkte akzeptieren ausschließlich Payloads mit `schemaVersion: 3`.
- Eine spätere Migration oder Löschung von V2-Daten benötigt eine eigene Freigabe und gehört nicht zu diesem Rollout.

## Aktivierung

Lokal ist V3 standardmäßig aktiv, solange die übergeordneten Studio-Flags nicht deaktiviert sind. In Produktion müssen beide V3-Flags ausdrücklich gesetzt werden:

```text
STUDIO_ENABLED=true
STUDIO_V3_ENABLED=true
VITE_STUDIO_V3_ENABLED=true
CANVAS_ENABLED=true
```

`STUDIO_PILOT_USER_IDS` kann den Serverzugriff weiterhin auf Pilotkonten begrenzen. Die Navigation ist keine Zugriffskontrolle; der Server prüft Projekt- und Gruppenrechte bei jedem Zugriff.

## Reihenfolge für eine Zielumgebung

1. Datenbank und privaten Studio-Storage sichern. Laufende Exporte und Studio-Schreibvorgänge für das Wartungsfenster anhalten.
2. Die additive V3-Migration einspielen. Prüfen, dass vorhandene Projekte Version 2 und neu angelegte Projekte Version 3 erhalten.
3. Anwendung, Zero-Schema und Exportworker gemeinsam deployen. Die V3-Flags zunächst nur für Pilotkonten aktivieren.
4. Persönliche und Gruppenprojekte, private Assets, Offline-Wiederverbindung, Konflikte, Kommentare, Vorschläge, Abstimmungen und Exporte abnehmen.
5. Erst nach der Abnahme die Pilotbegrenzung erweitern. V2-Daten bleiben unverändert gespeichert.

Ein Rollback besteht aus dem Deaktivieren der beiden V3-Flags und dem Zurückrollen des Anwendungscodes. Die additive Versionsspalte und V2-Daten können bestehen bleiben.

## Prüfungen

Die schnellen, datenbankunabhängigen Prüfungen sind:

```powershell
pnpm studio:test
pnpm exec tsc --noEmit --pretty false
pnpm test:routes
pnpm test:action-catalog
pnpm test:accountability
pnpm test:db:coverage
pnpm build
```

Für die vollständige lokale Abnahme werden zusätzlich Supabase, Zero, Chromium und FFmpeg benötigt:

```powershell
pnpm exec supabase migration up --local
pnpm exec supabase test db --local
pnpm exec vitest run --project database-integration src/server/studio/__tests__/canvas-workflow.database-integration.test.ts
pnpm exec playwright test --config tools/e2e/studio/canvas.playwright.config.ts
pnpm exec tsx tools/e2e/studio/canvas-exports.ts
```

Testberichte, Screenshots und Authentifizierungszustände bleiben im ignorierten Verzeichnis `output`. Keine Abnahme darf Beiträge veröffentlichen oder kostenpflichtige KI-Aufrufe ausführen.
