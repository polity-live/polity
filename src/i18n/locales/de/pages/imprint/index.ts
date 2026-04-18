export const imprintPageTranslations = {
  title: 'Impressum',
  subtitle: 'Rechtliche Hinweise und Kontaktinformationen fuer die aktuelle oeffentliche Vorschau von Polity.',
  lastUpdated: 'Zuletzt aktualisiert: 18. April 2026',
  sections: {
    overview: {
      title: 'Ueberblick',
      paragraphs: [
        'Polity ist eine Open-Source-Plattform fuer kollaborative demokratische Prozesse. Diese Seite fasst Kontakt- und Verantwortlichkeitsinformationen fuer die aktuelle Vorschau zusammen.',
      ],
    },
    operator: {
      title: 'Projektstatus',
      paragraphs: [
        'Die hier dargestellte Version ist eine Vorschauumgebung fuer das Polity-Projekt und dessen laufende Entwicklung.',
        'Wenn eine andere Organisation Polity auf eigener Infrastruktur betreibt, ist diese Organisation selbst dafuer verantwortlich, die fuer ihre Bereitstellung gesetzlich erforderlichen Anbieterangaben zu veroeffentlichen.',
      ],
    },
    responsibility: {
      title: 'Verantwortung fuer Inhalte',
      paragraphs: [
        'Wir erstellen und pruefen die Inhalte dieser Vorschau mit Sorgfalt. Externe Links werden beim Einbinden geprueft, die Verantwortung fuer Inhalte fremder Seiten liegt jedoch bei den jeweiligen Betreiber:innen dieser Angebote.',
      ],
    },
    legalNotice: {
      title: 'Rechtlicher Hinweis',
      paragraphs: [
        'Diese Impressumsseite soll die Kontaktkanaele des Projekts waehrend der Vorschauphase transparent machen.',
        'Vor einem Produktivbetrieb sollte diese Seite um die vollstaendigen gesetzlich erforderlichen Anbieterangaben des jeweiligen Betreibers ergaenzt werden.',
      ],
    },
  },
  contact: {
    title: 'Kontakt und Quellcode',
    description: 'Nutze die folgenden Kanaele fuer Projekt-, Rechts- oder Datenschutzfragen.',
    email: {
      title: 'E-Mail',
      description: 'Verwende diese Adresse fuer allgemeine Fragen zum Polity-Projekt.',
    },
    repository: {
      title: 'Quellcode',
      description: 'Das oeffentliche Repository dokumentiert die laufende Entwicklung und das Issue-Tracking.',
    },
    support: {
      title: 'Support-Seite',
      description: 'Hier findest du weitere Moeglichkeiten, das Projekt zu kontaktieren oder zu unterstuetzen.',
    },
  },
} as const