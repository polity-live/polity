# Kommunikationsstudio

Das Studio läuft in der Web-App unter `/studio` und `/group/<id>/studio`. Es benötigt weder Desktop-PowerPoint noch Codex. Die Quelltexte, Vorlagen, Migration und Exportprogramme gehören zum Repository; erzeugte Testdateien liegen im ignorierten Verzeichnis `output/`.

## Bedienung

1. Persönliches oder Gruppenstudio öffnen. Mit Vorlage oder KI-Briefing beginnen; Einzelpost, Event, Karussell, Story, Kurzvideo oder Kampagne wählen.
2. Kampagnenumfang festlegen (1–12 Wochen, bis zu drei Kernbeiträge und drei Story-Sequenzen pro Woche). Standard: vier Wochen, drei Kernbeiträge und zwei Story-Sequenzen.
3. Im Editor Event, Antrag oder Statement als Quelle übernehmen oder eigene Texte schreiben. Quellen sind Momentaufnahmen; erneutes Übernehmen aktualisiert sie ausdrücklich.
4. Texte und Flächen direkt auswählen, verschieben, skalieren und drehen. Eigenschaften erlauben genaue Werte. Umschalt-Klick wählt mehrere Elemente; Gruppieren, Ebenen, Sperren und Rückgängig stehen bereit. Medien werden privat hochgeladen. „Bild bearbeiten“ öffnet den bestehenden Fotoeditor.
5. Gruppen-Design unter „Gestaltung“ übernehmen. Farben und Schriften werden in passende vorhandene Elemente übernommen. Ein hochgeladenes Bild kann als Logo für alle Seiten dienen. Vorlagen speichern und anschließend als Projektkopie verwenden, um das Original zu erhalten.
6. Für eine Formatvariante Seite duplizieren und ihr Format ändern. Die Komposition wird proportional eingepasst. Texte und Bildausschnitte danach in der Vorschau prüfen.
7. Videos bestehen aus Hochkantseiten/Szenen, zusammen höchstens 60 Sekunden. Szenendauer, Clipbeginn, Stummschaltung, Einblendungen und Übergänge einstellen. Vorschau spielt die Szenen des Beitrags in Seitenreihenfolge ab.
8. Kanaltexte, Hauptaktion und bei Kampagnen Startdatum, relativen Veröffentlichungstag, Zuständigkeit und Status bearbeiten. KI-Vorschläge vor dem Übernehmen prüfen; bestehende Texte werden erst durch Übernahme geändert.
9. Seite, Beitrag oder gesamtes Projekt exportieren. Fertige einzelne PNGs oder MP4s lassen sich im vorhandenen Statement-/Story-Dialog weiterverwenden. Dort werden Sichtbarkeit, Story-Schalter, Umfragen und Veröffentlichung bestätigt.

## Exportverhalten

| Format | Ergebnis                                                                                |
| ------ | --------------------------------------------------------------------------------------- |
| PNG    | 1080 × 1350, 1080 × 1080 oder 1080 × 1920; mehrere Seiten als ZIP                       |
| PDF    | Eine Seite je Motiv, gerenderte Grafik in voller Auflösung                              |
| PPTX   | Native Texte, Formen und Bilder; Videos eingebettet; getrennte Dateien pro Seitenformat |
| Canva  | PPTX-Dateien und Importhinweise im ZIP; manueller Dateiimport in Canva                  |
| MP4    | 1080 × 1920, 30 fps, H.264, optional AAC; höchstens 60 Sekunden pro Beitrag             |
| XLSX   | Redaktionsplan mit Datumsformeln, drei Kanaltexten und leerer Auswertung                |
| ZIP    | PNGs, PDF, PPTX, Videos, Excel-Plan, Kanaltexte und separate hochgeladene Medien        |

PowerPoint-Texte, Formen und Bildausschnitte bleiben bearbeitbar. Für vollständige Animationen und den im Studio eingestellten Videoschnitt dient MP4. PPTX enthält die ursprünglichen Clips. Canva kann Schriftarten, Videos und Layoutdetails anders interpretieren; nach dem Import prüfen. Eine Canva-Kontoanbindung oder Rückübernahme extern bearbeiteter PPTX/XLSX-Dateien gibt es nicht. Die im Studio gespeicherte Version bleibt die Grundlage weiterer App-Exporte.

PowerPoint benötigt die gewählten Schriften auf dem Rechner; sie sind nicht in die PPTX eingebettet. Für die Polity-Vorlagen sind das Newsreader und Manrope. PNG, PDF und MP4 behalten ihre gerenderte Darstellung unabhängig von lokal installierten Schriften.

## Lokal starten

1. Die bestehende lokale Supabase-/Zero-/Vite-Umgebung starten. Migration `supabase/migrations/20260917090000_communication_studio.sql` mit dem üblichen lokalen Migrationsablauf anwenden. Keine bestehende Datenbank zurücksetzen.
2. Variablen aus `.env.example` in die bestehende lokale Umgebung übernehmen. `launch.ts` liest die vorhandenen `.env`-Dateien; bereits gesetzte Prozessvariablen haben Vorrang.
3. `pnpm install` und `pnpm exec playwright install chromium` ausführen. FFmpeg installieren oder `FFMPEG_PATH` setzen.
4. Zusätzlich zur App zwei Prozesse starten: `pnpm studio:collab` und `pnpm studio:worker`.

Die Vite-Dateiüberwachung nimmt erzeugte Exportdateien, Coverage-Berichte und Stryker-Testkopien aus. Umfangreiche lokale Testverzeichnisse sollen dadurch den Start und die Vorschau nicht blockieren.

Im Entwicklungsmodus ist die Funktion standardmäßig verfügbar. In Produktion müssen `VITE_STUDIO_ENABLED=true` beim App-Build sowie `STUDIO_ENABLED=true` auf App-Server und Kollaborationsdienst gesetzt sein. `STUDIO_PILOT_USER_IDS` begrenzt den Pilot auf ausgewählte Benutzer. Die Navigation allein ist keine Zugriffskontrolle.

## Dienste und Daten

- React-Konva bildet den Editor ab. Ein versioniertes, mit Zod validiertes Dokument beschreibt Seiten, Elemente, Gestaltung und Kampagnenbeiträge.
- Zero synchronisiert Projekt- und Exportmetadaten. Schreibende Studio-API-Aufrufe bestätigen serverseitige Speicherung; sie sind keine optimistischen Zero-Mutationen.
- Yjs/Hocuspocus synchronisiert Text und Elemente. IndexedDB hält lokale Änderungen für eine Wiederverbindung. PostgreSQL speichert den zusammengeführten Zustand. Ungültige Updates werden vor dem Verteilen abgewiesen.
- Aktive Gruppenmitglieder können Gruppenprojekte sehen und eigene Projekte anlegen. Bearbeiten dürfen Ersteller, Gruppeninhaber, Administratoren und Mitglieder mit `communicationStudio:update/manage` oder `groups:manage`. Persönliche Projekte bleiben beim Besitzer. Gruppenmitgliedschaft wird auch bei laufenden Verbindungen nachgeprüft.
- Supabase-Bucket `studio` ist privat. Uploads: PNG/JPEG/WebP/MP4, maximal 100 MB je Datei, 100 Dateien / 500 MB je Projekt. Die API reserviert das Kontingent; der Browser lädt direkt über einen signierten Upload-Token hoch. Erst nach Prüfung der Dateigröße und des Dateityps wird die Datei im Projekt verfügbar. Der Worker räumt abgebrochene Reservierungen nach drei Stunden auf. Bis dahin zählt auch ein fehlgeschlagener Upload zum Kontingent, damit verspätete Uploads über noch gültige Tokens erfasst bleiben.
- Downloads nutzen kurzlebige signierte URLs. In Polity verwendete Exporte haben eine dauerhafte API-Adresse, deren Zugriff die Sichtbarkeit des Statements prüft. Sie leitet für 30 Sekunden an den privaten Speicher weiter; ein bereits ausgestellter Link bleibt bis zum Ablauf gültig. Der Service Worker speichert Studio-Anfragen nicht zwischen. Verwendete Medien blockieren das Löschen ihres Projekts.
- Exportaufträge halten unveränderliche Revisionen fest. Der Worker reserviert Jobs mit `SKIP LOCKED`, meldet Fortschritt und erneuert seine Lease. Nach Worker-Abbruch wird zweimal neu versucht. Es sind höchstens fünf offene Aufträge je Benutzer vorgesehen.
- Der isolierte Chromium-Prozess rendert ohne externe Netzwerkzugriffe; FFmpeg erzeugt Videos, PptxGenJS PowerPoint und ExcelJS Tabellen. Schriften stammen aus den installierten Fontsource-Paketen.

## Bereitstellung

Die Fly-Konfigurationen `fly-collaboration.toml` und `fly-worker.toml` verwenden das Dockerfile in diesem Verzeichnis; Build-Kontext ist das Repository. App, Kollaborationsdienst und Worker benötigen Zugriff auf dieselbe Datenbank und denselben Supabase-Speicher. Schlüssel gehören in den jeweiligen Secret Store.

Der direkte Medientransport umgeht die [4,5-MB-Grenze für Vercel-Function-Payloads](https://vercel.com/docs/functions/limitations). Die App bearbeitet Upload-Freigaben und Zugriffsprüfungen; große Dateien und Video-Range-Antworten werden vom Speicher ausgeliefert.

Den Kollaborationsdienst mit **genau einer laufenden Instanz** betreiben (`fly scale count 1` und Deployment ohne zusätzliche HA-Instanz). Mehrere Instanzen benötigen zuerst einen gemeinsamen Pub/Sub-Transport; Datenbankpersistenz allein verteilt keine Live-Änderungen zwischen Instanzen. Worker dürfen unabhängig skaliert werden. Der App-Server gibt über `STUDIO_WEBSOCKET_URL` die öffentliche `wss://…`-Adresse des Dienstes aus.

Migration zuerst ausrollen, anschließend Dienste und App, dann Pilotflags aktivieren. Für einen Rollback Flags deaktivieren und den Worker kontrolliert stoppen; gespeicherte Projekte und veröffentlichte Medien erhalten. Die mitgelieferten Konfigurationen wurden nicht auf Fly bereitgestellt.

## Prüfung

- `pnpm studio:test`: Dokumentregeln, Kampagnenumfang, Datumsformeln, Formatwechsel, KI-Übernahme, konkurrierende Yjs-Änderungen, direkte Uploads und Byte-Range-Prüfung.
- `pnpm exec supabase test db supabase/tests/communication_studio.sql --local`: Datenbankrechte und privater Speicher.
- `node --import tsx tools/e2e/studio/smoke-export.ts`: reale PNG/PDF/PPTX/Canva/XLSX/ZIP-Dateien, eingebetteter Clip und decodierbares MP4. Benötigt Chromium und FFmpeg; Ausgaben unter `output/studio-smoke`.
- `node --import tsx tools/e2e/studio/smoke-service.ts`: ausschließlich lokale Dienste; legt eigene Testbenutzer/-projekte an und entfernt sie wieder. Prüft HTTP-Authentifizierung, Gruppenrechte, einen direkten 6-MB-Upload, Dateitypprüfung, zwei Live-Clients, Offline-Wiederverbindung, ungültige Updates, Worker und Sichtbarkeit von veröffentlichten Medien.

KI benötigt die bereits vorhandene Modellkonfiguration des jeweiligen Benutzers. Lokale Prüfungen lösen keine kostenpflichtigen Modellanfragen und keine externen Veröffentlichungen aus.
