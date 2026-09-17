# Ruhigere Oberflächen und schnellere Abläufe

## Umfang

Die Umsetzung ergänzt die bestehende Anwendung. Primäre und sekundäre Navigation, ihre Einstellungen, Tastenkürzel und Routen bleiben erhalten. Der Command-Dialog erhält zusätzliche Aktionen; seine bisherigen Navigationsgruppen bleiben bestehen. Berechtigungen und Entscheidungsregeln werden weiterhin von den bestehenden Abfragen und Mutatoren geprüft.

1. **Create:** durchsuchbare Auswahl, gemeinsame optionale Abschnitte, sichtbare Sichtbarkeit und Kontext, Feldfehler mit Fokus, erhaltene Formularansichten und Wiederherstellung. Alle neun Erstellungsabläufe warten vor der Erfolgsmeldung auf die Serverbestätigung. Der bestehende Wiederholungsablauf verwendet das bereits vorbereitete Objekt.
2. **Darstellung:** gemeinsame Inhaltskopfzeile, Sans-Serif für funktionale Titel, reduzierte Rahmen und Schatten innerhalb des Inhaltsbereichs. Redaktionelle Schriften und Navigationsgestaltung bleiben bestehen.
3. **Inhalte:** Home behält Timeline und Decisions; die Karte wird ausdrücklich eingeschaltet. Gruppen, Veranstaltungen und Anträge stellen Zweck, Status und Aktionen vor Medien. Aktivitätseinträge verbergen ausführliche Adressangaben in Details.
4. **Arbeitsansichten:** kompakte Aufgaben, Benachrichtigungen und zusätzliche kompakte Suchansicht; Kanban bleibt verfügbar. Explizite Vorschauen öffnen rechts auf Desktop und im Vollbild auf Mobilgeräten. Browser-Zurück, Fokus, Filter und Scrollposition bleiben erhalten. Aufgabenstatus, Zuständigkeit und Termin sind direkt bearbeitbar.
5. **Geschwindigkeit:** kontextbezogene Command-Aktionen, persönliche Favoriten und gespeicherte Suchansichten, Tastaturbedienung innerhalb von Listen und gespeicherte Darstellungsentscheidungen. Bestehendes Preloading, Zero-Abonnements, optimistische Datenaktualisierung und Virtualisierung bleiben die Grundlage.

## Datenbank und Einführung

Die additive Migration `20260916090000_workspace_preferences.sql` führt die JSON-Präferenzen ein. Neue Mutationen ändern ausschließlich die Präferenzen des angemeldeten Nutzers und erhalten vorhandene Einstellungen. Alte Datensätze ohne neue Werte werden mit leeren Favoriten und den bisherigen Darstellungsstandards gelesen.

`20260916091000_readable_search_summaries.sql` entfernt Editor-Strukturbegriffe aus Rich-Text-Zusammenfassungen und aktualisiert die vorhandenen Gruppen- und Veranstaltungszusammenfassungen. Sie ändert keine Sichtbarkeits- oder Zugriffsregeln.

Beide Migrationen sind lokal angewendet. Vor der Einführung in einer weiteren Umgebung müssen sie dort vor der neuen Anwendungsversion laufen. Es wurde keine Produktionsbereitstellung ausgeführt.

Die fünf oben genannten Pakete bilden die Reihenfolge für getrennte Releases. Create und die Inhaltsgestaltung können zuerst übernommen werden; die gespeicherten Karten- und Listenentscheidungen sowie Favoriten benötigen die Präferenzmigration. Vorschau-Provider und Vorschauaktionen werden zusammen eingeführt. Ein gestaffeltes Produktions-Rollout ist noch nicht erfolgt; es gibt keine zusätzlichen Laufzeit-Feature-Flags.

## Prüfung

Abschließender lokaler Stand: Produktionsbuild, TypeScript und Lint erfolgreich; 248 Testdateien mit 1.433 Unit-, Komponenten- und Ablaufprüfungen bestanden. `test:static` einschließlich Katalogen und 46 statischen Vertragstests ist erfolgreich. Die Formatprüfung der aktuellen Änderungen (`FORMAT_BASE_REF=HEAD`) und `git diff --check` bestehen. Die standardmäßige Formatprüfung bezieht zusätzlich den vorherigen Commit ein und meldet dort 41 bereits vorhandene Formatabweichungen außerhalb dieser Umsetzung.

Automatisiert geprüft werden die betroffenen Create-, Navigations-, Such-, Aufgaben-, Benachrichtigungs-, Timeline- und Wiki-Komponenten sowie Präferenzlogik. Zusätzliche Regressionstests prüfen insbesondere:

- Erhaltene optionale Eingaben und Fokus auf fehlerhaften Feldern.
- Ausstehende Serverbestätigung, abgewiesene Übermittlung und doppelte Betätigung.
- Vorschau mit Browser-Zurück/Vorwärts, Direktlink, erhaltenen Filtern, Scrollposition und wiederhergestelltem Fokus.
- Nachladende bzw. nicht verfügbare Vorschauinhalte sowie verzögerte Suchparameter während einer offenen Vorschau.
- Inline-Aufgabenänderungen, erlaubte Zuständigkeiten und Wiederholung nach Speicherfehlern.
- Favoriten mit Serverbestätigung, erhaltenem Kontext und privaten Präferenzen.
- Lesbare Suchprojektion mit 20 Datenbankprüfungen innerhalb einer zurückgerollten Testtransaktion.

Im lokalen Browser geprüft: Desktop und 390 × 844 Pixel, dunkle englische und helle deutsche Oberfläche, Todo-Erstellung mit Pflichtfeldfehler und Ansichtswechsel, Antragsformular mit Gruppenkontext und optionalen Medien, Aufgabenstatus, Desktop-/Mobilvorschau, Browser-Zurück, kompakte Suche sowie Favoriten im Command-Dialog. Die lokale Todo-Erstellung wurde zusätzlich auf genau ein angelegtes Objekt geprüft; das Testobjekt ist anschließend archiviert worden. Die ursprünglichen Einstellungen für Sprache, Theme, Formularansicht und Kanban wurden anschließend wiederhergestellt.

Dies ist keine vollständige visuelle Pixelprüfung aller Kombinationen aus Sprache, Theme und Bildschirmgröße. Eine solche Abnahme und ein Vergleich mit einer unveränderten Ausgangsversion gehören zur Release-Abnahme.

## Zeitvergleich vor dem Rollout

Es wurden keine belastbaren Vorher-/Nachher-Zeiten erhoben. Für eine vergleichbare Messung jeweils dieselbe lokale Datenbasis, dieselben Rechte, Browsergröße und Verbindungsbedingungen verwenden:

| Aufgabe                                        | Beginn                              | Bestätigtes Ende                             |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| Persönliches Todo mit Zuständigkeit und Termin | Öffnen von Create                   | Erfolgszustand nach Serverbestätigung        |
| Antrag mit Gruppenkontext und Zusatzangaben    | Öffnen von Create im Gruppenkontext | Erfolgszustand nach Serverbestätigung        |
| Bestehende Aufgabe bearbeiten                  | Gefilterte Aufgabenliste            | Bestätigter Status, Termin und Zuständigkeit |

Je Ablauf einen Übungsdurchgang und fünf Messdurchgänge durchführen; Median, Fehlerzahl und notwendige Seitenwechsel getrennt protokollieren. Gelegentliche Teilnehmende und regelmäßige Organisatoren getrennt betrachten. Langsame Verbindung und Serverfehler separat prüfen, ohne Testobjekte durch Wiederholung zu duplizieren.
