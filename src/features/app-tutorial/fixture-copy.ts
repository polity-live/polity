import type { AppTutorialLanguage } from './catalog';

type AppTutorialFixtureCopy = Readonly<Record<AppTutorialLanguage, string>>;

function copy(de: string, en: string): AppTutorialFixtureCopy {
  return { de, en };
}

/**
 * Display-only translations for values persisted by the app tutorial service.
 * Keys intentionally remain the German fixture values so no database migration
 * or wire-format change is required.
 */
export const APP_TUTORIAL_FIXTURE_COPY: Readonly<Record<string, AppTutorialFixtureCopy>> = {
  München: copy('München', 'Munich'),
  'Initiative Klimafitte Euckenstraße': copy(
    'Initiative Klimafitte Euckenstraße',
    'Climate-Friendly Euckenstraße Initiative'
  ),
  'Gemeinsam gestalten wir die Euckenstraße klimaresilient, sicher und lebenswert.': copy(
    'Gemeinsam gestalten wir die Euckenstraße klimaresilient, sicher und lebenswert.',
    'Together, we are making Euckenstraße climate-resilient, safe, and livable.'
  ),
  'Mobilitätsforum München-West': copy(
    'Mobilitätsforum München-West',
    'Munich West Mobility Forum'
  ),
  'Austausch für sichere und nachhaltige Mobilität im Münchner Westen.': copy(
    'Austausch für sichere und nachhaltige Mobilität im Münchner Westen.',
    'A forum for safe and sustainable mobility in western Munich.'
  ),
  'Münchner Klimarat': copy('Münchner Klimarat', 'Munich Climate Council'),
  'Transparente, vernetzte Klimapolitik für München.': copy(
    'Transparente, vernetzte Klimapolitik für München.',
    'Transparent, connected climate policy for Munich.'
  ),
  'Werkstatt Klimafitte Euckenstraße': copy(
    'Werkstatt Klimafitte Euckenstraße',
    'Climate-Friendly Euckenstraße Workshop'
  ),
  'Beratung und Beschluss des vorbereiteten Entwurfs zur Stadtgestaltung.': copy(
    'Beratung und Beschluss des vorbereiteten Entwurfs zur Stadtgestaltung.',
    'Discussion and decision on the prepared City Design.'
  ),
  'Sitzung Münchner Klimarat': copy('Sitzung Münchner Klimarat', 'Munich Climate Council Meeting'),
  'Folgeberatung vernetzter Münchner Klima-Initiativen.': copy(
    'Folgeberatung vernetzter Münchner Klima-Initiativen.',
    'Follow-up discussion among connected Munich climate initiatives.'
  ),
  'Tutorial-Teilnehmende': copy('Tutorial-Teilnehmende', 'Tutorial Participants'),
  'Rolle für Abstimmung und Agenda im isolierten Live-Tutorial.': copy(
    'Rolle für Abstimmung und Agenda im isolierten Live-Tutorial.',
    'Role for voting and agenda participation in the isolated live tutorial.'
  ),
  'Rathaus München': copy('Rathaus München', 'Munich City Hall'),
  'Klimafitte Euckenstraße: geschützter Radweg und Baumreihe': copy(
    'Klimafitte Euckenstraße: geschützter Radweg und Baumreihe',
    'Climate-Friendly Euckenstraße: Protected Bike Lane and Row of Trees'
  ),
  'Mehr Sicherheit, Schatten und Versickerungsfläche für die Euckenstraße.': copy(
    'Mehr Sicherheit, Schatten und Versickerungsfläche für die Euckenstraße.',
    'More safety, shade, and permeable space for Euckenstraße.'
  ),
  'Die Euckenstraße erhält einen geschützten Radweg und zusätzliche klimaresiliente Begrünung.':
    copy(
      'Die Euckenstraße erhält einen geschützten Radweg und zusätzliche klimaresiliente Begrünung.',
      'Euckenstraße will receive a protected bike lane and additional climate-resilient greenery.'
    ),
  'Die Umsetzung wird schrittweise dokumentiert und gemeinsam ausgewertet.': copy(
    'Die Umsetzung wird schrittweise dokumentiert und gemeinsam ausgewertet.',
    'Implementation is documented step by step and evaluated together.'
  ),
  'Vorbereiteter Tutorial-Stand': copy('Vorbereiteter Tutorial-Stand', 'Prepared Tutorial Version'),
  'Klimafitte Euckenstraße beschließen': copy(
    'Klimafitte Euckenstraße beschließen',
    'Decide on a Climate-Friendly Euckenstraße'
  ),
  'Beratung und Abstimmung des vorbereiteten Amendments.': copy(
    'Beratung und Abstimmung des vorbereiteten Amendments.',
    'Discussion and vote on the prepared motion.'
  ),
  'Klimafitte Euckenstraße annehmen': copy(
    'Klimafitte Euckenstraße annehmen',
    'Adopt the Climate-Friendly Euckenstraße Proposal'
  ),
  'Finale Abstimmung über die vorbereitete Stadtgestaltung.': copy(
    'Finale Abstimmung über die vorbereitete Stadtgestaltung.',
    'Final vote on the prepared City Design.'
  ),
  Ja: copy('Ja', 'Yes'),
  Nein: copy('Nein', 'No'),
  Enthaltung: copy('Enthaltung', 'Abstention'),
  'Wahl zum Kreisvorsitzenden': copy(
    'Wahl zum Kreisvorsitzenden',
    'Election of the District Chair'
  ),
  'Die Initiative wählt eine Person für den Kreisvorsitz.': copy(
    'Die Initiative wählt eine Person für den Kreisvorsitz.',
    'The initiative elects a person as district chair.'
  ),
  'Kreisvorsitzende:r': copy('Kreisvorsitzende:r', 'District Chair'),
  'Wahl zum Kreisvorsitz innerhalb der Initiative Klimafitte Euckenstraße.': copy(
    'Wahl zum Kreisvorsitz innerhalb der Initiative Klimafitte Euckenstraße.',
    'Election of the district chair within the Climate-Friendly Euckenstraße initiative.'
  ),
  'Münchner Klimarat im Netzwerk verknüpfen': copy(
    'Münchner Klimarat im Netzwerk verknüpfen',
    'Connect the Munich Climate Council to the Network'
  ),
  'Verknüpfe die Initiative als Untergruppe mit dem Münchner Klimarat und frage Informations- und Antragsrecht an.':
    copy(
      'Verknüpfe die Initiative als Untergruppe mit dem Münchner Klimarat und frage Informations- und Antragsrecht an.',
      'Connect the initiative to the Munich Climate Council as a child group and request information and motion rights.'
    ),
  'Warum die Euckenstraße mehr Schatten braucht': copy(
    'Warum die Euckenstraße mehr Schatten braucht',
    'Why Euckenstraße Needs More Shade'
  ),
  'Hintergründe zur klimaresilienten Stadtgestaltung.': copy(
    'Hintergründe zur klimaresilienten Stadtgestaltung.',
    'Background on climate-resilient City Design.'
  ),
  'Bäume, Entsiegelung und sichere Mobilität wirken gemeinsam gegen Hitze.': copy(
    'Bäume, Entsiegelung und sichere Mobilität wirken gemeinsam gegen Hitze.',
    'Trees, unsealed surfaces, and safe mobility work together to reduce heat.'
  ),
  'Sichere Wege und kühle Straßen gehören zusammen.': copy(
    'Sichere Wege und kühle Straßen gehören zusammen.',
    'Safe routes and cool streets belong together.'
  ),
  'Ich unterstütze den geschützten Radweg und die neue Baumreihe.': copy(
    'Ich unterstütze den geschützten Radweg und die neue Baumreihe.',
    'I support the protected bike lane and the new row of trees.'
  ),
  'Planungsbudget Straßenwerkstatt': copy(
    'Planungsbudget Straßenwerkstatt',
    'Street Workshop Planning Budget'
  ),
  'Live-Tutorial · Assistent Aria & Kai': copy(
    'Live-Tutorial · Assistent Aria & Kai',
    'Live Tutorial · Aria & Kai Assistant'
  ),
  'Ich begleite dich im Live-Tutorial. Erstelle gleich gemeinsam mit mir eine echte Sandbox-Aufgabe.':
    copy(
      'Ich begleite dich im Live-Tutorial. Erstelle gleich gemeinsam mit mir eine echte Sandbox-Aufgabe.',
      'I will guide you through the live tutorial. In a moment, we will create a real sandbox task together.'
    ),
  'Mitgliedschaft bestätigt': copy('Mitgliedschaft bestätigt', 'Membership Confirmed'),
  'Deine Mitgliedschaft in der Initiative Klimafitte Euckenstraße wurde bestätigt.': copy(
    'Deine Mitgliedschaft in der Initiative Klimafitte Euckenstraße wurde bestätigt.',
    'Your membership in the Climate-Friendly Euckenstraße Initiative has been confirmed.'
  ),
  'Klimafitte Euckenstraße weiterberaten': copy(
    'Klimafitte Euckenstraße weiterberaten',
    'Continue Discussing a Climate-Friendly Euckenstraße'
  ),
  'Baumstandorte klimaresilient planen': copy(
    'Baumstandorte klimaresilient planen',
    'Plan Climate-Resilient Tree Locations'
  ),
  'Die Baumarten und Standorte werden an Hitze und Starkregen angepasst.': copy(
    'Die Baumarten und Standorte werden an Hitze und Starkregen angepasst.',
    'Tree species and locations are adapted to heat and heavy rainfall.'
  ),
  'Die Baumreihe verwendet klimaresiliente Arten mit großzügigen Baumgruben.': copy(
    'Die Baumreihe verwendet klimaresiliente Arten mit großzügigen Baumgruben.',
    'The row of trees uses climate-resilient species with generous tree pits.'
  ),
  'Lieferzonen zeitlich sichern': copy(
    'Lieferzonen zeitlich sichern',
    'Set Time Limits for Loading Zones'
  ),
  'Zeitfenster vermeiden Konflikte zwischen Lieferverkehr und Radweg.': copy(
    'Zeitfenster vermeiden Konflikte zwischen Lieferverkehr und Radweg.',
    'Time windows prevent conflicts between delivery traffic and the bike lane.'
  ),
  'Lieferzonen werden morgens zeitlich begrenzt und niveaugleich integriert.': copy(
    'Lieferzonen werden morgens zeitlich begrenzt und niveaugleich integriert.',
    'Loading zones are time-limited in the morning and integrated at the same level.'
  ),
  'Die Welt zu einem besseren Ort machen': copy(
    'Die Welt zu einem besseren Ort machen',
    'Make the World a Better Place'
  ),
  'Die Aufgabe wurde erstellt.': copy('Die Aufgabe wurde erstellt.', 'The task was created.'),
  'pending · medium': copy('Ausstehend · Mittel', 'Pending · Medium'),
  'Simulierte Kandidatur im Live-Tutorial.': copy(
    'Simulierte Kandidatur im Live-Tutorial.',
    'Simulated candidacy in the live tutorial.'
  ),
} as const;

function fixtureCopyFor(value: string): AppTutorialFixtureCopy | null {
  const directCopy = APP_TUTORIAL_FIXTURE_COPY[value];
  if (directCopy) return directCopy;
  return (
    Object.values(APP_TUTORIAL_FIXTURE_COPY).find(
      fixtureCopy => fixtureCopy.de === value || fixtureCopy.en === value
    ) ?? null
  );
}

export function resolveAppTutorialFixtureText(
  value: string | null | undefined,
  {
    tutorialRunId,
    language,
  }: {
    tutorialRunId: string | null | undefined;
    language: AppTutorialLanguage;
  }
): string | null | undefined {
  if (!tutorialRunId || !value) return value;
  return fixtureCopyFor(value)?.[language] ?? value;
}

export function getAppTutorialFixtureTextVariants(
  value: string | null | undefined,
  { tutorialRunId }: { tutorialRunId: string | null | undefined }
): readonly string[] {
  if (!tutorialRunId || !value) return [];
  const fixtureCopy = fixtureCopyFor(value);
  return fixtureCopy ? Array.from(new Set([fixtureCopy.de, fixtureCopy.en])) : [];
}

export function collectAppTutorialFixtureTextAliases(value: string): readonly string[] {
  const normalizedValue = value.toLocaleLowerCase('de-DE');
  const aliases = new Set<string>();
  for (const fixtureCopy of Object.values(APP_TUTORIAL_FIXTURE_COPY)) {
    if (
      normalizedValue.includes(fixtureCopy.de.toLocaleLowerCase('de-DE')) ||
      normalizedValue.includes(fixtureCopy.en.toLocaleLowerCase('en-US'))
    ) {
      aliases.add(fixtureCopy.de);
      aliases.add(fixtureCopy.en);
    }
  }
  return [...aliases];
}

export function addAppTutorialFixtureTextAliasesToSearchText(value: string): string {
  const normalizedValue = value.toLocaleLowerCase('de-DE');
  const missingAliases = collectAppTutorialFixtureTextAliases(value).filter(
    alias => !normalizedValue.includes(alias.toLocaleLowerCase('de-DE'))
  );
  return missingAliases.length > 0 ? `${value} ${missingAliases.join(' ')}` : value;
}

export function resolveAppTutorialFixtureValue<T>(
  value: T,
  options: {
    tutorialRunId: string | null | undefined;
    language: AppTutorialLanguage;
  }
): T {
  if (!options.tutorialRunId || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return resolveAppTutorialFixtureText(value, options) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => resolveAppTutorialFixtureValue(item, options)) as T;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          resolveAppTutorialFixtureValue(item, options),
        ])
      ) as T;
    }
  }
  return value;
}
