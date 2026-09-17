# Karten und kompakte Inhaltslisten

## Gemeinsame Bausteine

`src/features/shared/ui/collections` enthält `CollectionViewToggle`, `CollectionToolbar`, `EntityListRow`, den Kartenadapter und die Präferenzverwaltung. Die Darstellung beeinflusst weder die Bereichsabfrage noch Sortierung oder Berechtigungen. Die Typfarben sind in `EntityListRow` zentral definiert.

Neue Übersichten können `CollectionScope` mit einem registrierten Bereichsschlüssel verwenden. `CollectionControls` nimmt die bestehende Suche auf. Bestehende Timeline-Karten behalten ihre Controller und erlaubten Aktionen; `CollectionCard` ermöglicht explizite Zeilendaten. Eigenständige Renderer verwenden `EntityListRow` direkt. Titel führen zu bestehenden Details, Vorschauen verwenden den vorhandenen Preview-Provider.

## Eingebundene Bereiche

| Übersicht                                                             | Präferenzschlüssel                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Profil: Alle, Amendments, Gruppen, Blogs, Statements                  | `profile.all`, `profile.amendments`, `profile.groups`, `profile.blogs`, `profile.statements` |
| Gruppen-Amendments, verwandte Gruppen, Blogs/Statements, Dokumente    | `group.amendments`, `group.related`, `group.content`, `group.documents`                      |
| Mitglieder, Teilnehmende, Mitwirkende, Blog-Autoren auf Inhaltsseiten | `directory.group`, `directory.event`, `directory.amendment`, `directory.blog`                |
| Agenda einschließlich Wahlen und Votes                                | `agenda`                                                                                     |
| Change Requests in Amendments und eingebetteten Agenda-Listen         | `changeRequests` (gemeinsam über Status-/Branch-Gruppen)                                     |
| Persönlicher Kalender, Gruppenkalender, Netzwerk-Veranstaltungen      | `calendar`, `group.events`, `network.events`                                                 |
| Search einschließlich Users, Wahlen und Votes                         | Kompatible bestehende `searchView`-Präferenz und URL-Werte                                   |

Search behält `list` als URL-Wert für Karten und zusätzlich `compact` und `spatial`. Kalender behalten Wochen-/Monatsansichten. Ohne gespeicherte Auswahl gelten die bisherigen Standards. Verwaltungstabellen, Decision-Terminal-Widgets, Abstimmungsformulare, Editoren, Auswahlfelder und Story-Karussells sind nicht Teil dieser Umstellung. Beide Navigationen bleiben unverändert.

## Speicherung und Zustände

Registrierte Bereichsschlüssel stehen im Workspace-Schema. `workspace_preferences.display.collectionViews` wird pro Schlüssel zusammengeführt; eine zusätzliche Datenbankmigration ist nicht nötig. Die zentrale Provider-Instanz wartet auf geladene Präferenzen, bevor sie neue Auswahlwerte speichert. Eine zwischenzeitliche Nutzerauswahl hat Vorrang. Speicherfehler erzeugen einen Hinweis, ohne die nutzbare Ansicht zurückzusetzen. Gäste behalten ihre Auswahl für die Sitzung.

Cursor-Abfragen erhalten den bestehenden Such-/Filterkontext. Virtuelle Raster verwenden separate Verlaufsschlüssel für Karten und kompakte Zeilen, messen bei Layoutwechsel neu und stellen den sichtbaren Eintrag wieder her. Die vorhandene Zero-Listenvirtualisierung bleibt aktiv.

## Prüfung

Komponentenprüfungen decken verzögertes Laden, Speicherfehler, getrennte Bereichsschlüssel, gemeinsame Statusgruppen, Kalender-Kompatibilität, Detail-Links, Vorschau, vorhandene Aktionen, Agenda-Aktionen, Change-Request-Berechtigungen und den Scrollanker ab. Die zusätzliche Mutator-Prüfung sichert das Zusammenführen einzelner Präferenzschlüssel ab. Lokale Browser-Stichproben prüfen Search und Profilinhalte einschließlich Neuladen, aktiver Suche, Aktionsmenü und mobiler Darstellung.
