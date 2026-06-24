export const privacyPageTranslations = {
  title: 'Datenschutzerklärung',
  subtitle:
    'Diese Erklärung beschreibt, welche personenbezogenen Daten wir für die öffentliche Vorschau von Polity verarbeiten, wie wir sie nutzen und welche Wahlmöglichkeiten du hast.',
  lastUpdated: 'Zuletzt aktualisiert: 24. Juni 2026',
  sections: {
    overview: {
      title: 'Überblick',
      paragraphs: [
        'Polity verarbeitet personenbezogene Daten nur in dem Umfang, in dem du sie uns durch aktive Handlungen zur Verfügung stellst. Darunter fallen z.B. das Anlegen eines Benutzerkontos, das Erstellen von Gruppen oder Anträgen.',
        'Es findet kein verstecktes Tracking von Nutzerdaten oder Nutzerverhalten statt.',
      ],
    },
    dataCollection: {
      title: 'Welche Daten wir verarbeiten',
      paragraphs: [
        'Wir können Identitäts- und Kontaktdaten wie deine E-Mail-Adresse, von dir angegebene Profildaten, technische Daten deines Geräts oder Browsers sowie Inhalte verarbeiten, die du aktiv auf der Plattform erstellst.',
      ],
      items: [
        'Authentifizierungs- und Kontodaten, die für Anmeldung und Sicherheit deines Kontos erforderlich sind.',
        'Inhaltsdaten wie Beiträge, Dokumente, Kommentare, Abstimmungen und anderes Material, das du bewusst übermittelst.',
      ],
    },
    usage: {
      title: 'Wie wir Daten nutzen',
      paragraphs: [
        'Wir nutzen personenbezogene Daten, um Nutzer:innen zu authentifizieren, zentrale Plattformfunktionen bereitzustellen, Missbrauch zu verhindern, Supportanfragen zu beantworten und die Produktqualität zu verbessern.',
      ],
    },
    sharing: {
      title: 'Weitergabe von Daten',
      paragraphs: [
        'Wir verkaufen keine personenbezogenen Daten. Eine Weitergabe erfolgt nur an Infrastruktur- und Dienstleistungspartner, soweit dies für das Hosting, Sicherheit oder Wartung des Dienstes erforderlich ist.',
        'Informationen können außerdem offengelegt werden, wenn dies nach geltendem Recht erforderlich ist oder wenn es zum Schutz von Nutzer:innen, der Plattform oder der auf ihr abgebildeten demokratischen Prozesse notwendig ist.',
      ],
    },
    security: {
      title: 'Datensicherheit',
      paragraphs: [
        'Wir setzen für den Vorschau-Betrieb angemessene technische und organisatorische Maßnahmen ein, um Daten vor unbefugtem Zugriff, Verlust oder Missbrauch zu schützen. Da dies eine Alpha-Version im Teststatus ist, sind Datenverluste oder Sicherheitslücken nicht auszuschließen.',
      ],
    },
  },
  related: {
    title: 'Verwandte Seiten',
    description: 'Prüfe auch die weiteren öffentlichen Rechtstexte dieser Vorschau.',
    terms: {
      title: 'Nutzungsbedingungen',
      description: 'Lies die Regeln für die Nutzung von Polity.',
    },
    imprint: {
      title: 'Impressum',
      description: 'Sieh dir rechtliche Hinweise und Projektkontakt an.',
    },
    support: {
      title: 'Support',
      description: 'Nutze die öffentlichen Support-Kanäle des Projekts.',
    },
  },
} as const;
