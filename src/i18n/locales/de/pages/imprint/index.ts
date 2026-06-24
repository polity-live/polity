export const imprintPageTranslations = {
  title: 'Impressum',
  subtitle:
    'Rechtliche Hinweise und Kontaktinformationen für die aktuelle öffentliche Vorschau von Polity.',
  lastUpdated: 'Zuletzt aktualisiert: 24. Juni 2026',
  sections: {
    overview: {
      title: 'Überblick',
      paragraphs: [
        'Polity ist ein Open-Source-Social-Network für kollaborative demokratische Prozesse. Diese Seite fasst Kontakt- und Verantwortlichkeitsinformationen für die aktuelle Vorschau zusammen.',
      ],
    },
    operator: {
      title: 'Projektstatus',
      paragraphs: [
        'Die hier dargestellte Version ist eine Alpha-Version des Polity-Projekts und in laufender Entwicklung. Ziel des Alpha-Betriebs ist das Testen von User Experience und technischer Funktionalität unter realen Bedingungen. Datenverluste und Sicherheitslücken sind nicht ausgeschlossen.',
        'Wenn eine andere Organisation Polity auf eigener Infrastruktur betreibt, ist diese Organisation selbst dafür verantwortlich, die für den Betrieb der App gesetzlich erforderlichen Anbieterangaben zu veröffentlichen.',
      ],
    },
    responsibility: {
      title: 'Verantwortung für Inhalte',
      paragraphs: [
        'Wir erstellen und prüfen die Inhalte dieser Vorschau mit Sorgfalt. Externe Links werden beim Einbinden geprüft, die Verantwortung für Inhalte fremder Seiten liegt jedoch bei den jeweiligen Betreiber:innen dieser Angebote. Inhalte, die von Nutzern der Plattform erstellt werden, liegen im Verantwortungsbereich dieser Nutzer.',
      ],
    },
  },
  contact: {
    title: 'Kontakt und Quellcode',
    description: 'Nutze die folgenden Kanäle für Projekt-, Rechts- oder Datenschutzfragen.',
    email: {
      title: 'E-Mail',
      description: 'Verwende diese Adresse für allgemeine Fragen zum Polity-Projekt.',
    },
    repository: {
      title: 'Quellcode & Bug-Tracker',
      description:
        'Das öffentliche Repository dokumentiert die laufende Entwicklung und das Issue-Tracking.',
    },
    support: {
      title: 'Support-Seite',
      description:
        'Hier findest du weitere Möglichkeiten, das Projekt zu kontaktieren oder zu unterstützen.',
    },
  },
} as const;
