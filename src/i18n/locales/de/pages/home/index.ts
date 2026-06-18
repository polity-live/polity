export const homePageTranslations = {
  welcomeTitle: 'Willkommen bei Polity',
  welcomeSubtitle: 'Eine TanStack Router Demo mit dynamischer Navigation',
  welcomeBack: 'Willkommen zurück, {{email}}!',
  hero: {
    title: 'Demokratie neu gedacht für das digitale Zeitalter',
    subtitle:
      'Gemeinschaften, Organisationen und Regierungen mit Werkzeugen für kollaborative Entscheidungsfindung stärken',
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
      productLine: 'Software für demokratische Zusammenarbeit',
      eyebrow: 'Vom Vorschlag zur Entscheidung',
      title: 'Verstehe Organisation, Entscheidungen und Antragsflüsse an einem Ort.',
      subtitle:
        'Polity gibt zivilgesellschaftlichen Gruppen einen gemeinsamen Arbeitsbereich für Netzwerke, Veranstaltungen, Anträge, Änderungsanträge, Abstimmungen und öffentliche Dokumentation.',
      decisionFlow: ['Vorschlag', 'Änderung', 'Abstimmung'],
      primaryCta: 'Mit Polity starten',
      secondaryCta: 'Produkt ansehen',
    },
    network: {
      title: 'Beispiel-Netzwerkfluss',
      description:
        'Gruppen, Veranstaltungen, Rechte und Entscheidungswege als navigierbarer Graph.',
      badge: 'App-Vorschau',
      panelTitle: 'Antragsweg',
    },
    sections: {
      features: {
        eyebrow: 'Produkt-Flows',
        title: 'So fühlt sich demokratische Arbeit in der App an.',
        description:
          'Die öffentliche Seite zeigt jetzt die konkrete Form des Produkts: Netzwerkgraph, Event-Timeline, Antragstext und Änderungsantrags-Workflow.',
      },
      network: {
        eyebrow: 'Netzwerk- und Workflow-Aufbau',
        title: 'Modelliere Parteien, Parlamente, Ausschüsse und Mandate als lebendige Workflows.',
        description:
          'Polity macht Organisationsstruktur zu einer nutzbaren Karte. Nutzer sehen, wer vorschlagen darf, wer prüft, wo Entscheidungen passieren und wie ein Mandat vom Ortsverband in die Parlamentsarbeit wandert.',
        points: [
          'Ortsverbände, Fachausschüsse, Parteitage, Fraktionen und öffentliche Anhörungen als verbundene Räume abbilden.',
          'Rechte, Verantwortlichkeiten und Übergaben direkt im Graphen zeigen, damit Workflows verständlich bleiben.',
          'Politische Arbeit vom Mitgliedervorschlag über Änderungsprüfung und Abstimmung bis zum parlamentarischen Antrag führen.',
        ],
      },
      amendments: {
        eyebrow: 'Anträge und Änderungsanträge',
        title:
          'Schreibe Politiktexte und prüfe Änderungen, ohne die Entscheidungsspur zu verlieren.',
        description:
          'Antragsseiten verbinden lesbaren Text, Tags, Status und strukturierte Änderungsanträge. Mitglieder sehen genau, welche Wörter sich ändern und wie viel Unterstützung ein Vorschlag hat, bevor er in die Abstimmung geht.',
        points: [
          'Die Antragsseite für Mitglieder lesbar halten und zugleich Versionen und Status bewahren.',
          'Änderungsanträge mit klaren Ergänzungen, Streichungen, Kommentaren und Zustimmungswerten sammeln.',
          'Angenommene Änderungen mit Kontext in Tagesordnungen, Event-Entscheidungen oder finale Abstimmungen übernehmen.',
        ],
      },
      officialData: {
        eyebrow: 'Offizielle Datenquellen',
        title: 'Binde Eurostat, GovData.de und Destatis-Daten direkt in Anträge ein.',
        description:
          'Polity macht externe Daten in politischen Texten nutzbar: Teams können Datensätze suchen, Quellen sichtbar halten und Tabellen oder Diagramme direkt neben dem Antrag prüfen.',
        points: [
          'Eurostat-Datensätze, GovData.de-Ressourcen und Destatis/GENESIS-Veröffentlichungen als Ausgangspunkt für Zahlen, Tabellen und Diagramme verwenden.',
          'Quelle, Veröffentlichungsstand und Importstatus neben dem politischen Kontext sichtbar halten.',
          'Daten als editierbare Tabelle oder Diagramm in Antragstext, Änderungsantrag und Entscheidungsunterlagen übernehmen.',
        ],
      },
      streetDesign: {
        eyebrow: '3D-Straßenentwurf',
        title: 'Straßen in 3D entwerfen, bevor ein Antrag entschieden wird.',
        description:
          'Mit dem Straßenentwurf können Nutzer einen realen Ausschnitt auswählen, Bestand aus Karten laden und neue Straßenräume als verständliches 3D-Modell direkt am Antrag diskutieren.',
        points: [
          'Ein Gebiet auf der Karte markieren und importierte Straßen, Gebäude, Grünflächen und Wasserflächen als Bestand sichtbar machen.',
          'Straßen, Radspuren, Gehwege, Bäume, Sitzbänke und Grünflächen platzieren, um Varianten im Raum greifbar zu machen.',
          'Kosten, Flächen und Vorher-nachher-Vergleiche prüfen, bevor der Entwurf in Änderungsantrag, Tagesordnung oder Abstimmung weiterläuft.',
        ],
      },
      events: {
        eyebrow: 'Events, Timelines und Entscheidungen',
        title: 'Verbinde Treffen, öffentliche Anhörungen, Tagesordnungspunkte und Abstimmungen.',
        description:
          'Events sind keine isolierten Kalendereinträge. Sie tragen Tagesordnungen, Antragsprüfungen, Aktivität von Teilnehmenden und Entscheidungszeitpunkte in eine Timeline, der alle folgen können.',
        points: [
          'Versammlungen, Anhörungen, Ausschüsse und Town Halls mit gemeinsamem Kontext planen.',
          'Abstimmungsreife, Zustimmung und offene Entscheidungspunkte vor dem Event verfolgen.',
          'Teilnehmende mit einer chronologischen Timeline über Änderungen und nächste Schritte orientieren.',
        ],
      },
      social: {
        eyebrow: 'Sozialer Arbeitsraum und KI',
        title: 'Diskussion, Koordination und unterstütztes Schreiben in denselben Flow holen.',
        description:
          'Mitglieder können im Kontext chatten, sich mit Gruppen koordinieren und KI-Unterstützung mit Tools und Skills nutzen, um Debatten zusammenzufassen oder klarere Antragssprache vorzubereiten.',
      },
      timeline: {
        eyebrow: 'Aktivitäts-Timeline',
        title: 'Zeige den Puls demokratischer Arbeit, während sie passiert.',
        description:
          'Eine kompakte Timeline hilft beim schnellen Aufholen: neue Argumente, aktualisierte Änderungsanträge, kommende Abstimmungen und Ergebnisse bleiben im Produkt sichtbar.',
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
        },
        changeRequest: {
          title: 'Änderungsantrag geöffnet',
          description:
            'Eine Arbeitsgruppe schlägt einen messbaren Meilenstein vor der finalen Abstimmung vor.',
          meta: '2 Kommentare',
        },
        vote: {
          title: 'Finale Abstimmung naht',
          description:
            'Mitglieder können die neueste Version prüfen und ihre Abstimmung vorbereiten.',
          meta: '74% Zustimmung',
        },
      },
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
      description: 'Dokumenttext und Änderungsanträge gemeinsam in einer Prüfoberfläche.',
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
      title: 'Datenquellen im Antrag',
      subtitle: 'Suchbare Quellen, nachvollziehbare Herkunft und prüfbare Visualisierung.',
      searchPlaceholder: 'Datensatz suchen',
      query: 'Verkehrsdaten Kommunen',
      resultsTitle: 'Datensätze finden',
      selectedLabel: 'Ausgewählt',
      dataTitle: 'Datenvorschau',
      dataSubtitle: 'CSV-Ressource wird als Tabelle und Diagramm prüfbar.',
      chartTitle: 'Diagramm aus Quelldaten',
      chartSubtitle: 'Vergleich im Dokument prüfen',
      statuses: {
        typing: 'Suche läuft',
        results: 'Treffer gefunden',
        selected: 'Datensatz gewählt',
        data: 'Daten geladen',
      },
      providers: {
        eurostat: 'Eurostat',
        govdata: 'GovData.de',
        destatis: 'Destatis/GENESIS',
      },
      providerHints: {
        eurostat: 'EU-Zeitreihen und regionale Indikatoren',
        govdata: 'Deutsches Open-Data-Portal mit CKAN-Discovery',
        destatis: 'Fachliche Tabellen über GENESIS-Online',
      },
      resultTitles: [
        'Eurostat: modal split in Städten',
        'Kommunale Verkehrszählungen 2025',
        'Destatis/GENESIS: Pendler nach Gemeinde',
      ],
      resultSources: [
        'Eurostat · urb_cmob · letzter Snapshot',
        'GovData.de · Stadtverkehr · CSV-Ressource',
        'Destatis/GENESIS · Tabelle 13111-02 · JSON/CSV',
      ],
      resultMeta: [
        'Vergleichbarer EU-Indikator für Mobilität und städtische Räume.',
        'Offene Verwaltungsdaten mit Messstellen, Zeitraum und Lizenzhinweis.',
        'Amtliche Statistik mit Gemeindebezug und GENESIS-Metadaten.',
      ],
      resultProviders: ['Eurostat', 'GovData.de', 'Destatis/GENESIS'],
      tableColumns: ['Gebiet', 'Wert', 'Quelle'],
      tableRows: [
        'Innenstadt|82|GovData CSV',
        'Nordring|64|GovData CSV',
        'Pendlerquote|56|Destatis',
      ],
      chartLabels: ['2019', '2021', '2023', '2025', '2026'],
      metrics: ['Quelle am Diagramm', 'Tabelle editierbar', 'Für Abstimmung bereit'],
    },
    streetDesignPreview: {
      title: 'Straßenraum-Entwurf',
      subtitle: '3D-Vorschau für einen Änderungsantrag',
      badge: 'Streetscape',
      canvasLabel: '3D-Modell: verkehrsberuhigte Straße mit Radspur, Bäumen und Grünfläche',
      toolsTitle: 'Elemente',
      layersTitle: 'Bestand',
      costTitle: 'Kosten',
      comparisonTitle: 'Vergleich',
      totalCost: '148.200 €',
      estimate: 'Schätzung',
      tools: ['Straße', 'Radspur', 'Gehweg', 'Bäume', 'Grünfläche'],
      layers: ['Straßen', 'Gebäude', 'Grün'],
      comparisonModes: ['Original', 'Neu', 'Overlay'],
      metrics: ['420 m² Grün', '180 m Radspur', '24 Bäume'],
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
