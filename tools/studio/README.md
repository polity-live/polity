# Kommunikationsstudio

Der aktuelle Implementierungs- und Prüfstand steht in [CANVAS-IMPLEMENTATION.md](CANVAS-IMPLEMENTATION.md). Die Aktivierung der neuen Studio-Engine bleibt eine separate Produktionsfreigabe.

## Lokal starten

1. Abhängigkeiten mit `pnpm install` installieren; Chromium und FFmpeg werden vom Exportworker benötigt.
2. Die bestehenden lokalen Daten erhalten. Neue Migrationen mit `pnpm exec supabase migration up --local` anwenden.
3. `pnpm dev:stack` startet Vite auf Port 3000, Zero auf Port 4848 und den Exportworker mit der lokalen Supabase-Instanz. `pnpm dev:stack:status` prüft den Zustand. `pnpm dev:stack:stop` beendet die verwalteten Dienste. Normales Starten führt keinen Datenbank-Reset aus.
4. Persönliche Projekte unter `/studio`, Gruppenprojekte unter `/group/<id>/studio` öffnen.

Es wird kein Yjs-/Hocuspocus-Dienst benötigt. Die Text-, Blog- und Streetdesign-Editoren verwenden weiterhin ihre bestehende Infrastruktur.

## Aktivierung und Daten

`canvasEnabled()` aktiviert die Canvas-Engine im Entwicklungsmodus, sofern `CANVAS_ENABLED` nicht `false` ist. Produktion benötigt ausdrücklich `CANVAS_ENABLED=true`, `STUDIO_V3_ENABLED=true` und `VITE_STUDIO_V3_ENABLED=true` sowie die bestehenden Studio-Freigaben. Die Navigation ist keine Zugriffskontrolle.

Konva zeichnet die semantischen Studio-Knoten. Rich Text bleibt als Plate-Inhalt gespeichert und wird bei direkter Bearbeitung als HTML-Editor an derselben Canvas-Position eingeblendet. Die Ebenenreihenfolge aus dem Layers-Panel gilt auch während der Bearbeitung.

PostgreSQL speichert bestätigte Inhalte, bedingte Elementoperationen, Generationen und Revisionen. Zero synchronisiert Hauptdokumente und autorisierte Vorschlagsräume. Supabase Realtime überträgt serverseitig autorisierte Anwesenheit über empfängerbezogene private Kanäle. Cursor und Auswahl sind vorübergehend und werden nicht als Dokumentinhalt gespeichert.

Hauptinhalt, private Vorschlagsentwürfe, eingereichte Fassungen und Abstimmungen sind getrennt. Ein angenommener Beschluss kann einen sichtbaren Anwendungskonflikt haben. Die unveränderte Änderung kann erneut geprüft werden; eine inhaltliche Klärung benötigt einen neuen Vorschlag und eine neue Abstimmung. Der alte Beschluss und seine Stimmen bleiben erhalten.

Persönliche Projekte sind dem Besitzer und Personen mit angenommener Einladung zugänglich. Gruppenprojekte und die gruppeneigene Elementbibliothek verwenden `projects:view` und `projects:manage`. Die explizite Übernahme in eine Gruppe gibt auch Medien, Kommentare und die Versionshistorie für berechtigte Gruppenmitglieder frei und wechselt die Generation. Gruppenrollen können Vorschlagen, Kommentieren und Abstimmen unabhängig einschränken.

Für die Produktionsumstellung zuerst `20260923060000_group_studio_project_rights.sql` und den Medien-Endpunkt mit Archiv-Fallback bereitstellen. Erst danach `20260923061000_retire_whiteboards.sql` anwenden. Die zweite Migration übernimmt von Beiträgen verwendete Exporte ins unabhängige Archiv, löscht die Whiteboard-Daten und erfasst die übrigen Storage-Dateien. Anschließend löscht `pnpm studio:cleanup-whiteboards` die erfassten Dateien. Der Lauf ist wiederholbar und nimmt archivierte Medien aus. Dafür werden `STUDIO_DATABASE_URL`, `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` benötigt.

Das neue Studio speichert semantische Dokumente der Schemaversion 5. Bestehende Dokumente werden vor Aktivierung durch den geplanten Datenbank-Reset entfernt; eine Migration alter Canvas-Daten ist nicht vorgesehen.

## Medien und Exporte

Der Supabase-Bucket `studio` bleibt privat. Uploads werden auf Größe, Kontingent und Dateisignatur geprüft. Vorschlagsmedien haben einen eigenen Arbeitsbereich und werden erst bei erfolgreicher Beschlussanwendung in die Hauptmedien übernommen. Medien- und Exportdownloads prüfen die aktuellen Rechte erneut; ihre API-Adressen geben keine wiederverwendbaren Storage-Downloadlinks aus.

Exportaufträge verwenden bestätigte, unveränderliche Revisionen. Chromium rendert Studio-V5-Knoten für PNG/PDF, PptxGenJS erzeugt editierbare PPTX/Canva-Elemente, ExcelJS XLSX und FFmpeg MP4. Das Kampagnen-ZIP enthält Quelldaten, Medien und die bisherigen Kampagnendateien. Vorschlagsdateien tragen `ENTWURF` im Namen. Die Worker-Exporte von Vorschlagsfassungen sind noch nicht umgesetzt.

PPTX erhält strukturierte Studio-Texte, Tabellen, Diagramme, Medien und unterstützte Formen als editierbare Elemente. Freihandzeichnungen werden als SVG eingefügt. Canva wird durch ein PPTX-Importpaket unterstützt. Abweichungen bei speziellen Schriften, Clipping und komplexen Bindungen sind vor der Produktionsfreigabe visuell zu prüfen.

## Prüfen

- `pnpm studio:test`
- `pnpm exec vitest run --project database-integration src/server/studio/__tests__/canvas-workflow.database-integration.test.ts`
- `pnpm test:db:coverage` und `pnpm exec supabase test db --local`
- `pnpm exec playwright test --config tools/e2e/studio/canvas.playwright.config.ts`
- `pnpm exec tsx tools/e2e/studio/canvas-exports.ts` für PNG, PDF, PPTX, Canva und Projektarchiv aus derselben V5-Szene
- Die üblichen Repository-Prüfungen für Typen, Format, Lint, statische Verträge, Coverage, Sicherheit und Build bleiben verbindlich.

Testberichte, Screenshots und Authentifizierungszustände liegen ausschließlich unter dem ignorierten Verzeichnis `output`. Authentifizierungsdateien dürfen nicht eingecheckt werden. Keine Prüfung veröffentlicht Beiträge oder führt kostenpflichtige KI-Anfragen aus.
