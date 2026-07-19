export const homePageTranslations = {
  welcomeTitle: 'Willkommen bei Polity',
  welcomeSubtitle: 'Eine TanStack Router Demo mit dynamischer Navigation',
  welcomeBack: 'Willkommen zurück, {{email}}!',
  hero: {
    title: 'Demokratie neu gedacht für das digitale Zeitalter',
    subtitle:
      'Parteien, NGOs, Exekutiven und Legislativen mit Werkzeugen für kollaborative Entscheidungsfindung stärken',
    getStarted: 'Jetzt starten',
    exploreFeatures: 'Funktionen erkunden',
  },
  publicLanding: {
    nav: {
      home: 'Start',
      features: 'Funktionen',
      solutions: 'Lösungen',
      imprint: 'Impressum',
    },
    hero: {
      productLine: 'Plattform für demokratische Zusammenarbeit',
      eyebrow: 'Vom Vorschlag zur Entscheidung',
      title: 'Verstehe Organisation, Entscheidungen und Antragsflüsse an einem Ort.',
      subtitle:
        'Polity ist das globale Echtzeit-Social-Network für politische Gruppen, Zivilgesellschaft und politisch Interessierte – mit Veranstaltungen, Anträgen, Wahlen, Daten und KI-Unterstützung.',
      decisionFlow: ['Vorschlag', 'Änderung', 'Abstimmung'],
      primaryCta: 'Mit Polity starten',
      secondaryCta: 'Produkt ansehen',
    },
    network: {
      title: 'Beispiel-Netzwerkfluss',
      description:
        'Gruppen, Veranstaltungen, Rechte und Entscheidungswege als navigierbarer Graph.',
      panelTitle: 'Antragsweg',
      nodes: {
        stateParty: 'Landesverband',
        localBranch: 'Ortsverband Nord',
        policyCommittee: 'Programmausschuss',
        partyCongress: 'Parteitag',
        parliamentaryGroup: 'Fraktion',
        publicCommitteeHearing: 'Öffentliche Ausschussanhörung',
        parliamentaryGroupMeeting: 'Fraktionssitzung',
        hearingLocation: 'Parlament, Raum 2.114',
        meetingLocation: 'Fraktionsbüro',
        hearingDescription:
          'Eine Anhörung, in der die Fraktion das Mandat vorstellt und öffentliches Feedback erhält.',
        meetingDescription:
          'Die Fraktion bereitet das Antragspaket nach der Zustimmung des Parteitags vor.',
      },
    },
    sections: {
      features: {
        eyebrow: 'Produkt-Flows',
        title: 'So fühlt sich demokratische Arbeit in der App an.',
        description:
          'Ein kurzer Einstieg in die zentralen Arbeitsräume: Gruppen, Veranstaltungen, Anträge, Tagesordnungen, Suche und Nachrichten.',
      },
      network: {
        eyebrow: 'Netzwerk- und Workflow-Aufbau',
        title: 'Modelliere Parteien, Parlamente, Ausschüsse und Mandate als lebendige Workflows.',
        description:
          'Polity macht komplexe Organisationsstrukturen sichtbar und handhabbar. Nutzer sehen, wer vorschlagen darf, wer prüft, wo Entscheidungen passieren und wie ein Mandat vom Ortsverband in die Parlamentsarbeit wandert.',
        points: [
          'Ortsverbände, Fachausschüsse, Parteitage, Fraktionen und öffentliche Anhörungen als verbundene Räume abbilden.',
          'Rechte, Verantwortlichkeiten und Übergaben direkt im Graphen zeigen, damit Workflows verständlich bleiben.',
          'Politische Arbeit vom Mitgliedervorschlag über Änderungsprüfung und Abstimmung bis zum parlamentarischen Antrag führen.',
        ],
      },
      amendments: {
        eyebrow: 'Anträge und Änderungsanträge',
        title: 'Schreibe Anträge und prüfe Änderungen, ohne die Entscheidungsspur zu verlieren.',
        description:
          'Anträge verbinden Text, Tags, innovative Elemente wie Grafiken und Mediadateien. Mitglieder sehen genau, welche Abschnitte sich ändern und wie viel Unterstützung ein Vorschlag hat, bevor er in die Abstimmung geht.',
        points: [
          'Anträge bleiben für Mitglieder übersichtlich. Nächste Schritte und Versionsverwaltung zeigen, was kommt und was war.',
          'Änderungsanträge mit klaren Ergänzungen, Streichungen, Kommentaren und Zustimmungswerten sammeln.',
          'Angenommene Änderungen mit Kontext in Tagesordnungen, Event-Entscheidungen oder finale Abstimmungen übernehmen.',
        ],
      },
      officialData: {
        eyebrow: 'Offizielle Datenquellen',
        title: 'Finde belastbare Daten und forme sie direkt zur Entscheidungsgrundlage.',
        description:
          'Der Daten-Workspace verbindet die Suche in offiziellen Quellen und eigenen CSV-Dateien mit einem Builder für Diagramme, Tabellen und Kennzahlen.',
        points: [
          'Eurostat, GENESIS/Destatis, GovData und eigene CSV-Daten in einer gemeinsamen Suche verwenden.',
          'Messwert, Dimension, Filter und Aggregation auswählen und die Auswirkung sofort in der Vorschau sehen.',
          'Diagramme, Tabellen oder Kennzahlen mit Herausgeber, Lizenz und Datenstand in Anträge übernehmen.',
        ],
      },
      streetDesign: {
        eyebrow: '3D-Straßenentwurf',
        title: 'Echte Straßenräume als nachvollziehbaren Entwurf bearbeiten.',
        description:
          'Street Design lädt den kartierten Bestand eines gewählten Gebiets und verbindet räumliche Bearbeitung, Kosten und Änderungsanträge in einem Workspace.',
        points: [
          'Kartenausschnitt wählen und Straßen, Gebäude, Grünflächen sowie Markierungen aus dem OSM-Kontext laden.',
          'Radwege, Gehwege, Bäume, Bänke und Grünstreifen platzieren, auswählen, ausblenden oder entfernen.',
          'Bestand und Entwurf vergleichen, Kosten prüfen und räumliche Änderungen als Change Request diskutieren.',
        ],
      },
      events: {
        eyebrow: 'Events, Timelines und Entscheidungen',
        title: 'Verbinde Treffen, öffentliche Anhörungen, Tagesordnungspunkte und Abstimmungen.',
        description:
          'Events sind keine isolierten Kalendereinträge. Sie tragen Tagesordnungen, Antragsprüfungen, Aktivität von Teilnehmenden und Entscheidungszeitpunkte in eine Timeline, der alle folgen können.',
        points: [
          'Versammlungen, Anhörungen, Ausschüsse und Town Halls in organisationsweitem Kontext planen.',
          'Eingebunden in Workflows ermöglichen Events die Automatisierung komplexer Entscheidungsprozesse.',
          'Teilnehmende mit einer chronologischen Timeline über Änderungen und nächste Schritte orientieren.',
        ],
      },
      votesElections: {
        eyebrow: 'Abstimmungen und Wahlen',
        title:
          'Führe Abstimmungen, Kandidaturen und Ergebnisse in einem gemeinsamen Entscheidungsraum.',
        description:
          'Polity bündelt laufende Abstimmungen und Wahlen mit Fristen, Stimmstatus, Wahlmodi und Ergebnisübersicht, damit Mitglieder wissen, wann sie handeln müssen und was beschlossen wurde.',
        points: [
          'Entscheidungen in Abstimmungen & Wahlen in Echtzeit sichtbar machen - egal wo, global auf der ganzen Welt.',
          'Fristen, Quoren und Stimmoptionen, Kandidaturen, Rollen und Wahlgänge im Gruppen- oder Event-Kontext organisieren.',
          'Ergebnisse mit Beteiligung, Mehrheiten und Nachvollziehbarkeit direkt nach der Entscheidung bereitstellen.',
        ],
      },
      social: {
        eyebrow: 'Sozialer Arbeitsraum und KI',
        title: 'Diskussion, Koordination und AI-gestütztes Schreiben in denselben Flow holen.',
        description:
          'Mitglieder können sich mit Gruppen koordinieren, im Event-Kontext chatten und KI-Unterstützung mit Tools und Skills nutzen, um Debatten zu verstehen oder Anträge weiterzuentwickeln.',
      },
      timeline: {
        eyebrow: 'Aktivitäts-Timeline',
        title: 'Zeige den Puls demokratischer Arbeit, während und wo sie passiert.',
        description:
          'Eine kompakte & geo-lokalisierte Timeline hilft beim schnellen Finden: Was passiert wo in deiner Nähe? Neue Argumente, aktualisierte Änderungsanträge, kommende Abstimmungen und Ergebnisse haben Zeit- & Ortskontext.',
      },
      search: {
        eyebrow: 'Suche und Entdeckung',
        title: 'Finde schnell die richtige Person, das Dokument, Event oder den Entscheidungsweg.',
        description:
          'Semantische Suche hilft Nutzern durch dichte demokratische Arbeit, auch wenn sie den exakten Ordner oder Titel nicht kennen. Ergebnisse können Menschen, Gruppen, Events, Anträge und vergangene Entscheidungen verbinden.',
      },
      solutions: {
        eyebrow: 'Anwendungsfälle',
        title: 'Gebaut für Menschen und Organisationen, die transparente Entscheidungen brauchen.',
      },
    },
    timeline: {
      title: 'Beispiel-Event-Timeline',
      description: 'Verfolge, was sich geändert hat, wer aktiv war und was als Nächstes zählt.',
      badge: 'Abonniert',
      items: {
        event: {
          title: 'Öffentliche Anhörung geplant',
          description:
            'Die Generalversammlung hat einen öffentlichen Beratungstermin für den Klima-Budget-Antrag ergänzt.',
          meta: 'Heute, 10:30',
          source: 'Haushaltsausschuss',
          location: 'Berlin, Parlament',
          status: 'geplant',
          stats: '128 Teilnehmende',
          tags: 'Anhörung|Haushalt|Klima',
        },
        changeRequest: {
          title: 'Änderungsantrag geöffnet',
          description:
            'Eine Arbeitsgruppe schlägt einen messbaren Meilenstein vor der finalen Abstimmung vor.',
          meta: '2 Kommentare',
          source: 'Programmausschuss',
          location: 'Potsdam',
          status: 'letzte Abschlussabstimmung des Events',
          stats: '2 Kommentare',
          tags: 'Änderungsantrag|Workflow',
        },
        vote: {
          title: 'Finale Abstimmung naht',
          description:
            'Mitglieder können die neueste Version prüfen und ihre Abstimmung vorbereiten.',
          meta: '74% Zustimmung',
          source: 'Parteitag',
          location: 'Leipzig',
          status: 'bald eröffnet',
          stats: '74% Zustimmung',
          tags: 'Abstimmung|Tagesordnung',
        },
      },
    },
    voteElectionPreview: {
      title: 'Entscheidungsübersicht',
      subtitle: 'Laufende Abstimmungen und Wahlen mit Status.',
      badge: 'Live',
      voteTitle: 'Klima-Budget final beschließen',
      voteMeta: 'Schließt heute um 18:00',
      voteChoices: ['Ja|138|62', 'Nein|54|24', 'Enthaltung|31|14'],
      electionTitle: 'Sprecherwahl Ausschuss',
      electionMeta: '3 Kandidaturen bestätigt',
      electionCandidates: [
        'Maya Schneider|Sprecherin|84|44',
        'Jonas Weber|Stellvertretung|61|32',
        'Aylin Kaya|Beisitz|45|24',
      ],
      statusTitle: 'Entscheidungsstatus',
      metrics: ['223 Stimmen erfasst', '71% Beteiligung', 'Quorum erreicht'],
      checklist: [
        'Stimmfenster offen',
        'Namentliche Ergebnisse vorbereitet',
        'Wahlprotokoll wird automatisch erstellt',
      ],
    },
    amendmentText: {
      title: 'Beispiel-Antragstext',
      subtitle: 'Eine strukturierte Politikseite mit Status, Tags und lesbarem Dokumenttext.',
      status: 'Interne Prüfung',
      documentTitle: 'Antrag für Klima-Budget-Transparenz',
      paragraphs: [
        'Abschnitt 1: Der jährliche Haushalt enthält für jede Investition über dem vereinbarten Schwellenwert eine öffentliche Klimawirkungsnotiz.',
        'Abschnitt 2: Verantwortliche Arbeitsgruppen veröffentlichen Umsetzungsmeilensteine vor der finalen Abstimmung der Versammlung.',
      ],
    },
    amendmentWorkspace: {
      title: 'Beispiel-Antragsseite',
      description: 'Antragstext und Änderungsanträge gemeinsam prüfen.',
      badge: 'Review-Fläche',
    },
    changeRequest: {
      title: 'Beispiel-Änderungsantrag',
      subtitle: 'Prüfe vorgeschlagene Textänderungen, bevor der Antrag weiterläuft.',
      badge: 'Abstimmung offen',
      meta: '12 Unterstützer',
      requestTitle: 'Messbare Berichtsmeilensteine ergänzen',
      removed: 'Jährliche Statuszusammenfassung veröffentlichen.',
      added:
        'Quartalsweise Meilensteine mit Verantwortlichkeit, Frist und aktuellem Umsetzungsstand veröffentlichen.',
      support: 'Zustimmung',
    },
    officialDataPreview: {
      title: 'Datenansicht einfügen',
      findSubtitle: 'Datensatz finden und Herkunft prüfen.',
      buildSubtitle: 'Darstellung konfigurieren und live prüfen.',
      stages: { find: 'Datensatz finden', build: 'Ansicht erstellen' },
      searchLabel: 'Datensätze durchsuchen',
      searchPlaceholder: 'Bevölkerung, Mobilität oder Haushalt suchen …',
      sources: 'Datenquellen',
      providers: {
        eurostat: 'Eurostat',
        destatis: 'GENESIS/Destatis',
        govdata: 'GovData',
        upload: 'Eigene Daten',
      },
      useSampleCsv: 'Beispiel-CSV verwenden',
      localBadge: 'Lokales Beispiel',
      noResults: 'Keine passenden Beispieldatensätze gefunden.',
      chooseResult: 'Datensatz auswählen, um Quelle und Struktur zu prüfen.',
      coverage: 'Abdeckung',
      structure: 'Struktur',
      license: 'Lizenz',
      useDataset: 'Datensatz verwenden',
      changeDataset: 'Datensatz wechseln',
      views: { chart: 'Diagramm', table: 'Tabelle', stat: 'Kennzahl' },
      measure: 'Messwert',
      dimension: 'Dimension',
      aggregation: 'Aggregation',
      chartType: 'Diagrammtyp',
      chartTypes: { bar: 'Balken', line: 'Linie' },
      aggregations: { mean: 'Mittelwert', sum: 'Summe', max: 'Maximum' },
      options: {
        traffic: 'Verkehrsaufkommen',
        share: 'Anteil nachhaltiger Mobilität',
        year: 'Jahr',
        area: 'Gebiet',
      },
      preview: 'Vorschau',
      livePreview: 'Live-Vorschau',
      sourceColumn: 'Quelle',
      sourceAttribution: 'Quelle: {{provider}} · {{publisher}} · Datenstand {{date}}',
      resultTitles: [
        'Modal Split in europäischen Städten',
        'Pendlerbewegungen nach Gemeinde',
        'Kommunale Verkehrszählungen 2025',
        'Mobilitätszählung des Projektteams',
      ],
      resultPublishers: [
        'Eurostat',
        'Statistisches Bundesamt',
        'Senatsverwaltung für Mobilität',
        'Projektteam Innenstadt',
      ],
      resultCoverage: [
        'EU · 2019–2025',
        'Deutschland · 2024',
        'Berlin · 2025',
        'Innenstadt · 2026',
      ],
      resultStructure: [
        '5 Spalten · 240 Zeilen',
        '6 Spalten · 412 Zeilen',
        '5 Spalten · 96 Zeilen',
        '4 Spalten · 24 Zeilen',
      ],
      resultLicenses: [
        'Eurostat reuse policy',
        'Datenlizenz Deutschland 2.0',
        'CC BY 4.0',
        'Gruppenintern',
      ],
      resultSnapshots: ['30.06.2026', '18.06.2026', '02.07.2026', '10.07.2026'],
      resultDescriptions: [
        'Vergleichbare Zeitreihen zu Pkw-, Rad-, Fuß- und ÖPNV-Anteilen.',
        'Amtliche Pendlerstatistik mit Gemeinde, Richtung und Verkehrsmittel.',
        'Offene Zählstellendaten mit Zeitraum, Richtung und Fahrzeugklasse.',
        'Lokale CSV-Beispieldatei mit den jüngsten Zählungen des Teams.',
      ],
      tableColumns: ['Jahr', 'Gebiet', 'Wert'],
      tableRows: [
        '2019|Innenstadt|48',
        '2021|Innenstadt|57',
        '2023|Innenstadt|63',
        '2025|Innenstadt|74',
        '2026|Innenstadt|82',
      ],
      chartLabels: ['2019', '2021', '2023', '2025', '2026'],
      areaLabels: ['Innenstadt', 'Nord', 'Süd', 'Ost', 'West'],
    },
    streetDesignPreview: {
      title: 'Straßenraum-Editor',
      subtitle: 'Bestand, Entwurf, Kosten und Change Requests in einem Workspace.',
      area: 'Euckenstraße 38, München',
      localDemo: 'Lokale Demo',
      osmLive: 'Live aus OpenStreetMap',
      osmFallback: 'Lokaler OSM-Ersatz',
      loadingOsm: 'OSM wird geladen …',
      osmUnavailable: 'OSM nicht verfügbar',
      osmError: 'Der OpenStreetMap-Ausschnitt konnte nicht geladen werden.',
      toolbarLabel: 'Werkzeuge für den Straßenentwurf',
      loadArea: 'Gebiet laden',
      tools: {
        bikeLane: 'Radweg',
        sidewalk: 'Gehweg',
        tree: 'Baum',
        bench: 'Bank',
        greenStrip: 'Grünstreifen',
      },
      layersTitle: 'Ebenen',
      layers: { roads: 'Straßen', buildings: 'Gebäude', greenery: 'Grünflächen' },
      streetMarkings: 'Straßenmarkierungen',
      changeRequest: 'Change Request',
      changeRequestTitle: 'Zusätzliche Baumreihe am südlichen Gehweg',
      saveBeforeModeChange: 'Speichere die lokalen Änderungen vor dem Moduswechsel.',
      localSuggestion: 'Lokaler Änderungsvorschlag',
      localSaveError: 'Die lokale Änderung konnte nicht gespeichert werden.',
      demoUser: 'Demo-Nutzer:in',
      comparisonModes: { original: 'Bestand', design: 'Entwurf', overlay: 'Overlay' },
      metrics: {
        existing: '{{count}} OSM-Objekte',
        elements: '{{count}} Entwurfselemente',
        cost: '{{cost}} €',
        changeRequests: '{{count}} Change Request',
      },
      inspectorTitle: 'Ausgewähltes Objekt',
      selectObject: 'Ein Element im Entwurf auswählen, um es zu bearbeiten.',
      show: 'Einblenden',
      hide: 'Ausblenden',
      remove: 'Entfernen',
      costTitle: 'Kostenschätzung',
      estimate: 'unverbindliche Schätzung',
      canvasLabel:
        'Interaktiver Straßenentwurf mit kartiertem Bestand, Radweg, Bäumen und Change-Request-Overlay',
    },
    social: {
      chatTitle: 'Koalitions-Chat',
      chatSubtitle: 'Nachrichten bleiben neben Antrag und Event-Kontext.',
      messages: {
        first: {
          author: 'Maya, Policy Lead',
          body: 'Können wir die Berichtsfrist an die Ausschussanhörung statt an den Parteitag koppeln?',
        },
        second: {
          author: 'Jonas, Fraktion',
          body: 'Ja. Die Anhörung hat stärkere öffentliche Dokumentation und gibt der Gruppe Zeit zur Vorbereitung.',
        },
        third: {
          author: 'Ortsverband Nord',
          body: 'Wir haben zwei Kommentare von Mitgliedern ergänzt, die die Klimanotiz an jede Haushaltsabstimmung hängen wollen.',
        },
      },
      aiTitle: 'KI-Entwurfsassistenz',
      aiSubtitle: 'Zusammenfassungen und Formulierungshilfe für volle demokratische Workflows.',
      aiPrompt:
        'Fasse die offenen Argumente zusammen und schlage neutrale Formulierungen für die Berichtsfrist vor.',
      aiResponseTitle: 'Vorgeschlagene neutrale Formulierung',
      aiResponse:
        'Quartalsweise Meilensteine nach jeder Ausschussanhörung veröffentlichen, inklusive Verantwortlichkeit, Frist und aktuellem Umsetzungsstand.',
    },
    activity: {
      items: [
        'Drei neue Kommentare wurden zur Diskussion des Klima-Budget-Antrags ergänzt.',
        'Ein Änderungsantrag ist vom Entwurf in die offene Unterstützung mit zwei ungelösten Kommentaren gewechselt.',
        'Die finale Abstimmung wurde nach der Ausschussanhörung geplant und mit der Tagesordnung verknüpft.',
      ],
    },
    searchPreview: {
      query: 'Suche: Klimabericht nach Ausschussanhörung',
      filters: ['Anträge', 'Events', 'Gruppen', 'Nachrichten'],
      results: [
        'Antrag für Klima-Budget-Transparenz',
        'Ausschussanhörung: Haushaltsprüfung',
        'Mandatsnotizen der Fraktion',
      ],
      resultMeta: 'Treffer nach Titel, Text, Kommentaren und verbundenem Workflow.',
    },
  },
  alphaWarning: {
    title: 'Frühe Alpha-Version',
    description:
      'Dies ist eine frühe Alpha-Version. Datenbanküberschreibungen können passieren und Ihre Daten löschen. Falls Sie ein früher Tester sein möchten, kontaktieren Sie',
    dismiss: 'Ich verstehe',
  },
  quickLinks: {
    solutions: {
      title: 'Lösungen',
      description: 'Für Parteien, Regierungen, NGOs & mehr',
    },
    pricing: {
      title: 'Preise',
      description: 'Transparente Preise von kostenlos bis Enterprise',
    },
    features: {
      title: 'Funktionen',
      description: 'Vollständige Funktionsübersicht',
    },
  },
  cards: {
    navigation: {
      title: 'Navigation Demo',
      description: 'Erleben Sie unsere dynamische Navigation mit verschiedenen Layouts',
      content:
        'Testen Sie verschiedene Navigationstypen, Prioritäten und Bildschirmkonfigurationen.',
      button: 'Navigation Demo anzeigen',
    },
    features: {
      title: 'Features',
      description: 'Hauptfunktionen dieser Anwendung',
      items: [
        'Dynamische, konfigurierbare Navigation',
        'Reaktive Layouts für mobile und Desktop-Geräte',
        'Tastaturnavigation mit Shortcuts',
        'Kommandopalette (Drücken Sie ⌘K)',
        'Themenwechsel (hell/dunkel)',
      ],
    },
    techStack: {
      title: 'Tech-Stack',
      description: 'Verwendete Technologien',
      frontend: 'Frontend:',
      styling: 'Styling:',
      tooling: 'Tooling:',
      button: 'Demo starten',
    },
    test: 'fdf',
  },
} as const;
