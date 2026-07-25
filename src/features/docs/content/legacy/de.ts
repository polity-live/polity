// Localized product guidance. The docs registry turns this content into navigable pages.
export const docsPageTranslations = {
  tones: {
    entry: 'START',
    action: 'AKTION',
    collaboration: 'KOOP',
    attention: 'ALARM',
    decision: 'ENTSCHEID',
    result: 'ERGEBNIS',
  },
  labels: {
    quickView: 'Schnellansicht',
    audience: 'Für wen',
    entry: 'Bester Einstieg',
    actions: 'Was Sie tun können',
    concepts: 'Wichtige Konzepte',
    watchFor: 'Worauf Sie achten sollten',
    states: 'Signale und Zustände',
    relatedTopics: 'Verwandte Themen',
    userPerspective: 'Aus Nutzersicht',
    exploreMore: 'Weiter erkunden',
    step: 'Schritt {{value}}',
  },
  hub: {
    searchLabel: 'Dokumentation durchsuchen',
    searchPlaceholder: 'Wonach suchst du?',
    searchHint: '/ drücken',
    searchResults: 'Suchergebnisse',
    noResults: 'Keine passenden Inhalte gefunden.',
    noResultsHint:
      'Versuche es mit einem Funktionsnamen, einer Aufgabe oder einem kürzeren Begriff.',
    startTitle: 'Erste Schritte',
    startDescription: 'Ein geführter Lernpfad für Nutzer und Organisatoren.',
    browseTitle: 'Alle Guides',
    browseDescription: 'Ausführliche Anleitungen zu jedem Bereich von Polity.',
    sidebarTitle: 'Dokumentation',
    openNavigation: 'Docs-Navigation öffnen',
    closeNavigation: 'Docs-Navigation schließen',
    onThisPage: 'Auf dieser Seite',
    showContents: 'Seitenübersicht anzeigen',
    overview: 'Überblick',
    related: 'Als Nächstes',
    readGuide: 'Guide öffnen',
    resultCount_one: '{{count}} Treffer',
    resultCount_other: '{{count}} Treffer',
    searchTitle: 'Dokumentation durchsuchen',
    searchDescription: 'Durchsuche alle Guides und öffne direkt den passenden Abschnitt.',
    clearSearch: 'Suche löschen',
    previousResult: 'Vorheriger Treffer',
    nextResult: 'Nächster Treffer',
  },
  overview: {
    navLabel: 'Überblick',
    title: 'Polity aus der Nutzerperspektive verstehen',
    subtitle:
      'Diese Dokumentation erklärt, wie Menschen in Polity Räume betreten, Arbeit koordinieren, Entscheidungen treffen und Ergebnisse verfolgen, ohne zuerst in technische Details gezwungen zu werden.',
    primaryCta: 'Mit Anmeldung beginnen',
    secondaryCta: 'Erstellungswege verstehen',
    pathwaysTitle: 'Typische Wege',
    pathways: {
      start:
        'Melden Sie sich an, richten Sie Ihr Profil ein, entdecken Sie relevante Gruppen und verstehen Sie, wo Sie im Netzwerk stehen.',
      coordinate:
        'Bewegen Sie sich zwischen Erstellung, Gruppen, Veranstaltungen, Nachrichten, Benachrichtigungen, Kalender, Aufgaben und Dokumenten, um tägliche Zusammenarbeit in Gang zu halten.',
      decide:
        'Nutzen Sie Amendments, Tagesordnungen, Change Requests, Abstimmungen, Wahlen und das Decision Terminal, um zu sehen, wie aus Vorschlägen sichtbare Ergebnisse werden.',
      'follow-through':
        'Verfolgen Sie über Timeline, Suche, Abonnements und Benachrichtigungen, was sich geändert hat, wer als Nächstes handeln muss und wo Arbeit in verbundenen Räumen weiterläuft.',
    },
    featuredTitle: 'Empfohlene Leitfäden',
    featuredDescription:
      'Beginnen Sie mit Anmeldung, Arbeitsräumen, Erstellungswegen und den wichtigsten Entscheidungsflüssen.',
    libraryTitle: 'Dokumentationsbibliothek',
    libraryDescription:
      'Durchsuchen Sie die vollständigen, nutzerorientierten Leitfäden nach Arbeitsbereich.',
  },
  categories: {
    people: {
      title: 'Menschen',
      description: 'Identität, Präsenz und wie Benutzer sich durch die Plattform bewegen.',
    },
    collaboration: {
      title: 'Zusammenarbeit',
      description: 'Gemeinsame Räume, Treffen, Schreiben und Veröffentlichungsabläufe.',
    },
    governance: {
      title: 'Governance',
      description: 'Vorschläge, Abstimmungen, Wahlen und Ergebnisverfolgung.',
    },
    coordination: {
      title: 'Koordination',
      description: 'Informationen finden, ausgerichtet bleiben und Arbeit im Zeitplan halten.',
    },
    systems: {
      title: 'Systeme',
      description:
        'Bereichsübergreifende Berechtigungs- und Routing-Systeme, die prägen, was Nutzer tun können und wohin Arbeit als Nächstes fließt.',
    },
  },
  topics: {
    'auth-and-onboarding': {
      navLabel: 'Anmeldung & Einstieg',
      title: 'Anmeldung und Einstieg',
      summary:
        'Kontoerstellung, E-Mail-Verifizierung, Passwort-Zurücksetzung und die ersten Schritte in den geschützten Arbeitsbereich.',
      audience:
        'Neue Nutzer, eingeladene Mitglieder und alle, die verstehen möchten, wie Polity vom öffentlichen Bereich in den persönlichen Arbeitsraum führt.',
      entry:
        'Beginnen Sie hier, wenn Sie Polity zum ersten Mal nutzen oder Probleme beim Einstieg einordnen möchten.',
      perspective:
        'Der Einstieg entscheidet, ob Polity sich wie eine offene Informationsseite oder wie ein persönlicher Arbeitsraum anfühlt.',
      outcome:
        'Nach einem erfolgreichen Einstieg kann ein Nutzer sein Profil pflegen, relevante Gruppen öffnen und alle geschützten Funktionen mit passendem Kontext nutzen.',
      actions: [
        'Ein Konto erstellen, sich anmelden oder den Verifizierungsfluss abschließen.',
        'Passwort- und E-Mail-Flows nutzen, wenn der Zugang wiederhergestellt werden muss.',
        'Nach dem Einstieg Profil, Sprache, Theme und erste relevante Räume prüfen.',
      ],
      concepts: [
        'Öffentliche Seiten erklären Polity, während geschützte Routen persönliche Daten und Zusammenarbeit öffnen.',
        'Supabase Auth steuert Identität, Sitzung und E-Mail-basierte Zugangsflüsse.',
        'Onboarding verbindet technische Anmeldung mit dem Aufbau einer nutzbaren Präsenz im Netzwerk.',
      ],
      watchFor: [
        'Ein noch nicht bestätigter oder abgelaufener Zugang fühlt sich oft wie ein Navigationsproblem an.',
        'Der erste erfolgreiche Login ist nur der Anfang; Profil und Mitgliedschaften machen den Arbeitsraum nützlich.',
        'Einladungen und bestehende Mitgliedschaften können beeinflussen, wo Nutzer nach der Anmeldung landen.',
      ],
      states: [
        'Nutzer können öffentlich, angemeldet, verifiziert, unvollständig eingerichtet oder unberechtigt sein.',
        'Der Einstieg ist gelungen, wenn Nutzer nicht nur eingeloggt sind, sondern wissen, wo ihre nächste Handlung liegt.',
      ],
      diagram: {
        title: 'Vom öffentlichen Einstieg zum Arbeitsraum',
        description: 'Der typische Weg von der Orientierung zur aktiven Nutzung.',
        steps: {
          'choose-entry': {
            title: 'Einstieg wählen',
            description:
              'Nutzer öffnen Anmeldung, Registrierung, Einladung oder Passwort-Wiederherstellung je nach Situation.',
          },
          'verify-account': {
            title: 'Zugang bestätigen',
            description:
              'E-Mail-Codes und Sitzungsprüfung stellen sicher, dass der richtige Nutzer den Arbeitsraum betritt.',
          },
          'complete-profile': {
            title: 'Arbeitsraum vorbereiten',
            description:
              'Profil, Einstellungen und erste relevante Räume machen aus dem Konto eine nutzbare Präsenz.',
          },
        },
      },
    },
    users: {
      navLabel: 'Benutzer',
      title: 'Benutzer',
      summary:
        'Profile, Mitgliedschaften, Abonnements und die persönliche Sicht auf Aktivitäten in Polity.',
      audience:
        'Alle, die starten, einer Gemeinschaft beitreten oder ihre Präsenz über mehrere Räume hinweg verwalten.',
      entry:
        'Beginnen Sie hier, wenn Sie verstehen möchten, wie eine einzelne Person die Plattform erlebt.',
      perspective:
        'Benutzer erleben Polity als verbundenen Arbeitsraum, in dem Profil, Mitgliedschaften, Abonnements und Benachrichtigungen bestimmen, was sich nah anfühlt.',
      outcome:
        'Ein gut eingerichteter Benutzer gelangt schneller in Gruppen, bemerkt relevante Updates früher und bewegt sich sicherer zwischen Zusammenarbeit und Entscheidungsräumen.',
      actions: [
        'Ein Profil anlegen und pflegen, das Ihre Rolle im Netzwerk darstellt.',
        'Gruppen beitreten, Räumen folgen und relevante Abonnements verfolgen.',
        'Vom Profilkontext in Nachrichten, Veranstaltungen oder Governance-Arbeit wechseln.',
      ],
      concepts: [
        'Ihr Benutzerkonto ist das Zentrum von Mitgliedschaften, Abonnements und Benachrichtigungen.',
        'Sichtbarkeit verändert sich je nachdem, welchen Gruppen und Veranstaltungen Sie angehören oder folgen.',
        'Persönlicher Kontext beeinflusst, welche Aktionen sich unmittelbar anfühlen und nicht nur, welche technisch erlaubt sind.',
      ],
      watchFor: [
        'Der Mitgliedschaftsstatus beeinflusst, was Sie in Gruppen sehen und tun können.',
        'Abonnements bestimmen, was in Benachrichtigungen landet und was still bleibt.',
        'Ihr Profil wird nützlicher, wenn es mit aktiven Gruppen und aktueller Arbeit verbunden ist.',
      ],
      states: [
        'Profile werden wertvoller, wenn Mitgliedschaften, Abonnements und Beteiligungsverlauf wachsen.',
        'Ein Benutzer kann in einem Raum peripher und in einem anderen zentral sein, je nach Rollen und Beziehungen.',
      ],
      diagram: {
        title: 'Wie ein Benutzer in Polity ankommt',
        description: 'Ein typischer Weg von der Kontoerstellung zur aktiven Teilnahme.',
        steps: {
          'create-profile': {
            title: 'Profil erstellen',
            description:
              'Richten Sie die Identität ein, die andere sehen, wenn Sie Räumen, Gesprächen und Entscheidungen beitreten.',
          },
          'join-spaces': {
            title: 'Relevanten Räumen beitreten',
            description:
              'Mitgliedschaften und Abonnements ziehen Gruppen, Veranstaltungen und Governance-Arbeit in Ihren Blickkreis.',
          },
          'stay-informed': {
            title: 'Informiert bleiben',
            description:
              'Benachrichtigungen, Nachrichten und Aktivitätsansichten verbinden Ihre persönliche Sicht mit laufender Arbeit.',
          },
        },
      },
    },
    groups: {
      navLabel: 'Gruppen',
      title: 'Gruppen',
      summary:
        'Gemeinsame Räume, in denen Mitglieder organisieren, Verantwortung zuweisen und Arbeit mit Governance verbinden.',
      audience: 'Organisatoren, Mitglieder und alle, die in einem kollektiven Raum arbeiten.',
      entry:
        'Nutzen Sie diesen Leitfaden, um den wichtigsten Kollaborationscontainer in Polity zu verstehen.',
      perspective:
        'Gruppen sind der Ort, an dem Nutzer Struktur am stärksten spüren: Mitgliedschaft, Berechtigungen, Dokumente, Veranstaltungen und Governance laufen hier zusammen.',
      outcome:
        'Wenn eine Gruppe gut organisiert ist, können Mitglieder Arbeit koordinieren, Entscheidungen veröffentlichen und Vorschläge mit weniger Reibung weiterleiten.',
      actions: [
        'Eine Gruppe erstellen oder ihr beitreten und in einem gemeinsamen Kontext arbeiten.',
        'Gruppendokumente, Veranstaltungen, Benachrichtigungen und verwandte Inhalte an einem Ort nutzen.',
        'Rollen und Verantwortlichkeiten vergeben, die steuern, was Mitglieder bearbeiten können.',
      ],
      concepts: [
        'Gruppen definieren den gemeinsamen Kontext für Zusammenarbeit und Governance.',
        'Eine Gruppe kann mit Eltern- oder Kindgruppen in einem größeren Netzwerk verbunden sein.',
        'Berechtigungen werden für Nutzer oft zuerst in einem Gruppenworkflow sichtbar.',
      ],
      watchFor: [
        'Änderungen bei Mitgliedschaften und Rollen wirken sich sofort auf verfügbare Aktionen aus.',
        'Öffentliche und private Gruppeneinstellungen verändern die Auffindbarkeit von Arbeit.',
        'Verbundene Gruppen können beeinflussen, wohin Vorschläge und Informationen als Nächstes fließen.',
      ],
      states: [
        'Eine Gruppe kann lokaler Arbeitsraum, Governance-Zentrum oder Teil einer größeren Hierarchie sein.',
        'Dieselbe Gruppe kann tägliche Koordination und formale Entscheidungen nebeneinander tragen.',
      ],
      diagram: {
        title: 'Ein typischer Gruppenzyklus',
        description: 'Wie Gruppen meist von der Einrichtung zur aktiven Zusammenarbeit gelangen.',
        steps: {
          'create-space': {
            title: 'Raum anlegen',
            description:
              'Starten Sie eine Gruppe mit klarer Identität, Mitgliedschaftsgrenzen und Zweck.',
          },
          'assign-roles': {
            title: 'Rollen zuweisen',
            description:
              'Bestimmen Sie, wer innerhalb der Gruppe bearbeiten, verwalten, organisieren oder steuern darf.',
          },
          'run-work': {
            title: 'Arbeit ausführen',
            description:
              'Nutzen Sie die Gruppe als Anker für Veranstaltungen, Amendments, Diskussionen und Entscheidungen.',
          },
        },
      },
    },
    events: {
      navLabel: 'Veranstaltungen',
      title: 'Veranstaltungen',
      summary:
        'Treffen und Zusammenkünfte mit Teilnehmern, Tagesordnungen, Positionen und sichtbaren Ergebnissen.',
      audience:
        'Organisatoren, Teilnehmer und Mitglieder, die verfolgen, was in einem geplanten Termin passiert.',
      entry:
        'Lesen Sie dies, wenn Sie verstehen möchten, wie Polity Koordination in einen realen Veranstaltungsfluss verwandelt.',
      perspective:
        'Veranstaltungen geben Nutzern einen konkreten Zeitpunkt und Ort, an dem Tagesordnungen, Teilnahme und Ergebnisse gemeinsam sichtbar werden.',
      outcome:
        'Eine gut durchgeführte Veranstaltung hinterlässt eine Spur: Teilnehmende verstehen, was passiert ist, was entschieden wurde und was als Nächstes folgt.',
      actions: [
        'Eine Veranstaltung anlegen und relevante Teilnehmer in den richtigen Kontext holen.',
        'Tagesordnungen und begleitende Materialien zur Vorbereitung vor dem Start nutzen.',
        'Positionen, Ergebnisse und nachgelagerte Arbeit nach der Veranstaltung überprüfen.',
      ],
      concepts: [
        'Veranstaltungen erben ihren Kontext oft von einer Gruppe, statt isoliert zu stehen.',
        'Tagesordnungspunkte geben Veranstaltungen ihre operative Struktur.',
        'Teilnahme, Abstimmung und Benachrichtigungen werden rund um Veranstaltungen zeitkritischer.',
      ],
      watchFor: [
        'Änderungen an Teilnehmerrollen können beeinflussen, wer spricht, abstimmt oder verwaltet.',
        'Das Timing der Tagesordnung beeinflusst, wie Entscheidungen im Decision Terminal erscheinen.',
        'Netzwerkkontext kann beeinflussen, wie Veranstaltungsergebnisse nach oben oder außen weiterwirken.',
      ],
      states: [
        'Eine Veranstaltung kann bevorstehen, aktiv oder abgeschlossen sein, aber Nutzeraufmerksamkeit verschiebt sich besonders rund um Agenda-Momente.',
        'Nutzer erleben Veranstaltungen oft als Brücke zwischen Zusammenarbeit und Governance.',
      ],
      diagram: {
        title: 'Von der Veranstaltungseinrichtung zum Ergebnis',
        description: 'Der Grundfluss, den die meisten Nutzer rund um eine Veranstaltung erleben.',
        steps: {
          'publish-event': {
            title: 'Veranstaltung veröffentlichen',
            description:
              'Machen Sie die Veranstaltung mit Zeit, Ort und relevantem Kontext sichtbar.',
          },
          'run-agenda': {
            title: 'Tagesordnung durchführen',
            description:
              'Führen Sie Teilnehmende in geordneter Folge durch Punkte, Diskussionen und Entscheidungen.',
          },
          'capture-outcomes': {
            title: 'Ergebnisse festhalten',
            description:
              'Machen Sie Resultate, Teilnahme und nächste Schritte sichtbar, sobald die Veranstaltung endet.',
          },
        },
      },
    },
    agendas: {
      navLabel: 'Tagesordnungen',
      title: 'Tagesordnungen',
      summary:
        'Strukturierte Veranstaltungsabläufe mit Punkten, Timing, verknüpften Vorschlägen, Entscheidungen und Nachbereitung.',
      audience:
        'Organisatoren, Moderatoren und Teilnehmer, die wissen müssen, was in einem Event wann behandelt wird.',
      entry:
        'Lesen Sie dies, wenn eine Veranstaltung mehr ist als ein Termin und konkrete Arbeit durch mehrere Punkte führt.',
      perspective:
        'Tagesordnungen verwandeln Veranstaltungen in einen nachvollziehbaren Ablauf, in dem Vorbereitung, Diskussion und Entscheidung zusammenfinden.',
      outcome:
        'Eine gute Tagesordnung hilft Teilnehmenden, vorbereitet zu sein, Entscheidungen im richtigen Moment zu erkennen und Ergebnisse später wiederzufinden.',
      actions: [
        'Tagesordnungspunkte erstellen, sortieren und mit Zeit, Status oder Typ versehen.',
        'Amendments, Change Requests, Abstimmungen oder Material an relevante Punkte knüpfen.',
        'Während und nach dem Event verfolgen, welche Punkte offen, aktiv oder abgeschlossen sind.',
      ],
      concepts: [
        'Agenda-Punkte geben einem Event operative Reihenfolge und gemeinsame Aufmerksamkeit.',
        'Ein Tagesordnungspunkt kann Diskussion, Präsentation, Abstimmung oder Vorbereitung tragen.',
        'Die Verbindung zu Votes und Change Requests macht sichtbar, wo formale Entscheidungen entstehen.',
      ],
      watchFor: [
        'Reihenfolge, Dauer und Status beeinflussen, wie Nutzer Dringlichkeit wahrnehmen.',
        'Verknüpfte Amendments oder Votes sollten direkt aus dem Punkt heraus erreichbar bleiben.',
        'Nach dem Event ist die Tagesordnung oft der beste Einstieg in Ergebnis- und Nacharbeitskontext.',
      ],
      states: [
        'Agenda-Punkte können geplant, aktiv, abgeschlossen, übersprungen oder weitergeleitet wirken.',
        'Nutzer lesen Tagesordnungen sowohl zur Vorbereitung als auch als Protokoll der tatsächlichen Arbeit.',
      ],
      diagram: {
        title: 'Wie eine Tagesordnung Arbeit ordnet',
        description: 'Der Ablauf von Planung zu Durchführung und Ergebnis.',
        steps: {
          'structure-meeting': {
            title: 'Meeting strukturieren',
            description:
              'Organisatoren legen Punkte, Reihenfolge, Timing und verknüpfte Inhalte fest.',
          },
          'run-items': {
            title: 'Punkte durchführen',
            description:
              'Teilnehmende bewegen sich durch Diskussionen, Materialien, Abstimmungen und offene Fragen.',
          },
          'record-decisions': {
            title: 'Entscheidungen festhalten',
            description:
              'Status, Resultate und Anschlussarbeit bleiben nach der Veranstaltung auffindbar.',
          },
        },
      },
    },
    amendments: {
      navLabel: 'Amendments',
      title: 'Amendments',
      summary:
        'Gemeinsames Formulieren, Diskussion, Weiterleitung und Entscheidungsabläufe für Text- und Politikänderungen.',
      audience:
        'Autoren, Mitwirkende, Prüfer und Mitglieder, die einen Vorschlag durch seinen Lebenszyklus verfolgen.',
      entry:
        'Öffnen Sie diesen Leitfaden, wenn Sie verstehen möchten, wie Text vom Entwurf zur Entscheidung gelangt.',
      perspective:
        'Nutzer sehen Amendments als lebende Vorschläge: Sie beginnen als Entwurf, sammeln Mitwirkende und Feedback und bewegen sich dann in Entscheidungen oder Weiterleitungswege.',
      outcome:
        'Ein klarer Amendment-Workflow hilft Nutzern zu sehen, ob ein Vorschlag noch geformt wird, lokal entscheidungsreif ist oder an anderer Stelle weitergeführt werden muss.',
      actions: [
        'Neue Texte entwerfen oder einen bestehenden Vorschlag für gemeinsame Arbeit öffnen.',
        'Diskussionen, Change Requests und Mitwirkendenaktivität rund um den Vorschlag verfolgen.',
        'Beobachten, ob das Amendment lokal entschieden oder durch das Netzwerk weitergeleitet wird.',
      ],
      concepts: [
        'Amendments vereinen Schreiben, Governance und Statuswechsel in einem Ablauf.',
        'Mitwirkende und Rollen beeinflussen, wer bearbeitet, kommentiert oder den Prozess steuert.',
        'Weiterleitung verbindet Amendment-Arbeit mit einer größeren Gruppenstruktur, wenn lokale Bearbeitung nicht das Ende ist.',
      ],
      watchFor: [
        'Statuswechsel zeigen Nutzern, ob das Amendment noch geformt wird oder in einen formalen Schritt übergeht.',
        'Change Requests erzeugen eine feinere Bearbeitungskonversation innerhalb des größeren Vorschlags.',
        'Verbundene Gruppen können verändern, wohin das Amendment als Nächstes reisen muss.',
      ],
      states: [
        'Amendments fühlen sich früh kollaborativ und später eher prozedural an.',
        'Für Nutzer ist meist nicht nur wichtig, was sich geändert hat, sondern wer als Nächstes handeln muss und wo.',
      ],
      diagram: {
        title: 'Wie sich ein Amendment bewegt',
        description: 'Eine nutzerorientierte Sicht auf den typischen Amendment-Weg.',
        steps: {
          'draft-text': {
            title: 'Text entwerfen',
            description: 'Erstellen Sie den ersten Vorschlagstext, auf den andere reagieren.',
          },
          collaborate: {
            title: 'Zusammenarbeiten',
            description:
              'Diskutieren, Änderungen anfordern und den Vorschlag gemeinsam verfeinern.',
          },
          'forward-or-vote': {
            title: 'Weiterleiten oder abstimmen',
            description:
              'Das Amendment lokal zur Entscheidung bringen oder durch das Netzwerk weiterführen.',
          },
        },
      },
    },
    'documents-and-editor': {
      navLabel: 'Dokumente & Editor',
      title: 'Dokumente und Editor',
      summary:
        'Kollaborative Dokumente, Rich-Text-Bearbeitung, Versionen, Präsenz und Bearbeitungsmodi für Gruppen, Nutzer, Blogs und Amendments.',
      audience:
        'Autorinnen, Mitwirkende und Gruppenmitglieder, die Texte gemeinsam erstellen, prüfen oder veröffentlichen.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Schreiben, Prüfen und Versionieren im Mittelpunkt eines Workflows stehen.',
      perspective:
        'Der Editor ist die Arbeitsfläche, auf der politische und organisatorische Inhalte von Ideen zu belastbaren Texten werden.',
      outcome:
        'Gute Dokumentarbeit macht sichtbar, wer am Text arbeitet, welche Version gilt und ob eine Änderung direkt, als Vorschlag oder nur lesend behandelt wird.',
      actions: [
        'Gruppen- und Nutzerdokumente öffnen, erstellen und im passenden Kontext bearbeiten.',
        'Zwischen Ansichts-, Vorschlags- und Bearbeitungsmodus wechseln, wenn Rechte und Workflow es erlauben.',
        'Versionen speichern, frühere Stände prüfen und Zusammenarbeit über Präsenzsignale einordnen.',
      ],
      concepts: [
        'Dokumente sind eigenständige Arbeitsflächen und zugleich Bestandteil von Gruppen, Blogs oder Amendments.',
        'Bearbeitungsmodi machen Rechte und gewünschte Review-Tiefe im Text selbst spürbar.',
        'Versionen geben Nutzern Vertrauen, dass gemeinsames Schreiben nachvollziehbar bleibt.',
      ],
      watchFor: [
        'Nicht jede Person darf direkt bearbeiten; manchmal sind Vorschläge oder reine Ansicht der richtige Modus.',
        'Autosave und Versionen lösen unterschiedliche Nutzerfragen: aktuelle Sicherheit und historische Nachvollziehbarkeit.',
        'Dokumentkontext entscheidet, ob ein Text privat, gruppenbezogen oder Teil eines formalen Amendment-Flusses ist.',
      ],
      states: [
        'Ein Dokument kann leer, in Bearbeitung, mit Vorschlägen versehen, versioniert oder nur lesbar sein.',
        'Nutzer achten besonders auf Modus, Speichersicherheit und sichtbare Mitarbeit anderer Personen.',
      ],
      diagram: {
        title: 'Vom Dokument zur geprüften Fassung',
        description: 'Wie Nutzer Dokumente typischerweise bearbeiten und absichern.',
        steps: {
          'open-document': {
            title: 'Dokument öffnen',
            description:
              'Der Kontext bestimmt, ob es sich um ein Gruppendokument, Blog, Profiltext oder Amendment handelt.',
          },
          'edit-or-suggest': {
            title: 'Bearbeiten oder vorschlagen',
            description:
              'Nutzer arbeiten direkt am Text oder markieren Änderungen als prüfbare Vorschläge.',
          },
          'save-version': {
            title: 'Version sichern',
            description:
              'Zwischenstände und Historie helfen, den aktuellen Text später zu erklären oder wiederherzustellen.',
          },
        },
      },
    },
    'change-requests-and-discussions': {
      navLabel: 'Change Requests & Diskussionen',
      title: 'Change Requests und Diskussionen',
      summary:
        'Strukturierte Änderungsanträge, Kommentare, Abstimmung über Vorschläge und nachvollziehbare Auflösung von Review-Arbeit.',
      audience:
        'Mitwirkende, Autoren, Prüfer und Gruppen, die Textänderungen nicht nur besprechen, sondern entscheiden müssen.',
      entry:
        'Lesen Sie dies, wenn ein Vorschlag konkrete Änderungen am Text oder Ablauf auslösen soll.',
      perspective:
        'Change Requests geben Diskussionen eine handhabbare Form: Was soll sich ändern, warum, wer unterstützt es und was passiert danach?',
      outcome:
        'Ein sauber gelöster Change Request reduziert Unsicherheit, weil Änderung, Begründung, Diskussion und Ergebnis zusammen sichtbar bleiben.',
      actions: [
        'Vorgeschlagene Änderungen als Difference, Vorschau oder Kommentarzusammenhang prüfen.',
        'Diskussionen eröffnen, beantworten und mit konkreten Textstellen oder Vorschlägen verbinden.',
        'Über Change Requests abstimmen und nachvollziehen, ob sie angenommen, abgelehnt oder weiter offen sind.',
      ],
      concepts: [
        'Change Requests sind der formale Review-Kanal zwischen freier Diskussion und direkter Textänderung.',
        'Kommentare erklären Kontext, während Stimmen oder Status entscheiden, was mit dem Vorschlag passiert.',
        'Automatische Auflösung kann Nutzer entlasten, wenn klare Mehrheiten oder Einstimmigkeit erreicht sind.',
      ],
      watchFor: [
        'Ein Kommentar ist noch keine Änderung; der Change Request verbindet Gespräch mit Handlungsoption.',
        'Abstimmungsrechte hängen vom jeweiligen Kollaborations- und Rollenkontext ab.',
        'Nutzer brauchen nach der Auflösung ein klares Signal, ob der Text tatsächlich verändert wurde.',
      ],
      states: [
        'Ein Change Request kann vorgeschlagen, diskutiert, unterstützt, angenommen, abgelehnt oder angewendet sein.',
        'Diskussionen fühlen sich produktiv an, wenn sie sichtbar zum nächsten Review- oder Entscheidungsschritt führen.',
      ],
      diagram: {
        title: 'Wie Review-Arbeit entschieden wird',
        description: 'Eine Spuransicht von Vorschlag über Diskussion bis Ergebnis.',
        lanes: {
          proposal: 'Vorschlag',
          discussion: 'Diskussion',
          decision: 'Entscheidung',
        },
        steps: {
          'propose-change': {
            title: 'Änderung vorschlagen',
            description:
              'Ein Nutzer beschreibt, welche Text- oder Ablaufänderung geprüft werden soll.',
          },
          'review-diff': {
            title: 'Diff prüfen',
            description:
              'Mitwirkende sehen Ergänzungen, Streichungen und betroffene Stellen im Kontext.',
          },
          'discuss-context': {
            title: 'Kontext diskutieren',
            description:
              'Kommentare klären Absicht, Risiken und Alternativen, bevor entschieden wird.',
          },
          'vote-request': {
            title: 'Über Vorschlag abstimmen',
            description:
              'Berechtigte Nutzer unterstützen, lehnen ab oder enthalten sich je nach Workflow.',
          },
          'apply-outcome': {
            title: 'Ergebnis anwenden',
            description: 'Der Status macht sichtbar, ob die Änderung übernommen wurde oder nicht.',
          },
        },
      },
    },
    blogs: {
      navLabel: 'Blogs',
      title: 'Blogs',
      summary:
        'Veröffentlichungsräume für Updates, Argumente, Ankündigungen und öffentliches Schreiben.',
      audience:
        'Autorinnen, Editoren, Organisatoren und Leser, die öffentlichen oder gruppenbezogenen Inhalten folgen.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Sie verstehen möchten, wie Veröffentlichungen in Polity eingebettet sind.',
      perspective:
        'Blogs geben Nutzern die Möglichkeit, Erzählung, Kontext und Position außerhalb rein prozeduraler Abläufe zu vermitteln.',
      outcome:
        'Gut genutzte Blogs machen Vorschläge verständlicher, halten Gemeinschaften informiert und verbinden Veröffentlichungen mit Diskussion und Suche.',
      actions: [
        'Beiträge entwerfen und veröffentlichen, die erklären, was passiert und warum es zählt.',
        'Blogs nutzen, um Gruppenarbeit oder Politikentwicklung mit einem breiteren Publikum zu verbinden.',
        'Kontext teilen, der Entscheidungen, Kampagnen oder laufende Gemeinschaftsarbeit stützt.',
      ],
      concepts: [
        'Blogs ergänzen Governance-Abläufe, indem sie Erklärung statt formaler Beschlussfassung tragen.',
        'Veröffentlichung kann öffentlich oder auf ein bestimmtes Publikum begrenzt sein.',
        'Suche und Benachrichtigungen entscheiden oft darüber, ob Blog-Inhalte tatsächlich gesehen werden.',
      ],
      watchFor: [
        'Veröffentlichungsrechte sind etwas anderes, als nur in einer Gruppe oder einem Blog präsent zu sein.',
        'Blog-Eigentümerschaft und Blogger-Rollen verändern, wer beitragen kann.',
        'Beiträge bilden oft die Erklärungsebene rund um formale Amendments oder Abstimmungen.',
      ],
      states: [
        'Ein Blogbeitrag kann je nach Kontext Information, Überzeugung oder Mobilisierung sein.',
        'Nutzer spüren den Wert von Blogs meist dann, wenn sie Erzählung und Handlung klar verbinden.',
      ],
      diagram: {
        title: 'Vom Entwurf zur Diskussion',
        description: 'Ein einfacher Veröffentlichungsweg innerhalb von Polity.',
        steps: {
          'draft-post': {
            title: 'Beitrag entwerfen',
            description:
              'Bereiten Sie die Botschaft, das Argument oder das Update vor, das Sie teilen möchten.',
          },
          publish: {
            title: 'Veröffentlichen',
            description:
              'Machen Sie den Beitrag zum richtigen Zeitpunkt für das gewünschte Publikum sichtbar.',
          },
          discuss: {
            title: 'Diskutieren',
            description:
              'Lassen Sie Leser reagieren, teilen und den Beitrag mit laufender Arbeit verbinden.',
          },
        },
      },
    },
    statements: {
      navLabel: 'Statements',
      title: 'Statements',
      summary:
        'Kurze öffentliche oder kontextbezogene Positionen, die Haltung, Argumente und Auffindbarkeit über Profile, Gruppen und Suche verbinden.',
      audience:
        'Nutzer, Gruppen und Leser, die Positionen sichtbar machen oder schnell erfassen möchten.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn eine Aussage kompakter sein soll als ein Blogbeitrag, aber mehr Kontext braucht als ein Kommentar.',
      perspective:
        'Statements geben Nutzern eine leichte Form, Haltung zu zeigen und in Such- oder Timeline-Kontexte einzutreten.',
      outcome:
        'Ein gutes Statement macht eine Position auffindbar, zitierbar und mit Profil, Hashtags oder verwandten Inhalten verbunden.',
      actions: [
        'Ein öffentliches oder eingeschränkt sichtbares Statement erstellen.',
        'Statements über Profil, Suche, Timeline oder verwandte Inhalte wiederfinden.',
        'Tags und Kontext nutzen, damit andere die Aussage richtig einordnen können.',
      ],
      concepts: [
        'Statements sind kürzer und direkter als Blogs, aber dauerhafter als Chat-Nachrichten.',
        'Sichtbarkeit und Tags entscheiden, ob ein Statement als persönliche Position oder breiter Beitrag wirkt.',
        'Related- und Suchflächen verbinden einzelne Aussagen mit größeren Themen.',
      ],
      watchFor: [
        'Kurze Aussagen brauchen klare Tags, damit sie nicht isoliert wirken.',
        'Private oder eingeschränkte Statements dürfen nicht wie öffentliche Positionen behandelt werden.',
        'Statements können Einstiegspunkte in Profile, Diskussionen oder verwandte Inhalte sein.',
      ],
      states: [
        'Ein Statement kann frisch erstellt, bearbeitet, sichtbar eingeschränkt oder über Suche wiederentdeckt sein.',
        'Nutzer bewerten Statements daran, ob sie schnell verständlich und im richtigen Kontext auffindbar sind.',
      ],
      diagram: {
        title: 'Wie ein Statement Kontext gewinnt',
        description: 'Der Weg von einer Position zur auffindbaren Aussage.',
        steps: {
          'publish-position': {
            title: 'Position veröffentlichen',
            description:
              'Nutzer formulieren eine klare Aussage mit passender Sichtbarkeit und Tags.',
          },
          'connect-context': {
            title: 'Kontext verbinden',
            description: 'Profil, Thema, Gruppe oder verwandte Inhalte helfen beim Einordnen.',
          },
          'surface-in-search': {
            title: 'In Suche und Timeline auftauchen',
            description:
              'Andere finden die Aussage wieder und springen von dort in den passenden Kontext.',
          },
        },
      },
    },
    elections: {
      navLabel: 'Wahlen',
      title: 'Wahlen',
      summary: 'Wettbewerbe um Rollen mit Nominierungen, Zeitfenstern und sichtbaren Ergebnissen.',
      audience: 'Organisatoren, Kandidaten und Wählende, die die Besetzung von Rollen verfolgen.',
      entry:
        'Öffnen Sie diesen Leitfaden, um zu verstehen, wie Rollen und Kandidaturen zu Wahlergebnissen werden.',
      perspective:
        'Für Nutzer sind Wahlen zeitgebundene Entscheidungen, die an eine Rolle, ein Kandidatenfeld und ein nachvollziehbares Ergebnis gebunden sind.',
      outcome:
        'Ein transparenter Wahlablauf reduziert Unsicherheit darüber, wer kandidieren darf, wann gewählt wird und wie das Ergebnis offiziell wird.',
      actions: [
        'Die mit einer Wahl verbundene Rolle definieren oder überprüfen.',
        'Kandidaturen und das Zeitfenster der Wahl verfolgen.',
        'Das Ergebnis in der Wahldetailansicht oder im Decision Terminal nachverfolgen.',
      ],
      concepts: [
        'Rollen geben Wahlen institutionelle Bedeutung über eine einzelne Abstimmung hinaus.',
        'Zeitfenster sind wichtig, weil Kampagne, Nominierung und Ergebnis sichtbare Phasen sind.',
        'Nutzer verstehen Wahlen oft am besten in Verbindung mit dem Decision Terminal und zugehörigen Benachrichtigungen.',
      ],
      watchFor: [
        'Kandidatur- und Teilnahmeregeln können von gewöhnlichen Stimmrechten abweichen.',
        'Ergebnisse können an mehreren Stellen sichtbar sein, beruhen aber auf derselben zugrunde liegenden Entscheidung.',
        'Der Rollenkontext hilft zu verstehen, was sich nach einer Wahl konkret ändert.',
      ],
      states: [
        'Wahlen fühlen sich vor dem Öffnen vorbereitend und nach dem Schließen verbindlich an.',
        'Nutzer suchen meist zuerst Kandidatensichtbarkeit und dann Ergebnisklarheit.',
      ],
      diagram: {
        title: 'Wie sich eine Wahl entfaltet',
        description: 'Der typische Weg von der Rollendefinition bis zur Ergebnisbestätigung.',
        steps: {
          'define-role': {
            title: 'Rolle definieren',
            description:
              'Verankern Sie die Wahl in einer Rolle oder einem Amt, das Nutzer verstehen können.',
          },
          nominate: {
            title: 'Kandidaten nominieren',
            description: 'Bauen Sie das Kandidatenfeld auf, damit Wählende sehen, wer antritt.',
          },
          'confirm-results': {
            title: 'Ergebnisse bestätigen',
            description: 'Schließen Sie die Wahl und machen Sie sichtbar, wer gewählt wurde.',
          },
        },
      },
    },
    votes: {
      navLabel: 'Abstimmungen',
      title: 'Abstimmungen',
      summary: 'Formale Entscheidungen mit Öffnungsfenstern, Stimmabgabe und klaren Ergebnissen.',
      audience:
        'Stimmberechtigte, Organisatoren und Beobachtende, die einem klar abgegrenzten Entscheidungsgegenstand folgen.',
      entry:
        'Nutzen Sie diesen Leitfaden, um zu verstehen, wie Polity formale Fragen darstellt und auflöst.',
      perspective:
        'Nutzer erleben Abstimmungen als fokussierte Entscheidungsfenster: Eine Frage erscheint, eine Abstimmungsphase öffnet sich und ein Ergebnis wird sichtbar.',
      outcome:
        'Ein klarer Abstimmungsfluss zeigt Teilnehmenden, was entschieden wird, wann Handeln möglich ist und wie das Endergebnis zu lesen ist.',
      actions: [
        'Die Abstimmungsfrage und ihren Kontext prüfen, bevor das Zeitfenster öffnet.',
        'Während der aktiven Phase abstimmen, wenn das Recht zur Teilnahme besteht.',
        'Das Ergebnis anschließend im passenden Kontext nachverfolgen.',
      ],
      concepts: [
        'Abstimmungen sind meist mit einem Tagesordnungspunkt, Vorschlag oder Gruppenkontext verbunden.',
        'Zeitpunkt und Berechtigung sind genauso wichtig wie der Stimmzettel selbst.',
        'Nutzer verlassen sich oft auf Benachrichtigungen und das Decision Terminal, um dringende Abstimmungen zu erkennen.',
      ],
      watchFor: [
        'Öffnungs- und Schließzeiten prägen, ob eine Abstimmung bevorstehend, aktiv oder bereits erledigt wirkt.',
        'Stimmrechte können enger sein als allgemeine Mitgliedschaft.',
        'Ergebnissichtbarkeit ist wichtig, weil Nutzer verstehen müssen, ob sich konkret etwas geändert hat.',
      ],
      states: [
        'Abstimmungen wechseln schnell von Vorbereitung zu Dringlichkeit zu Endgültigkeit.',
        'Nutzer interessieren sich meist am stärksten für Berechtigung, Timing und die Wirkung des Ergebnisses.',
      ],
      diagram: {
        title: 'Ein typischer Abstimmungsablauf',
        description: 'Wie Nutzer einer Abstimmung von der Vorbereitung bis zum Ergebnis begegnen.',
        steps: {
          'prepare-question': {
            title: 'Frage vorbereiten',
            description:
              'Formulieren Sie das Thema klar, damit Teilnehmende wissen, worum es geht.',
          },
          'cast-ballot': {
            title: 'Stimme abgeben',
            description:
              'Ermöglichen Sie berechtigten Teilnehmenden die Abstimmung im aktiven Fenster.',
          },
          'review-result': {
            title: 'Ergebnis prüfen',
            description:
              'Schließen Sie die Abstimmung und zeigen Sie, ob der Vorschlag angenommen, abgelehnt oder unentschieden war.',
          },
        },
      },
    },
    'decision-terminal': {
      navLabel: 'Decision Terminal',
      title: 'Decision Terminal',
      summary:
        'Eine schnelle, statusorientierte Ansicht auf laufende und kürzlich geschlossene Abstimmungen und Wahlen.',
      audience:
        'Menschen, die aktive Entscheidungen, dringende Punkte oder frisch geschlossene Ergebnisse beobachten.',
      entry:
        'Öffnen Sie diesen Leitfaden, wenn Sie die Echtzeit-Entscheidungsoberfläche der App verstehen möchten.',
      perspective:
        'Das Decision Terminal verdichtet Dringlichkeit in lesbare Signale: Was ist live, was öffnet bald, und was wurde gerade geschlossen.',
      outcome:
        'Nutzer können Aufmerksamkeit schnell priorisieren, das richtige Element im richtigen Moment prüfen und kritische Entscheidungen nicht verpassen.',
      actions: [
        'Live- und bald öffnende Elemente scannen, ohne jedes Detail einzeln zu öffnen.',
        'Ein Element prüfen, um Timing, Status und Ergebniszusammenhang zu verstehen.',
        'Terminal-Signale als Triage-Oberfläche für Governance-Arbeit nutzen.',
      ],
      concepts: [
        'Das Terminal ist eine Statusoberfläche und nicht nur eine Liste von Entscheidungen.',
        'Badges und Zeitsignale sind wichtig, weil sie Dringlichkeit visuell verdichten.',
        'Abstimmungen und Wahlen erscheinen gemeinsam, damit Nutzer Governance an einem Ort überwachen können.',
      ],
      watchFor: [
        'Ein Element kann sichtbar sein, bevor es handlungsrelevant ist, wenn es bald öffnet.',
        'Geschlossene Ergebnisse bleiben wichtig, weil sie Folgearbeit an anderer Stelle auslösen.',
        'Das Terminal liest sich am besten als Entscheidungsradar und nicht als vollständiger Arbeitsbereich.',
      ],
      states: [
        'Offen-, Schließt-bald-, Letzte-Stunde-, Letzte-Minuten- und Ergebniszustände verändern, wie dringend ein Element wirkt.',
        'Nutzer wechseln meist erst dann vom Scannen in die Tiefe, wenn das Signal Dringlichkeit oder Konsequenz anzeigt.',
      ],
      diagram: {
        title: 'Wie Nutzer das Decision Terminal lesen',
        description: 'Ein typischer Aufmerksamkeitsfluss vom Signal zur Einordnung.',
        steps: {
          'watch-live': {
            title: 'Live-Signale beobachten',
            description: 'Scannen Sie, was aktiv ist, bald öffnet oder gerade entschieden wurde.',
          },
          'inspect-item': {
            title: 'Element prüfen',
            description:
              'Öffnen Sie den Detailkontext, sobald eine Entscheidung relevant oder dringend wird.',
          },
          'follow-result': {
            title: 'Ergebnis verfolgen',
            description: 'Nutzen Sie das sichtbare Ergebnis, um die nächste Handlung zu steuern.',
          },
        },
      },
    },
    timeline: {
      navLabel: 'Timeline',
      title: 'Timeline',
      summary:
        'Der persönliche Überblick über abonnierte Inhalte, Entdeckung, Aktivität und wichtige Entscheidungsereignisse.',
      audience:
        'Alle, die schnell aufholen, neue öffentliche Inhalte entdecken oder aus Signalen zurück in Arbeit springen möchten.',
      entry:
        'Beginnen Sie hier, wenn die Plattform größer wird als einzelne Gruppen- oder Eventseiten.',
      perspective:
        'Die Timeline ist der Puls der App: Sie zeigt, was sich bewegt, warum es relevant sein könnte und wo Nutzer weiterarbeiten können.',
      outcome:
        'Eine gute Timeline reduziert Suchaufwand, bringt relevante Arbeit nach vorne und macht Entscheidungen im richtigen Moment sichtbar.',
      actions: [
        'Abonnierte Inhalte, öffentliche Entdeckungen und Entscheidungsereignisse in einem Feed scannen.',
        'Nach Typen oder Relevanz filtern, um bei vielen Signalen nicht den Überblick zu verlieren.',
        'Aus Karten direkt in Gruppen, Events, Amendments, Votes oder Diskussionen springen.',
      ],
      concepts: [
        'Following zeigt Nähe, Explore zeigt Entdeckung und Decisions zeigt formale Dringlichkeit.',
        'Karten sind Einstiegspunkte in native Workflows, nicht Ersatz für Detailseiten.',
        'Relevanz entsteht aus Abonnements, Sichtbarkeit, Aktivität und Inhaltstypen.',
      ],
      watchFor: [
        'Nutzer brauchen erkennbare Gründe, warum ein Inhalt angezeigt wird.',
        'Zu viele gleichartige Karten machen Filter und klare Typ-Signale wichtig.',
        'Decision-Signale müssen sich dringender anfühlen als allgemeine Aktivität.',
      ],
      states: [
        'Die Timeline kann leer, gefiltert, abonnementsbasiert, explorativ oder entscheidungsorientiert sein.',
        'Nutzer wechseln zwischen Scannen und Detailprüfung, sobald ein Signal wichtig wird.',
      ],
      diagram: {
        title: 'Vom Folgen zur Handlung',
        description: 'Wie Timeline-Signale Nutzer zurück in relevante Arbeit bringen.',
        steps: {
          'follow-sources': {
            title: 'Quellen folgen',
            description:
              'Abonnements, Mitgliedschaften und Sichtbarkeit bestimmen, welche Inhalte nah wirken.',
          },
          'scan-feed': {
            title: 'Feed scannen',
            description:
              'Karten, Filter und Entscheidungszustände helfen, Wichtiges schnell zu erkennen.',
          },
          'open-work': {
            title: 'Arbeit öffnen',
            description:
              'Nutzer springen aus dem Signal in den eigentlichen Gruppen-, Event- oder Entscheidungsworkflow.',
          },
        },
      },
    },
    search: {
      navLabel: 'Suche',
      title: 'Suche',
      summary:
        'Menschen, Räume, Inhalte und Entscheidungen finden, ohne genau zu wissen, wo sie liegen.',
      audience:
        'Alle, die sich in einem großen Arbeitsraum bewegen, Inhalte wiederfinden oder quer durch Funktionen springen.',
      entry: 'Nutzen Sie diesen Leitfaden, wenn Navigation aus Erinnerung nicht mehr ausreicht.',
      perspective:
        'Suche ist die Abkürzung des Nutzers durch Plattformkomplexität, besonders wenn Arbeit über viele Gruppen und Inhaltstypen verteilt ist.',
      outcome:
        'Effektive Suche macht aus einem dichten Arbeitsraum einen, den Nutzer sicher durchqueren können, ohne Kontext zu verlieren.',
      actions: [
        'Über verschiedene Inhaltstypen hinweg von einem Einstiegspunkt suchen.',
        'Mit der Suche direkt in die richtige Gruppe, Diskussion oder Entscheidung springen.',
        'Kontext schnell wiederherstellen, wenn eine Benachrichtigung oder Nachricht allein zu ungenau ist.',
      ],
      concepts: [
        'Suche wird wichtiger, je mehr Inhalte und Beziehungen sich vermehren.',
        'Ein starkes Suchergebnis ist oft eine Brücke in einen tieferen Workflow und nicht das Ende der Aufgabe.',
        'Nutzer verlassen sich auf Suche, wenn sie wissen, was sie brauchen, aber nicht, wo es gerade liegt.',
      ],
      watchFor: [
        'Suche fühlt sich nur nützlich an, wenn Titel, Zusammenfassungen und Kontext verständlich sind.',
        'Filter werden wichtig, sobald Nutzer in vielen ähnlichen Räumen arbeiten.',
        'Suche kann in öffentliche oder private Kontexte führen, je nach Sichtbarkeitsregeln.',
      ],
      states: [
        'Suche beginnt oft breit und wird schnell enger, sobald der richtige Kontext erkannt wird.',
        'Nutzer messen Suchqualität daran, wie schnell sie wieder in Handlung gelangen.',
      ],
      diagram: {
        title: 'Wie Suche beim Navigieren hilft',
        description: 'Ein typischer Weg von der breiten Suche zum konkreten Ziel.',
        steps: {
          'search-across': {
            title: 'Über den Arbeitsraum suchen',
            description: 'Starten Sie mit einem Thema, Namen oder Element, das Sie finden möchten.',
          },
          'narrow-context': {
            title: 'Kontext eingrenzen',
            description:
              'Nutzen Sie Ergebnisse und sichtbare Hinweise, um den richtigen Raum oder Gegenstand zu erkennen.',
          },
          'jump-to-target': {
            title: 'Zum Ziel springen',
            description:
              'Öffnen Sie das Ergebnis und setzen Sie die eigentliche Aufgabe im nativen Kontext fort.',
          },
        },
      },
    },
    messages: {
      navLabel: 'Nachrichten',
      title: 'Nachrichten',
      summary:
        'Direkte Kommunikation für Koordination, Klärung und schnellen Anschluss an laufende Arbeit.',
      audience:
        'Mitglieder und Organisatoren, die schnelle Kommunikation rund um aktive Arbeit benötigen.',
      entry:
        'Lesen Sie dies, wenn Sie verstehen möchten, wie direkte Kommunikation in Polity-Workflows passt.',
      perspective:
        'Nachrichten helfen Nutzern, die Lücke zwischen formaler Struktur und unmittelbarer Koordination zu schließen.',
      outcome:
        'Wenn Messaging gut genutzt wird, lösen Menschen Blocker schneller und kehren mit weniger Verzögerung in den passenden Kontext zurück.',
      actions: [
        'Direkte Gespräche mit relevanten Personen beginnen oder fortführen.',
        'Timing, Verantwortung oder Kontext rund um aktive Arbeit klären.',
        'Nachrichten als Brücke zu Entscheidungen, Veranstaltungen und Aufgaben nutzen statt als getrenntes Silo.',
      ],
      concepts: [
        'Nachrichten sind oft der Ort, an dem Unklarheiten vor einer Handlung aufgelöst werden.',
        'Konversation ist am stärksten, wenn sie an gemeinsamen Kontext anknüpft.',
        'Nutzer kombinieren Nachrichten häufig mit Benachrichtigungen und Suche für schnelle Orientierung.',
      ],
      watchFor: [
        'Direkte Kommunikation schafft Geschwindigkeit, doch formaler Kontext bleibt für dauerhafte Entscheidungen nötig.',
        'Threads sind am wertvollsten, wenn sie auf Gruppen, Veranstaltungen oder Vorschläge zurückverweisen.',
        'Ungelesen-Zustände bestimmen, ob Nachrichten dringend oder nur hintergründig wirken.',
      ],
      states: [
        'Nachrichten bewegen sich meist von schneller Koordination zu Handlung an anderer Stelle der Plattform.',
        'Nutzer lesen Messaging-Gesundheit an Reaktionsgeschwindigkeit und geteilter Kontextfähigkeit ab.',
      ],
      diagram: {
        title: 'Ein einfacher Koordinationskreislauf',
        description: 'Wie Messaging andere Workflows meist unterstützt.',
        steps: {
          'open-thread': {
            title: 'Thread öffnen',
            description: 'Starten Sie ein direktes Gespräch rund um das aktuelle Thema.',
          },
          coordinate: {
            title: 'Koordinieren',
            description:
              'Tauschen Sie Informationen aus, die Unklarheit oder Verzögerung beseitigen.',
          },
          'follow-links': {
            title: 'Verknüpften Kontext öffnen',
            description:
              'Kehren Sie in die relevante Gruppe, Veranstaltung oder Entscheidung zurück, sobald Klarheit besteht.',
          },
        },
      },
    },
    notifications: {
      navLabel: 'Benachrichtigungen',
      title: 'Benachrichtigungen',
      summary:
        'Signale, die Nutzern helfen zu bemerken, was sich geändert hat, was Handlung braucht und was warten kann.',
      audience:
        'Alle, die mehrere Räume, Fristen oder aktive Entscheidungen gleichzeitig im Blick behalten.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Sie verstehen möchten, wie Polity Dringlichkeit und Relevanz sichtbar macht.',
      perspective:
        'Benachrichtigungen prägen das Gefühl von Bewegung, indem sie entscheiden, was Aufmerksamkeit durchbricht und was im Hintergrund bleibt.',
      outcome:
        'Wenn Benachrichtigungssignale gut abgestimmt sind, reagieren Nutzer schneller, ohne sich von Lärm überflutet zu fühlen.',
      actions: [
        'Hinweise zu Gruppen, Veranstaltungen, Amendments und Entscheidungen prüfen.',
        'Priorisieren, was sofortige Handlung braucht und was später gelesen werden kann.',
        'Benachrichtigungen nutzen, um schnell in den richtigen Workflow zurückzuspringen.',
      ],
      concepts: [
        'Benachrichtigungen sind nicht nur Erinnerungen, sondern eine Routing-Schicht in aktive Arbeit.',
        'Entity-spezifische Hinweise können sich anders anfühlen als globale Benachrichtigungen.',
        'Dringlichkeit funktioniert nur, wenn Nutzer darauf vertrauen, dass Wichtiges zum richtigen Zeitpunkt sichtbar wird.',
      ],
      watchFor: [
        'Zu viele Hinweise verringern das Vertrauen in das Signal.',
        'Unterschiedliche Entity-Typen erzeugen Benachrichtigungen aus unterschiedlichen Gründen.',
        'Nutzer kombinieren Benachrichtigungen oft mit Suche und Nachrichten, um Kontext schnell wiederherzustellen.',
      ],
      states: [
        'Benachrichtigungen können je nach Timing und Inhalt hintergründig, wichtig oder dringend wirken.',
        'Ein starkes Benachrichtigungssystem spart Nutzern das ständige manuelle Prüfen aller Räume.',
      ],
      diagram: {
        title: 'Vom Hinweis zur Handlung',
        description: 'Eine typische Art, wie Nutzer Benachrichtigungen verarbeiten.',
        steps: {
          'receive-alerts': {
            title: 'Hinweise erhalten',
            description: 'Signale treffen ein, wenn sich etwas Wichtiges ändert oder öffnet.',
          },
          prioritize: {
            title: 'Priorisieren',
            description: 'Entscheiden Sie, was jetzt Aufmerksamkeit braucht und was warten kann.',
          },
          act: {
            title: 'Handeln',
            description:
              'Öffnen Sie den passenden Workflow und setzen Sie aus dem richtigen Kontext fort.',
          },
        },
      },
    },
    'pwa-and-notifications': {
      navLabel: 'PWA & Push',
      title: 'PWA und Push-Benachrichtigungen',
      summary:
        'Installierbare App-Oberfläche, Browser-Benachrichtigungen und schnelle Rückwege in aktuelle Arbeit.',
      audience:
        'Nutzer, die Polity regelmäßig verwenden und wichtige Updates auch außerhalb des offenen Browser-Tabs bemerken möchten.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Polity sich wie eine App auf dem Gerät verhalten soll.',
      perspective:
        'PWA und Push machen Polity präsenter, ohne dass Nutzer ständig alle Räume manuell öffnen müssen.',
      outcome:
        'Richtig eingerichtet können Nutzer schneller zurückkehren, wichtige Hinweise sehen und trotzdem über Benachrichtigungseinstellungen Kontrolle behalten.',
      actions: [
        'Die App installieren, wenn das Gerät oder der Browser es anbietet.',
        'Browser-Benachrichtigungen aktivieren oder ablehnen und die Wirkung verstehen.',
        'Über Push- oder App-Einstieg direkt in relevante Benachrichtigungskontexte zurückkehren.',
      ],
      concepts: [
        'PWA-Installation betrifft Zugriff und Verhalten auf dem Gerät, nicht Berechtigungen innerhalb von Polity.',
        'Push-Benachrichtigungen ergänzen die interne Benachrichtigungsseite.',
        'Nutzerkontrolle bleibt wichtig, weil App-Präsenz ohne gute Signalqualität schnell störend wird.',
      ],
      watchFor: [
        'Browser- und Betriebssystemrechte können verhindern, dass Push überhaupt sichtbar wird.',
        'Nicht jede interne Benachrichtigung sollte automatisch als Push erscheinen.',
        'Installationshinweise sollten Arbeit erleichtern und nicht als Marketingfläche wirken.',
      ],
      states: [
        'Ein Gerät kann nicht installierbar, installierbar, installiert, push-fähig oder push-blockiert sein.',
        'Nutzer spüren den Wert vor allem dann, wenn ein Hinweis sie direkt in die richtige Aufgabe zurückführt.',
      ],
      diagram: {
        title: 'Wie Polity als App näher rückt',
        description: 'Vom Installationsangebot zur schnellen Rückkehr in Arbeit.',
        steps: {
          'install-app': {
            title: 'App installieren',
            description:
              'Nutzer speichern Polity als App-ähnlichen Einstieg auf einem unterstützten Gerät.',
          },
          'allow-notifications': {
            title: 'Hinweise erlauben',
            description:
              'Browser- und App-Einstellungen bestimmen, ob wichtige Signale außerhalb der Seite ankommen.',
          },
          'return-fast': {
            title: 'Schnell zurückkehren',
            description:
              'Ein Hinweis oder App-Start bringt Nutzer wieder in den passenden Workflow.',
          },
        },
      },
    },
    calendar: {
      navLabel: 'Kalender',
      title: 'Kalender',
      summary: 'Eine Terminansicht, die Treffen, Fristen und kommende Arbeit zeitlich einordnet.',
      audience: 'Alle, die Teilnahme planen oder mehrere Veranstaltungen und Fristen verfolgen.',
      entry:
        'Öffnen Sie diesen Leitfaden, um zu verstehen, wie zeitgebundene Arbeit auf der Plattform sichtbar wird.',
      perspective:
        'Der Kalender verwandelt verstreute Verpflichtungen in eine Ansicht, um die Nutzer tatsächlich planen können.',
      outcome:
        'Ein klarer Kalender hilft, früher vorzubereiten, Konflikte schneller zu erkennen und vor Fristen zu handeln.',
      actions: [
        'Kommende Veranstaltungen und zeitgebundene Arbeit an einem Ort überblicken.',
        'Kalendereinträge öffnen, um den tieferen Kontext eines Elements wiederzufinden.',
        'Die Terminansicht nutzen, um Teilnahme und Nachbereitung zu planen.',
      ],
      concepts: [
        'Im Kalender laufen Veranstaltungszeitpunkte, Erinnerungen und persönliche Planung zusammen.',
        'Sichtbarkeit im Kalender kann verändern, wie dringend eine Aufgabe oder Entscheidung wirkt.',
        'Nutzer behandeln den Kalender oft als Vorbereitungsoberfläche und nicht als Endarbeitsraum.',
      ],
      watchFor: [
        'Zeitverschiebungen können in Benachrichtigungen und Teilnahmeerwartungen durchschlagen.',
        'Kalendereinträge sind am nützlichsten, wenn sie Links zum zugrunde liegenden Workflow erhalten.',
        'Nutzer brauchen oft sowohl eine breite Zeitansicht als auch schnellen Zugriff auf Details.',
      ],
      states: [
        'Dasselbe Element kann je nach Zeithorizont fern, bevorstehend oder unmittelbar wirken.',
        'Nutzer lesen den Kalender, um vorbereitet zu sein, nicht nur um Termine zu bestätigen.',
      ],
      diagram: {
        title: 'Wie der Kalender Vorbereitung unterstützt',
        description: 'Ein einfacher Weg von Terminbewusstsein zur Handlung.',
        steps: {
          'scan-schedule': {
            title: 'Zeitplan überblicken',
            description:
              'Prüfen Sie anstehende Veranstaltungen, Fristen und Verpflichtungen auf einen Blick.',
          },
          'open-entry': {
            title: 'Eintrag öffnen',
            description:
              'Springen Sie in das Element, das mehr Aufmerksamkeit oder Vorbereitung braucht.',
          },
          prepare: {
            title: 'Vorbereiten',
            description:
              'Nutzen Sie den verlinkten Kontext, um für den nächsten Schritt bereit zu sein.',
          },
        },
      },
    },
    todos: {
      navLabel: 'Aufgaben',
      title: 'Aufgaben',
      summary:
        'Persönliche und geteilte Nacharbeit, die verhindert, dass Entscheidungen nach dem Beschluss stehenbleiben.',
      audience:
        'Alle, die für Umsetzung, Koordination oder Abschlussverfolgung verantwortlich sind.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Sie verstehen möchten, wie Polity Anschlussfähigkeit organisiert.',
      perspective:
        'Aufgaben sind der Ort, an dem Nutzer spüren, ob die Plattform echte Umsetzung nach Diskussion und Entscheidung unterstützt.',
      outcome:
        'Ein gesunder Aufgabenfluss schließt die Lücke zwischen Koordination, Entscheidung und Umsetzung.',
      actions: [
        'Arbeit erfassen, die aus Treffen, Entscheidungen oder laufenden Projekten entsteht.',
        'Fortschritt über Zeit verfolgen und Verantwortlichkeiten sichtbar halten.',
        'Aufgaben gemeinsam mit Benachrichtigungen und Kalender nutzen, um Schwung nicht zu verlieren.',
      ],
      concepts: [
        'Aufgaben übersetzen Governance und Koordination in sichtbare Umsetzung.',
        'Arbeit fühlt sich handhabbarer an, wenn sie mit dem Ereignis, der Gruppe oder dem Vorschlag verknüpft ist, aus dem sie entstand.',
        'Der Abschlussstatus ist oft das klarste Signal dafür, dass Nachverfolgung tatsächlich geschieht.',
      ],
      watchFor: [
        'Aufgaben werden zu Rauschen, wenn klare Verantwortung oder Timing fehlen.',
        'Nutzer müssen Fortschritt sehen und nicht nur eine lange Liste offener Arbeit.',
        'Aufgaben sind oft nach Entscheidungen am wichtigsten, wenn die anfängliche Energie nachlässt.',
      ],
      states: [
        'Aufgaben bewegen sich meist von Erfassung über Fortschritt bis zum Abschluss mit Sichtbarkeit in jeder Phase.',
        'Nutzer bewerten das System daran, ob es offen zeigt, was noch auf Handlung wartet.',
      ],
      diagram: {
        title: 'Der Nachverfolgungskreislauf',
        description: 'Wie Aufgaben helfen, Entscheidungen in erledigte Arbeit zu verwandeln.',
        steps: {
          'capture-work': {
            title: 'Arbeit erfassen',
            description: 'Machen Sie Verpflichtungen und nächste Schritte verfolgbar.',
          },
          'track-progress': {
            title: 'Fortschritt verfolgen',
            description:
              'Halten Sie die Aufgabe sichtbar, während Verantwortung und Timing klar bleiben.',
          },
          'close-loop': {
            title: 'Kreislauf schließen',
            description:
              'Markieren Sie die Arbeit als erledigt und verringern Sie Unsicherheit darüber, was noch offen ist.',
          },
        },
      },
    },
    'create-workflows': {
      navLabel: 'Erstellen',
      title: 'Erstellungs-Workflows',
      summary:
        'Der zentrale Einstieg zum Anlegen von Gruppen, Events, Amendments, Blogbeiträgen, Statements, Aufgaben, Zahlungen und Tagesordnungspunkten.',
      audience:
        'Nutzer, die neue Arbeit starten, und Organisatoren, die wissen möchten, welcher Create-Flow zu welchem Ziel passt.',
      entry:
        'Beginnen Sie hier, wenn Sie nicht suchen, sondern etwas Neues in Polity erzeugen möchten.',
      perspective:
        'Die Create-Flows übersetzen Absichten in strukturierte Objekte, ohne Nutzer sofort mit allen Detailseiten zu konfrontieren.',
      outcome:
        'Ein gelungener Erstellungsflow legt das richtige Objekt mit Sichtbarkeit, Kontext und Pflichtfeldern an und führt Nutzer in den nächsten passenden Arbeitsraum.',
      actions: [
        'Den passenden Inhaltstyp wählen und dessen Formular Schritt für Schritt ausfüllen.',
        'Kontext wie Gruppe, Event, Sichtbarkeit, Verantwortliche, Zeit oder Tags hinzufügen.',
        'Nach dem Erstellen zur Detailseite, Liste oder weiterführenden Aktion wechseln.',
      ],
      concepts: [
        'Create ist eine gemeinsame Oberfläche für viele Entitäten mit jeweils eigenen Pflichtfeldern.',
        'Typeahead- und Suchfelder helfen, neue Inhalte direkt mit bestehendem Kontext zu verbinden.',
        'Sichtbarkeit, Rechte und Beziehungen werden oft schon beim Erstellen vorbereitet.',
      ],
      watchFor: [
        'Ein falscher Kontext beim Erstellen kann später Berechtigungen und Auffindbarkeit verwirren.',
        'Manche Objekte brauchen minimale Angaben, andere strukturieren komplexe Governance-Flows.',
        'Nutzer sollten nach dem Speichern wissen, wo sie die begonnene Arbeit fortsetzen.',
      ],
      states: [
        'Ein Create-Flow kann leer, teilweise ausgefüllt, validierungsfehlerhaft, speichernd oder abgeschlossen sein.',
        'Erstellung fühlt sich sicher an, wenn Zwischenschritte klar sind und der Zielort nach dem Speichern sichtbar ist.',
      ],
      diagram: {
        title: 'Wie neue Arbeit entsteht',
        description: 'Der allgemeine Weg durch die Create-Oberfläche.',
        steps: {
          'choose-type': {
            title: 'Typ wählen',
            description:
              'Nutzer entscheiden, ob sie Gruppe, Event, Amendment, Statement, Aufgabe oder ein anderes Objekt anlegen.',
          },
          'fill-context': {
            title: 'Kontext ausfüllen',
            description:
              'Formularfelder verbinden die neue Arbeit mit Menschen, Gruppen, Zeitpunkten und Sichtbarkeit.',
          },
          'publish-item': {
            title: 'Objekt erstellen',
            description:
              'Nach dem Speichern öffnet Polity den passenden nächsten Ort für Bearbeitung, Verwaltung oder Verfolgung.',
          },
        },
      },
    },
    'subscriptions-and-payments': {
      navLabel: 'Abos & Zahlungen',
      title: 'Abonnements und Zahlungen',
      summary:
        'Folgen von Nutzern, Gruppen, Events, Blogs und Amendments sowie Unterstützungs- und Stripe-basierte Zahlungsflüsse.',
      audience: 'Nutzer, die Updates verfolgen oder die Plattform finanziell unterstützen möchten.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn Sie verstehen möchten, warum bestimmte Inhalte in Timeline und Benachrichtigungen auftauchen.',
      perspective:
        'Abonnements bestimmen Nähe und Aufmerksamkeit, während Zahlungen Unterstützung und Abrechnung transparent machen.',
      outcome:
        'Gut verwaltete Abonnements und Zahlungen helfen Nutzern, relevante Arbeit zu verfolgen und Unterstützung ohne Verwechslung mit Mitgliedschaft zu leisten.',
      actions: [
        'Nutzern, Gruppen, Events, Blogs oder Amendments folgen und Abonnements wieder entfernen.',
        'Eigene Abonnements filtern, durchsuchen und als persönliche Interessenkarte nutzen.',
        'Unterstützungs- oder Zahlungsflüsse über Checkout, Portal und Statusanzeigen nachvollziehen.',
      ],
      concepts: [
        'Abonnieren ist Aufmerksamkeit, nicht automatisch Mitgliedschaft oder Bearbeitungsrecht.',
        'Subscriptions beeinflussen Timeline, Benachrichtigungen und Wiederauffindbarkeit.',
        'Payments und Support-Beiträge laufen getrennt von Governance-Rechten und sollten so verstanden werden.',
      ],
      watchFor: [
        'Nutzer können eigenen oder privaten Inhalten nicht immer sinnvoll folgen.',
        'Doppelte Abonnements sollten verhindert werden, damit Signale vertrauenswürdig bleiben.',
        'Zahlungsstatus muss klar von inhaltlicher Teilnahme getrennt bleiben.',
      ],
      states: [
        'Ein Inhalt kann nicht abonniert, abonniert, entfolgt, nicht zugänglich oder zahlungsbezogen aktiv sein.',
        'Für Nutzer ist wichtig, ob ein Update wegen Mitgliedschaft, Abonnement oder Zahlung sichtbar wurde.',
      ],
      diagram: {
        title: 'Von Interesse zu fortlaufender Aufmerksamkeit',
        description: 'Wie Abonnements und Support Nutzersignale prägen.',
        steps: {
          'follow-entity': {
            title: 'Entität folgen',
            description:
              'Nutzer abonnieren Inhalte oder Personen, die für ihre Arbeit relevant bleiben sollen.',
          },
          'manage-support': {
            title: 'Unterstützung verwalten',
            description:
              'Zahlungs- und Support-Flüsse zeigen Status, Beitrag und Abrechnungsoptionen.',
          },
          'review-updates': {
            title: 'Updates prüfen',
            description:
              'Timeline, Benachrichtigungen und Profilansichten bringen abonnierte Aktivität wieder nach vorne.',
          },
        },
      },
    },
    'ai-assistant': {
      navLabel: 'AI-Assistenz',
      title: 'AI-Assistenz',
      summary:
        'Aria, Kai und KI-gestützte Hilfen für Orientierung, Zusammenfassung, Schreibunterstützung und Kontextarbeit.',
      audience:
        'Nutzer, die komplexe demokratische Arbeit schneller verstehen oder klarer formulieren möchten.',
      entry:
        'Öffnen Sie diesen Leitfaden, wenn KI in Polity unterstützen soll, ohne den menschlichen Entscheidungsprozess zu ersetzen.',
      perspective:
        'Die AI-Assistenz wirkt am besten als Begleiter für Orientierung und Entwurf, nicht als unsichtbare Autorität.',
      outcome:
        'Gute KI-Nutzung spart Zeit bei Zusammenfassung, Formulierung und Navigation, während Nutzer Vorschläge bewusst prüfen.',
      actions: [
        'Fragen zu Polity, aktuellen Workflows oder Texten stellen.',
        'Zusammenfassungen, Formulierungsvorschläge oder nächste Schritte prüfen.',
        'Eigene Anbieter-Schlüssel oder verfügbare Modelle nutzen, wenn der Kontext es erlaubt.',
      ],
      concepts: [
        'KI-Ausgaben sind Vorschläge und brauchen menschliche Prüfung, besonders bei Governance-Texten.',
        'Aria und Kai erklären Funktionen, während Editor- und Chat-Flows konkrete Arbeit unterstützen können.',
        'Bring-your-own-key und gemeinsame Modelle beeinflussen, welche KI-Funktionen verfügbar sind.',
      ],
      watchFor: [
        'KI darf keine Berechtigungen umgehen oder Entscheidungen für Nutzer treffen.',
        'Vertrauliche Inhalte sollten nur mit passendem Modell- und Schlüsselkontext verwendet werden.',
        'Nutzer sollten erkennen, ob ein Text von Menschen geprüft oder nur vorgeschlagen wurde.',
      ],
      states: [
        'KI kann nicht konfiguriert, verfügbar, wartend, antwortend oder durch fehlende Schlüssel begrenzt sein.',
        'Der wichtigste Zustand ist nicht die Antwort selbst, sondern ob sie geprüft und sinnvoll übernommen wurde.',
      ],
      diagram: {
        title: 'Wie KI kontrolliert unterstützt',
        description: 'Der Weg von Frage zu geprüfter Übernahme.',
        steps: {
          'ask-context': {
            title: 'Kontext fragen',
            description: 'Nutzer geben eine Frage, einen Text oder ein Ziel in den Assistenzfluss.',
          },
          'review-suggestion': {
            title: 'Vorschlag prüfen',
            description:
              'Die Antwort wird auf Ton, Genauigkeit, Rechte und politische Angemessenheit geprüft.',
          },
          'apply-with-care': {
            title: 'Bewusst übernehmen',
            description:
              'Nutzer verwenden die Hilfe als Entwurf, Zusammenfassung oder Orientierung im eigentlichen Workflow.',
          },
        },
      },
    },
    'pql-and-filters': {
      navLabel: 'PQL & Filter',
      title: 'PQL und Filter',
      summary:
        'Wiederverwendbare Filter, Schnellfilter, gespeicherte Abfragen und typisierte Regeln für große Listen und datenreiche Ansichten.',
      audience:
        'Nutzer, die viele Aufgaben, Zahlungen, Dokumente oder andere Entitäten eingrenzen müssen.',
      entry:
        'Nutzen Sie diesen Leitfaden, wenn einfache Suche nicht mehr reicht und wiederholbare Filterlogik gebraucht wird.',
      perspective:
        'PQL macht Filter zu einem gemeinsamen Werkzeug, statt jede Liste mit eigenen Sonderregeln zu behandeln.',
      outcome:
        'Gute Filter helfen Nutzern, große Arbeitsmengen schnell auf den relevanten Ausschnitt zu reduzieren und denselben Blick später wiederzuverwenden.',
      actions: [
        'Schnellfilter nutzen, um häufige Felder ohne komplexe Eingabe einzuschränken.',
        'Benutzerdefinierte Regeln mit UND-, ODER- oder IN-Logik kombinieren.',
        'Gespeicherte Filter erneut öffnen, bearbeiten und auf dieselbe Feature-Fläche anwenden.',
      ],
      concepts: [
        'PQL beschreibt Filterlogik strukturiert, damit UI und Auswertung dieselbe Bedeutung teilen.',
        'Feldtypen bestimmen, welche Werte und Operatoren sinnvoll sind.',
        'Gespeicherte Abfragen sind persönliche oder funktionsbezogene Arbeitsansichten.',
      ],
      watchFor: [
        'Filter dürfen nicht so versteckt sein, dass Nutzer vergessen, warum Ergebnisse fehlen.',
        'Komplexe Regeln brauchen lesbare Zusammenfassungen und einfache Rücksetzung.',
        'PQL sollte bestehende Sichtbarkeitsregeln respektieren und keine Daten freilegen.',
      ],
      states: [
        'Eine Ansicht kann ungefiltert, schnell gefiltert, benutzerdefiniert gefiltert oder mit gespeicherter Abfrage aktiv sein.',
        'Nutzer vertrauen Filtern, wenn Ergebnisanzahl, aktive Regeln und Rücksetzoption klar erkennbar sind.',
      ],
      diagram: {
        title: 'Wie PQL große Listen beherrschbar macht',
        description: 'Vom schnellen Eingrenzen zur wiederverwendbaren Abfrage.',
        steps: {
          'start-filter': {
            title: 'Filter starten',
            description:
              'Nutzer wählen Suchbegriff oder Feldfilter, um die Menge grob einzugrenzen.',
          },
          'combine-rules': {
            title: 'Regeln kombinieren',
            description: 'Mehrere Bedingungen bilden eine klare Logik für genauere Ergebnisse.',
          },
          'reuse-query': {
            title: 'Abfrage wiederverwenden',
            description: 'Gespeicherte Filter stellen denselben Arbeitsblick später wieder her.',
          },
        },
      },
    },
    meetings: {
      navLabel: 'Meetings',
      title: 'Meetings',
      summary:
        'Persönliche Terminfindung und Meeting-Ansichten, die Nutzerprofile mit konkreten Gesprächszeiten verbinden.',
      audience:
        'Nutzer, die Gespräche mit anderen Personen planen oder verfügbare Zeitfenster finden möchten.',
      entry: 'Lesen Sie dies, wenn direkte Koordination nicht über ein formales Event laufen muss.',
      perspective:
        'Meetings sind die leichte Terminbrücke zwischen Profil, Kalender und persönlicher Zusammenarbeit.',
      outcome:
        'Ein klarer Meeting-Flow reduziert Abstimmungsaufwand und macht aus Kontaktinteresse einen konkreten Termin.',
      actions: [
        'Die Meeting-Seite eines Nutzers öffnen und verfügbare Zeitfenster prüfen.',
        'Einen passenden Slot auswählen oder bestehende Meeting-Informationen nachvollziehen.',
        'Den Termin mit Kalender- und Kontaktkontext vorbereiten.',
      ],
      concepts: [
        'Meetings sind personenbezogen und leichtergewichtig als Gruppen- oder Eventworkflows.',
        'Verfügbarkeit, Kalenderkontext und Teilnehmerinformationen bestimmen, ob ein Slot sinnvoll ist.',
        'Ein Meeting kann später in größere Koordination oder Eventplanung übergehen.',
      ],
      watchFor: [
        'Zeitzonen und Datumsauswahl müssen eindeutig bleiben.',
        'Nicht jeder Nutzer muss öffentliche Verfügbarkeit zeigen.',
        'Meeting-Koordination sollte nicht mit formaler Teilnahme an Events verwechselt werden.',
      ],
      states: [
        'Ein Meeting-Kontext kann keine Slots, verfügbare Slots, ausgewählte Zeit oder bestätigte Details zeigen.',
        'Nutzer spüren Qualität daran, ob sie ohne lange Nachrichtenkette zu einem klaren Termin kommen.',
      ],
      diagram: {
        title: 'Vom Profil zum Gespräch',
        description: 'Wie persönliche Terminfindung abläuft.',
        steps: {
          'open-availability': {
            title: 'Verfügbarkeit öffnen',
            description:
              'Nutzer starten auf einer Profil- oder Meeting-Seite mit sichtbaren Terminoptionen.',
          },
          'choose-slot': {
            title: 'Slot wählen',
            description:
              'Ein passender Zeitpunkt wird anhand von Datum, Dauer und Teilnehmerkontext gewählt.',
          },
          'meet-prepared': {
            title: 'Vorbereitet treffen',
            description: 'Kalender- und Profilkontext helfen, das Gespräch sinnvoll fortzuführen.',
          },
        },
      },
    },
    'roles-and-rights': {
      navLabel: 'Rollen & Rechte',
      title: 'Rollen und Rechte',
      summary:
        'Wie bereichsgebundene Rollen und Aktionsrechte bestimmen, was Nutzer sehen, verwalten oder ändern können.',
      audience:
        'Organisatoren, die Berechtigungen vergeben, und Mitglieder, die verstehen wollen, warum eine Aktion vorhanden oder fehlend ist.',
      entry: 'Lesen Sie diesen Leitfaden, wenn Berechtigungen die Nutzererfahrung sichtbar prägen.',
      perspective:
        'Nutzer denken selten in Berechtigungstabellen; sie bemerken Rollen und Rechte dann, wenn Aktionen erscheinen, verschwinden oder eine andere Person erfordern.',
      outcome:
        'Ein klares Rollen- und Rechtemodell hilft Menschen, Verantwortung, Delegation und Grenzen ohne unnötige Verwirrung zu verstehen.',
      actions: [
        'Rollen passend zur Verantwortung in einer Gruppe, Veranstaltung oder einem anderen Bereich zuweisen.',
        'Aktionsrechte nutzen, um gezielte Fähigkeiten freizuschalten, ohne alle zu Admins zu machen.',
        'Fehlende Aktionen als Teil des Berechtigungsdesigns und nicht sofort als Fehler der Oberfläche interpretieren.',
      ],
      concepts: [
        'Rollen bündeln Aktionsrechte in eine Form, die Organisatoren und Mitglieder nachvollziehen können.',
        'Der Geltungsbereich ist wichtig, weil dieselbe Person in verschiedenen Räumen unterschiedliche Rechte haben kann.',
        'Nutzer erleben Rechte als verfügbare Aktionen und nicht als abstrakte Richtlinie.',
      ],
      watchFor: [
        'Eine Rolle in einem Bereich bedeutet nicht automatisch dieselbe Macht an anderer Stelle.',
        'Berechtigungsprobleme werden oft zuerst bei Teilnehmerverwaltung, Bearbeitung oder Governance-Aktionen sichtbar.',
        'Nutzer brauchen Erklärungen, die sichtbare UI-Änderungen mit zugewiesener Verantwortung verbinden.',
      ],
      states: [
        'Berechtigungen sind meist unsichtbar, bis ein Nutzer etwas Bestimmtes tun muss.',
        'Gutes Berechtigungsdesign reduziert Unsicherheit, indem Verantwortung lesbar statt versteckt wird.',
      ],
      diagram: {
        title: 'Wie Rollen für Nutzer sichtbar werden',
        description: 'Eine Spuransicht über Zuweisung, Erfahrung und Durchsetzung im System.',
        lanes: {
          organizer: 'Organisator',
          member: 'Mitglied',
          system: 'System',
        },
        steps: {
          'set-scope': {
            title: 'Bereich festlegen',
            description:
              'Ein Organisator entscheidet, wo die Rolle gilt, zum Beispiel in einer Gruppe oder Veranstaltung.',
          },
          'assign-role': {
            title: 'Rolle zuweisen',
            description:
              'Die Rolle bündelt Aktionsrechte, die definieren, was der Nutzer in diesem Bereich tun kann.',
          },
          'see-available-actions': {
            title: 'Verfügbare Aktionen sehen',
            description:
              'Das Mitglied erlebt Berechtigungen als Buttons, Tabs und Workflows, die vorhanden oder verborgen sind.',
          },
          'enforce-boundaries': {
            title: 'Grenzen durchsetzen',
            description:
              'Das System blockiert Aktionen außerhalb der zugewiesenen Rechte und hält den Ablauf konsistent.',
          },
          'adapt-over-time': {
            title: 'Im Laufe der Zeit anpassen',
            description:
              'Organisatoren aktualisieren Rollen, wenn sich Verantwortung ändert, ohne den gesamten Raum neu aufzubauen.',
          },
        },
      },
    },
    'networks-and-forwarding': {
      navLabel: 'Netzwerke & Weiterleitung',
      title: 'Netzwerke und Weiterleitung',
      summary:
        'Wie verbundene Gruppen den Veranstaltungskontext prägen und wie Amendments durch das Netzwerk weiterlaufen können, statt lokal zu enden.',
      audience:
        'Mitglieder, Organisatoren und Autoren von Vorschlägen, die über verbundene Gruppen hinweg arbeiten.',
      entry:
        'Öffnen Sie diesen Leitfaden, wenn eine Entscheidung oder ein Amendment nicht an einem Ort endet.',
      perspective:
        'Nutzer spüren das Netzwerk, wenn eine Gruppe nach oben oder unten verbunden ist, eine Veranstaltung größere Struktur erbt oder ein Amendment über seinen Ursprung hinaus weitergeführt werden muss.',
      outcome:
        'Ein klares Weiterleitungsmodell hilft Nutzern zu verstehen, wohin Arbeit reist, warum sie sich bewegt und wie lokaler Kontext mit einem größeren System verbunden ist.',
      actions: [
        'Verstehen, wie Gruppen in einem größeren Netzwerk miteinander verbunden sind.',
        'Sehen, wie Veranstaltungskontext aus der Stellung einer Gruppe in dieser Struktur entsteht.',
        'Ein Amendment verfolgen, wenn es durch verbundene Gruppen weiterläuft, statt an seinem Startpunkt zu enden.',
      ],
      concepts: [
        'Netzwerkbeziehungen sind nicht nur visuell, sondern beeinflussen Rechte und Routing.',
        'Veranstaltungen liegen oft in einer größeren Gruppenstruktur, auch wenn Nutzer direkt mit dem Event arbeiten.',
        'Weiterleitung macht aus manchen Amendment-Abläufen einen Pfad über verbundene Räume hinweg.',
      ],
      watchFor: [
        'Nutzer müssen wissen, ob ein Vorschlag noch lokal ist oder bereits weiterläuft.',
        'Unterschiedliche Rechte können bestimmen, welche Verbindungen für einen Workflow relevant sind.',
        'Netzwerksichtbarkeit ist am wertvollsten, wenn sie das nächste Ziel erklärt und nicht nur die Karte zeigt.',
      ],
      states: [
        'Eine verbundene Gruppe kann strukturell nah sein, auch wenn Nutzer sie selten direkt besuchen.',
        'Weiterleitungsstatus ist wichtig, weil er zeigt, ob der Prozess wartet, sich bewegt oder anderswo gelöst wurde.',
      ],
      diagram: {
        title: 'Wie Netzwerkkontext und Weiterleitung zusammenspielen',
        description:
          'Eine Spuransicht über Gruppenstruktur, Veranstaltungsvererbung und Amendment-Routing.',
        lanes: {
          group: 'Gruppe',
          event: 'Veranstaltung',
          amendment: 'Amendment',
        },
        steps: {
          'connect-groups': {
            title: 'Gruppen verbinden',
            description:
              'Beziehungen zwischen Gruppen schaffen die größere Struktur, in der Nutzer arbeiten.',
          },
          'inherit-context': {
            title: 'Kontext erben',
            description:
              'Veranstaltungen erhalten Bedeutung aus dem Gruppennetzwerk statt isoliert zu existieren.',
          },
          'route-amendments': {
            title: 'Amendments weiterleiten',
            description:
              'Ein Vorschlag kann durch das Netzwerk weiterlaufen, wenn lokale Bearbeitung nur eine Stufe des Prozesses ist.',
          },
          'confirm-forwarding': {
            title: 'Weiterleitung bestätigen',
            description:
              'Nutzer brauchen ein sichtbares Signal dafür, dass das Amendment weitergelaufen ist oder noch auf einen vorherigen Schritt wartet.',
          },
          'surface-result': {
            title: 'Ergebnis sichtbar machen',
            description:
              'Das Amendment kehrt schließlich mit einem sichtbaren Ergebnis zurück, das Nutzer im Kontext einordnen können.',
          },
        },
      },
    },
  },
} as const;
