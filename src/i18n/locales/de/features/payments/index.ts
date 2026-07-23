export const paymentsTranslations = {
  title: 'Zahlungen',
  subscriptions: {
    types: {
      user: 'Benutzer',
      group: 'Gruppe',
      amendment: 'Antrag',
      event: 'Veranstaltung',
      blog: 'Blog',
      unknown: 'Unbekannt',
    },
    unknown: {
      user: 'Unbekannter Benutzer',
      group: 'Unbekannte Gruppe',
      amendment: 'Unbekannter Antrag',
      event: 'Unbekannte Veranstaltung',
      blog: 'Unbekannter Blog',
      entity: 'Unbekannte Entität',
    },
    notAvailable: 'k. A.',
  },
  billing: {
    title: 'Abrechnung',
    description: 'Rechnungen, Zahlungsarten und Kündigungen sicher bei Stripe verwalten.',
    manage: 'Zahlungen verwalten',
    synced: 'Die Abrechnungsdaten wurden aktualisiert.',
    portalError: 'Das Kundenportal konnte nicht geöffnet werden.',
  },
  plans: {
    activeUntil: 'Aktiv bis {{date}}',
    thenFree: 'Danach wechselst du automatisch zu Free.',
    nextPlan: 'Nächster Tarif',
    freeFrom: 'Free ab {{date}}',
    changeScheduled: 'Wechsel geplant',
    cancellationScheduled: 'Der Wechsel zu Free zum Ende des Abrechnungszeitraums ist geplant.',
  },
} as const;
