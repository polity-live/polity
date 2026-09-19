# Lokale Prüfung am 17. September 2026

Geprüft wurde ausschließlich die lokale Entwicklungsumgebung, ohne Deployment, externe Veröffentlichung oder kostenpflichtige KI-Anfragen.

Bestanden:

- Produktionsbuild, TypeScript-Prüfung und Oxlint.
- 48 Studio-Unit-/Komponententests; zusätzlich 27 bestehende Statement-/Vorschau-Tests, zwölf Mutations-Guard-Tests und 34 Service-Worker-Tests einschließlich des Schutzes privater Studio-Medien vor Offline-Caching.
- Der Abhängigkeits-Audit meldet nach gezielten Updates der transitiven Bibliotheken keine Laufzeit-Sicherheitsbefunde; alle 509 zugehörigen Authentifizierungs-/Berechtigungstests bestehen.
- Zwölf neue pgTAP-Assertions: persönliche und Gruppenrechte, Rechteentzug, serverseitiger Tabellenzugriff und privater Storage-Bucket. Das Schema ist dem Datenbank-Testinventar zugeordnet.
- Echter Service-Durchlauf: zwei Benutzer, direkter signierter 6-MB-Upload, Sperre unvollständiger Uploads, Dateitypprüfung, gleichzeitige Änderungen, Offline-Wiederverbindung, Zurückweisung ungültiger CRDT-Updates, private Projektkopien mit Medien, Export-Worker, Downloads, veröffentlichte/private Medien sowie gültige und ungültige HTTP-Range-Anfragen.
- PNG, PDF, bearbeitbare PPTX, Canva-Importpaket, XLSX und ZIP mit Video. Der MP4-Test enthält einen beschnittenen Clip und Ton; FFmpeg decodiert das Ergebnis vollständig.
- Vollständiges Acht-Wochen-Paket: 40 Beiträge, 136 PNGs, acht Videos mit je 25 Sekunden, zwei PPTX-Seitenformate, PDF, Excel und Kanaltexte. ZIP-Größe etwa 13,7 MB.
- Browserbedienung auf Desktop und bei 390 px Breite; PNG-Übergabe in den vorhandenen Statement-Dialog. Native Medienanfragen authentifizieren sich auch über die bestehenden Sitzungscookies.

Noch offene Repository-Gates:

- Für neue Studio-Quellen und UI-Aktionen fehlen noch formale Einträge mit exakten Testfallreferenzen im zentralen Accountability-Katalog. Die unabhängigen Service-/Export-Prüfprogramme ersetzen diese Referenzen nicht.
- Der Branch-Coverage-Inventarcheck meldet ein veraltetes Inventar. Eine vollständige instrumentierte 100-%-Abdeckung des neuen Studio-Codes ist nicht nachgewiesen.
- `test:all` stoppt bereits an vorhandenen Formatabweichungen aus anderen Änderungen auf diesem Branch. Die Studio-Dateien wurden separat formatiert und geprüft.
- Der globale pgTAP-Schemainventartest findet in der bestehenden lokalen Datenbank zwei zusätzliche ältere Funktionen: `refresh_group_discovery_acl_relation_trigger` und `sync_search_document_acl_legacy`. Diese wurden nicht entfernt. Die neuen Studio-Rechtetests bestehen.

Der Stand ist damit lokal funktional geprüft, aber **noch nicht als vollständig CI-grün oder mergefertig abgenommen**. Fly-Konfigurationen und Flags sind vorbereitet; ein Cloud-Deployment und eine Live-Prüfung mit einem tatsächlich konfigurierten KI-Modell stehen aus. Generierte Prüfdateien liegen unter `output/studio-smoke/` und `output/playwright/` und werden nicht eingecheckt.
