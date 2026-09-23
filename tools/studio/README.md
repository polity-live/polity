# Kommunikationsstudio und Whiteboards

Der aktuelle Implementierungs- und Prüfstand steht in [CANVAS-IMPLEMENTATION.md](CANVAS-IMPLEMENTATION.md). Studio V3 ist vollständig über Rollout-Flags abgesichert; deren Aktivierung ist eine separate Produktionsfreigabe.

## Lokal starten

1. Abhängigkeiten mit `pnpm install` installieren; Chromium und FFmpeg werden vom Exportworker benötigt.
2. Die bestehenden lokalen Daten erhalten. Neue Migrationen mit `pnpm exec supabase migration up --local` anwenden.
3. `pnpm dev:stack` startet Vite auf Port 3000, Zero auf Port 4848 und den Exportworker mit der lokalen Supabase-Instanz. `pnpm dev:stack:status` prüft den Zustand. `pnpm dev:stack:stop` beendet die verwalteten Dienste. Normales Starten führt keinen Datenbank-Reset aus.
4. Persönliche Projekte unter `/studio` und `/whiteboards`, Gruppenprojekte unter `/group/<id>/studio` und `/group/<id>/whiteboards` öffnen.

Es wird kein Yjs-/Hocuspocus-Dienst benötigt. Die Text-, Blog- und Streetdesign-Editoren verwenden weiterhin ihre bestehende Infrastruktur.

## Aktivierung und Daten

`canvasEnabled()` aktiviert die Canvas-Engine im Entwicklungsmodus, sofern `CANVAS_ENABLED` nicht `false` ist. Produktion benötigt ausdrücklich `CANVAS_ENABLED=true`, `STUDIO_V3_ENABLED=true` und `VITE_STUDIO_V3_ENABLED=true` sowie die bestehenden Studio-Freigaben. Die Navigation ist keine Zugriffskontrolle.

Excalidraw übernimmt die Canvas-Interaktion. Strukturierte Studio-Texte, Tabellen, Diagramme und Videos behalten ihre Quelldaten; ihre sichtbaren Canvas-Bilder sind abgeleitete Vorschauen. Plate bearbeitet weiterhin formatierte Studio-Texte.

PostgreSQL speichert bestätigte Inhalte, bedingte Elementoperationen, Generationen und Revisionen. Zero synchronisiert Hauptdokumente und autorisierte Vorschlagsräume. Supabase Realtime überträgt serverseitig autorisierte Anwesenheit über empfängerbezogene private Kanäle. Cursor und Auswahl sind vorübergehend und werden nicht als Dokumentinhalt gespeichert.

Hauptinhalt, private Vorschlagsentwürfe, eingereichte Fassungen und Abstimmungen sind getrennt. Ein angenommener Beschluss kann einen sichtbaren Anwendungskonflikt haben. Die unveränderte Änderung kann erneut geprüft werden; eine inhaltliche Klärung benötigt einen neuen Vorschlag und eine neue Abstimmung. Der alte Beschluss und seine Stimmen bleiben erhalten.

Persönliche Projekte sind nur ihrem Besitzer zugänglich. Die explizite Übernahme in eine Gruppe gibt auch Medien, Kommentare und die Versionshistorie für berechtigte Gruppenmitglieder frei und wechselt die Generation. Gruppenrollen können Vorschlagen, Kommentieren und Abstimmen unabhängig einschränken.

Das neue Studio speichert ausschließlich `StudioDocumentV3`. Bestehende V2-Projekte bleiben unverändert erhalten, werden weder migriert noch gelöscht und erscheinen nicht in V3-Listen. Die additive Schemaversion trennt beide Bestände. IDs und strukturierte Quellen werden nicht durch Rasterbilder ersetzt; sichtbare Projektionen lassen sich jederzeit aus den semantischen V3-Nodes ableiten.

## Medien und Exporte

Der Supabase-Bucket `studio` bleibt privat. Uploads werden auf Größe, Kontingent und Dateisignatur geprüft. Vorschlagsmedien haben einen eigenen Arbeitsbereich und werden erst bei erfolgreicher Beschlussanwendung in die Hauptmedien übernommen. Medien- und Exportdownloads prüfen die aktuellen Rechte erneut; ihre API-Adressen geben keine wiederverwendbaren Storage-Downloadlinks aus.

Exportaufträge verwenden bestätigte, unveränderliche Revisionen. Chromium rendert PNG/PDF, PptxGenJS PPTX, ExcelJS XLSX und FFmpeg MP4. Das Kampagnen-ZIP enthält Quelldaten, Medien und die bisherigen Kampagnendateien. SVG und `.excalidraw` werden zusätzlich über die Canvas-Oberfläche exportiert; Vorschlagsdateien tragen `ENTWURF` im Namen. Die Worker-Exporte von Vorschlagsfassungen sind noch nicht umgesetzt.

PPTX erhält strukturierte Studio-Texte, Tabellen und Diagramme sowie unterstützte präzise Excalidraw-Texte und Grundformen. Skizzeneffekte, Freihand und nicht abbildbare Formen werden als Grafik eingefügt. Canva wird weiterhin durch ein PPTX-Importpaket unterstützt. Abweichungen bei speziellen Canvas-Schriften und komplexen Bindungen sind vor einer Freigabe weiter zu prüfen.

## Prüfen

- `pnpm studio:test`
- `pnpm exec vitest run --project database-integration src/server/studio/__tests__/canvas-workflow.database-integration.test.ts`
- `pnpm test:db:coverage` und `pnpm exec supabase test db --local`
- `pnpm exec playwright test --config tools/e2e/studio/canvas.playwright.config.ts`
- `pnpm exec tsx tools/e2e/studio/canvas-exports.ts` nach Erstellung des lokalen visuellen Testbestands
- Die üblichen Repository-Prüfungen für Typen, Format, Lint, statische Verträge, Coverage, Sicherheit und Build bleiben verbindlich.

Testberichte, Screenshots und Authentifizierungszustände liegen ausschließlich unter dem ignorierten Verzeichnis `output`. Authentifizierungsdateien dürfen nicht eingecheckt werden. Keine Prüfung veröffentlicht Beiträge oder führt kostenpflichtige KI-Anfragen aus.

Excalidraw 0.18.1 wird unter der MIT-Lizenz verwendet. Der unveränderte Lizenztext liegt unter `public/licenses/excalidraw.txt`; die Quelle ist <https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE>.
