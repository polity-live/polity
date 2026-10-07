# Studio: Zero-Einführung und Abnahme

Studio und Canvas sind in allen Umgebungen aktiv. Dauerhafte Daten werden über autorisierte Zero Queries gelesen und über typisierte Mutatoren verändert. Die JSON-Routen `POST /api/studio` und `GET /api/studio/read/:id` entfallen; Datei-, Medien- und Download-Routen bleiben bestehen.

## Einführung

1. Die additive Migration `20261007010000_studio_zero_commands.sql` zuerst anwenden. Sie ergänzt private Command-Receipts, Indizes, Replikation, private Realtime-Policies und die mit PostgreSQL übereinstimmende Zuordnung von Rollenrechten zur Mitgliedschaftsgruppe. Vorhandene Projekte und Dokumentversionen werden erhalten.
2. Anwendung und Zero-Schema gemeinsam aktualisieren. Exportworker weiter betreiben; verwaiste Dateien werden nur nach Ablauf der Schutzfrist und ohne Datenbankreferenz entfernt.
3. Die PWA aktualisieren und überprüfen, dass alte HTTP-Aufrufer durch die neue Clientversion ersetzt werden. Es gibt keinen dauerhaften HTTP-Fallback.
4. Unter https://www.polity.live Erstellung, bestätigte Persistenz, Rechteentzug, Upload und Export prüfen. Lokale und Produktions-PWA strikt getrennt verwenden.

## Verbindliche Prüfungen

- `pnpm studio:test`
- `pnpm studio:test:coverage`: 100 % Statements, Branches, Functions und Lines je erfasster neuer ausführbarer Datei, einschließlich des gemeinsamen Editor-Kontexts. CI führt diesen Lauf verbindlich aus und speichert die Coverage-Berichte.
- Typecheck, Lint, relevante PostgreSQL-/Sicherheitstests, Browser-/E2E-Tests, statische Katalogprüfungen und Build.

Die Zuordnung bisheriger Transportfälle zu Ersatztests steht in [studio-zero-migration-tests.json](studio-zero-migration-tests.json). Erfolgreiche Studio-Flows dürfen keine Requests an die entfernten JSON-Routen senden. Upload-Tokens und vertrauliche Dokumente werden nicht protokolliert. Logs werden über Operation-ID und Mutatorname zugeordnet.
