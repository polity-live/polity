import type {
  DatasetSearchFilters,
  DatasetSearchIntent,
  DatasetSearchMatch,
  DatasetSearchResult,
} from '../types';

const AREAS = [
  [
    'Deutschland',
    'Deutschland',
    'Bundesrepublik Deutschland',
    'Germany',
    'Federal Republic of Germany',
    'Allemagne',
    'bundesweit',
  ],
  ['Baden-Württemberg', 'Baden-Württemberg', 'Baden-Wuerttemberg', 'Baden Württemberg'],
  ['Bayern', 'Bayern', 'Bavaria'],
  ['Berlin', 'Berlin'],
  ['Brandenburg', 'Brandenburg'],
  ['Bremen', 'Bremen'],
  ['Hamburg', 'Hamburg'],
  ['Hessen', 'Hessen', 'Hesse'],
  ['Mecklenburg-Vorpommern', 'Mecklenburg-Vorpommern', 'Mecklenburg Vorpommern'],
  ['Niedersachsen', 'Niedersachsen', 'Lower Saxony'],
  [
    'Nordrhein-Westfalen',
    'Nordrhein-Westfalen',
    'Nordrhein Westfalen',
    'NRW',
    'North Rhine-Westphalia',
  ],
  ['Rheinland-Pfalz', 'Rheinland-Pfalz', 'Rhineland-Palatinate'],
  ['Saarland', 'Saarland'],
  ['Sachsen-Anhalt', 'Sachsen-Anhalt', 'Saxony-Anhalt'],
  ['Sachsen', 'Sachsen', 'Saxony'],
  ['Schleswig-Holstein', 'Schleswig-Holstein', 'Schleswig Holstein'],
  ['Thüringen', 'Thüringen', 'Thueringen', 'Thuringia'],
] as const;

const CONCEPTS = [
  {
    id: 'rate',
    english: 'unemployment rate',
    aliases: ['Arbeitslosenquote', 'Arbeitslosenquoten', 'unemployment rate', 'unemployment rates'],
    variants: ['Arbeitslosenquote', 'unemployment rate'],
  },
  {
    id: 'unemployment',
    english: 'unemployment',
    aliases: [
      'Arbeitslosenzahlen',
      'Arbeitslosenstatistik',
      'number of unemployed',
      'Arbeitslosen',
      'Arbeitslose',
      'Arbeitslosigkeit',
      'unemployed',
      'unemployment',
    ],
    variants: ['Arbeitslose', 'Arbeitslosigkeit', 'unemployment'],
  },
  {
    id: 'population',
    english: 'population',
    aliases: ['Bevölkerung', 'Bevoelkerung', 'Einwohnerzahl', 'Einwohner', 'population'],
    variants: ['Bevölkerung', 'population'],
  },
  {
    id: 'gnp',
    english: 'gross national product',
    aliases: ['Bruttonationalprodukt', 'gross national product', 'GNP'],
    variants: ['Bruttonationalprodukt', 'gross national product', 'GNP'],
  },
  {
    id: 'gdp',
    english: 'gross domestic product',
    aliases: ['Bruttoinlandsprodukt', 'gross domestic product', 'GDP', 'BIP'],
    variants: ['Bruttoinlandsprodukt', 'gross domestic product', 'GDP'],
  },
  {
    id: 'economy',
    english: 'economy',
    aliases: ['Wirtschaft', 'economy', 'economic'],
    variants: ['Wirtschaft', 'economy', 'economic'],
  },
  {
    id: 'inflation',
    english: 'HICP',
    aliases: [
      'Inflation',
      'Verbraucherpreise',
      'Verbraucherpreisindex',
      'Verbraucherpreisindizes',
      'consumer prices',
      'consumer price',
      'HICP',
      'HVPI',
      'harmonised index of consumer prices',
    ],
    variants: ['Verbraucherpreisindex', 'HICP'],
  },
] as const;

export function normalizeDatasetSearchText(value: string) {
  return value
    .toLocaleLowerCase('de')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function phraseRegex(value: string) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegex(value)})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}
function conceptFor(value: string) {
  return CONCEPTS.find(concept =>
    concept.aliases.some(alias => phraseRegex(alias).test(value.replaceAll('_', ' ')))
  );
}
function containsConcept(value: string, concept: (typeof CONCEPTS)[number]) {
  const text = value.replaceAll('_', ' ');
  const candidate =
    concept.id === 'unemployment'
      ? CONCEPTS[0].aliases.reduce(
          (remaining, alias) => remaining.replace(phraseRegex(alias), '$1 '),
          text
        )
      : text;
  return concept.aliases.some(alias => phraseRegex(alias).test(candidate));
}
function recognizedArea(value: string): { label: string; aliases: readonly string[] } | null {
  let rest = value;
  const found = new Map<string, readonly string[]>();
  const aliases = AREAS.flatMap(area =>
    area.slice(1).map(alias => ({ label: area[0], alias, aliases: area.slice(1) }))
  ).sort((a, b) => b.alias.length - a.alias.length);
  for (const item of aliases) {
    const regex = phraseRegex(item.alias);
    if (regex.test(rest)) {
      found.set(item.label, item.aliases);
      rest = rest.replace(regex, '$1 ');
    }
  }
  if (found.size !== 1) return null;
  const [label, matchingAliases] = [...found][0];
  return { label, aliases: matchingAliases };
}

const YEAR = '(?:18|19|20|21)\\d{2}';
const periodRegex = () => new RegExp(`\\b(${YEAR})(?:\\s*(?:[-–/]|bis|to)\\s*(${YEAR}))?\\b`, 'gi');
export function interpretDatasetSearch(
  query: string,
  filters: DatasetSearchFilters = {}
): DatasetSearchIntent {
  const original = query.trim();
  const isCode =
    /^(?:[a-z][a-z0-9]*(?:_[a-z0-9]+)+|\d{5}-\d{4,}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(
      original
    );
  let topic = original;
  let autoPeriod: DatasetSearchIntent['period'] = null;
  let autoArea: string | null = null;
  if (!isCode) {
    const periods = [...topic.matchAll(periodRegex())];
    if (periods.length === 1) {
      const start = Number(periods[0][1]);
      const end = Number(periods[0][2] ?? start);
      if (start <= end) {
        autoPeriod = { start, end };
        topic = topic.replace(periods[0][0], ' ');
      }
    }
    const area = recognizedArea(topic);
    if (area) {
      autoArea = area.label;
      for (const alias of [...area.aliases].sort((a, b) => b.length - a.length))
        topic = topic.replace(phraseRegex(alias), '$1 ');
    }
    if (filters.area) topic = topic.replace(phraseRegex(filters.area), '$1 ');
  }
  return {
    query: original,
    topic: topic.replace(/\s+/g, ' ').trim(),
    period: filters.period === undefined ? autoPeriod : filters.period,
    area: filters.area === undefined ? autoArea : filters.area,
    isCode,
  };
}

export function parseDatasetSearchFilters(value: unknown): DatasetSearchFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid search filters');
  const input = value as Record<string, unknown>;
  const filters: DatasetSearchFilters = {};
  if ('area' in input) {
    if (
      input.area !== null &&
      (typeof input.area !== 'string' ||
        !input.area.trim() ||
        input.area.length > 120 ||
        Array.from(input.area).some(character => character.charCodeAt(0) < 32))
    )
      throw new Error('Invalid search area');
    filters.area = typeof input.area === 'string' ? input.area.trim() : null;
  }
  if ('period' in input) {
    if (input.period === null) filters.period = null;
    else {
      const period = input.period as { start?: unknown; end?: unknown } | null;
      if (
        !period ||
        typeof period !== 'object' ||
        !Number.isInteger(period.start) ||
        !Number.isInteger(period.end) ||
        Number(period.start) < 1800 ||
        Number(period.end) > 2199 ||
        Number(period.start) > Number(period.end)
      )
        throw new Error('Invalid search period');
      filters.period = { start: Number(period.start), end: Number(period.end) };
    }
  }
  return filters;
}

export function getDatasetTopicQueries(intent: DatasetSearchIntent, language?: 'de' | 'en') {
  if (intent.topic.length < 2) return [];
  if (intent.isCode) return [intent.topic];
  const concept = conceptFor(intent.topic);
  const alias = concept?.aliases.find(value => phraseRegex(value).test(intent.topic));
  const queries = [
    intent.topic,
    ...(concept && alias
      ? concept.variants.map(variant => intent.topic.replace(phraseRegex(alias), `$1${variant}`))
      : []),
  ];
  // Official price catalogues commonly use the index names rather than "inflation".
  if (concept?.id === 'inflation') queries.push(...queries.splice(0, 1));
  if (language && concept && alias)
    queries.unshift(
      intent.topic.replace(
        phraseRegex(alias),
        `$1${language === 'de' ? concept.variants[0] : concept.english}`
      )
    );
  const unique = queries.filter(
    (value, index) =>
      queries.findIndex(other => other.toLocaleLowerCase() === value.toLocaleLowerCase()) === index
  );
  // Keep an English topic variant within the three-query budget even for a less common
  // German alias, so the same intent can reach the English Eurostat catalogue.
  return unique.length > 3 ? [unique[0], unique[1], unique[3]] : unique;
}

export function datasetDescriptionText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function yearValue(value: unknown) {
  const match = String(value ?? '').match(new RegExp(`\\b(${YEAR})\\b`));
  return match ? Number(match[1]) : undefined;
}

export function normalizeDatasetCoverage(result: DatasetSearchResult): DatasetSearchResult {
  const normalized = { ...result };
  const coverageTitle = result.title.replace(
    /\b(?:Lizenz|license|copyright|Veröffentlichung|publication|published|release|updated|aktualisiert|veröffentlicht)\b.*$/i,
    ''
  );
  if (!result.timeCoverage?.start && !result.timeCoverage?.end) {
    const text = `${coverageTitle}\n${datasetDescriptionText(result.description ?? '')
      .split('\n')
      .filter(line =>
        /Datenstand|Datenzeitraum|Zeitraum|Berichtsjahr|time coverage|reporting period|data period/i.test(
          line
        )
      )
      .join('\n')}`;
    const years = [...text.replaceAll('_', ' ').matchAll(periodRegex())].filter(
      year => !year[2] || Number(year[1]) <= Number(year[2])
    );
    if (years.length) {
      normalized.timeCoverage = {
        start: String(Math.min(...years.map(year => Number(year[1])))),
        end: String(Math.max(...years.map(year => Number(year[2] ?? year[1])))),
      };
      normalized.metadata = {
        ...normalized.metadata,
        searchPeriodSource: 'text',
        searchPeriodYears: years.flatMap(year =>
          year[2]
            ? Array.from(
                { length: Number(year[2]) - Number(year[1]) + 1 },
                (_, i) => Number(year[1]) + i
              )
            : [Number(year[1])]
        ),
      };
    }
  }
  const structuredLabels = areaLabels(result.spatialCoverage);
  if (!structuredLabels.length) {
    const description = datasetDescriptionText(result.description ?? '');
    const local =
      description.match(
        /(?:für|for)\s+([\p{Lu}][\p{L}\p{M} .-]{1,60}?)\s+(?:gesamt|insgesamt)(?=[\s.,;]|$)/u
      ) ??
      description.match(
        /^(?:Gebiet|Region|räumlicher Bezug|spatial coverage|area):\s*([^\n;]+)\s*$/imu
      ) ??
      coverageTitle.match(
        /(?:Stadt|Landkreis|Gemeinde|city of)\s+([\p{Lu}][\p{L}\p{M}-]+(?:\s+[\p{Lu}][\p{L}\p{M}-]+)*)/u
      ) ??
      coverageTitle.match(/:\s*([^,:\n]+),\s*(?:Jahre|years)/i);
    const known = recognizedArea(coverageTitle);
    const explicitNational = /\bbundesweit\b/i.test(description) ? 'Deutschland' : null;
    const label = local?.[1]?.trim() ?? known?.label ?? explicitNational;
    if (label) {
      normalized.spatialCoverage = [recognizedArea(label)?.label ?? label];
      normalized.metadata = { ...normalized.metadata, searchAreaSource: 'text' };
    }
  }
  return normalized;
}

function areaLabels(value: DatasetSearchResult['spatialCoverage']): string[] {
  if (Array.isArray(value))
    return value
      .filter(label => typeof label === 'string' && label.trim())
      .map(label => label.trim());
  if (value && typeof value === 'object')
    return [value.label, value.name, value.code].filter(
      (label): label is string => typeof label === 'string' && !!label.trim()
    );
  return [];
}
export function normalizeDatasetArea(value: string) {
  return normalizeDatasetSearchText(
    ['DE', 'DEU'].includes(value.toUpperCase())
      ? 'Deutschland'
      : (recognizedArea(value)?.label ?? value)
  );
}
function topicScore(result: DatasetSearchResult, intent: DatasetSearchIntent) {
  if (!intent.topic) return 1;
  if (
    normalizeDatasetSearchText(result.providerDatasetId ?? result.id) ===
    normalizeDatasetSearchText(intent.topic)
  )
    return 10;
  const title = datasetDescriptionText(result.title).replaceAll('_', ' ');
  const description = datasetDescriptionText(result.description ?? '');
  const concept = conceptFor(intent.topic);
  if (concept) {
    const titleConcept = conceptFor(title);
    const descriptionConcept = conceptFor(description);
    const extra = concept.aliases.reduce(
      (value, alias) => value.replace(phraseRegex(alias), '$1 '),
      intent.topic
    );
    const extras = normalizeDatasetSearchText(extra)
      .split(' ')
      .filter(
        token =>
          token.length > 1 &&
          ![
            'nach',
            'by',
            'und',
            'and',
            'der',
            'die',
            'das',
            'in',
            'of',
            'the',
            'for',
            'von',
            normalizeDatasetSearchText('für'),
          ].includes(token)
      );
    const haystack = normalizeDatasetSearchText(`${title} ${description}`);
    if (!extras.every(token => haystack.includes(token))) return 0;
    if (containsConcept(title, concept))
      return normalizeDatasetSearchText(title).includes(normalizeDatasetSearchText(intent.topic))
        ? 6
        : 5;
    if (containsConcept(description, concept)) return 2;
    if (
      ['rate', 'unemployment'].includes(concept.id) &&
      [titleConcept?.id, descriptionConcept?.id].some(
        id => id && ['rate', 'unemployment'].includes(id)
      )
    )
      return 1;
    return 0;
  }
  const tokens = normalizeDatasetSearchText(intent.topic).split(' ').filter(Boolean);
  const titleText = normalizeDatasetSearchText(title);
  const descriptionText = normalizeDatasetSearchText(description);
  if (tokens.every(token => titleText.includes(token))) return 6;
  return tokens.every(token => `${titleText} ${descriptionText}`.includes(token)) ? 3 : 0;
}

export function rankDatasetSearchResults(
  results: DatasetSearchResult[],
  intent: DatasetSearchIntent
) {
  const seen = new Map<string, DatasetSearchResult>();
  // Prefer the stored snapshot when the same public resource is also returned by a provider.
  for (const result of results) {
    const key = `${result.provider}:${result.providerDatasetId ?? result.id}:${result.providerResourceId ?? ''}`;
    if (!seen.has(key) || result.snapshotId) seen.set(key, result);
  }
  return [...seen.values()]
    .map(normalizeDatasetCoverage)
    .map(result => {
      const score = topicScore(result, intent);
      const labels = areaLabels(result.spatialCoverage);
      const areaSource = labels.length
        ? result.metadata?.searchAreaSource === 'text'
          ? 'text'
          : 'metadata'
        : 'unknown';
      const requestedArea = intent.area;
      const areaStatus = !requestedArea
        ? 'match'
        : !labels.length
          ? 'unknown'
          : labels.some(
                label => normalizeDatasetArea(label) === normalizeDatasetArea(requestedArea)
              )
            ? 'match'
            : 'different';
      const start = yearValue(result.timeCoverage?.start);
      const end = yearValue(result.timeCoverage?.end);
      const periodSource =
        start !== undefined || end !== undefined
          ? result.metadata?.searchPeriodSource === 'text'
            ? 'text'
            : 'metadata'
          : 'unknown';
      const years = result.metadata?.searchPeriodYears;
      const requested = intent.period;
      const periodStatus = !requested
        ? 'match'
        : (start !== undefined && start > requested.start) ||
            (end !== undefined && end < requested.end)
          ? 'different'
          : start === undefined || end === undefined
            ? 'unknown'
            : Array.isArray(years) &&
                !Array.from(
                  { length: requested.end - requested.start + 1 },
                  (_, i) => requested.start + i
                ).every(year => years.includes(year))
              ? 'unknown'
              : 'match';
      const match: DatasetSearchMatch = {
        group:
          score >= 3 &&
          areaStatus === 'match' &&
          periodStatus === 'match' &&
          result.metadata?.searchScopeMatches !== false
            ? 'matching'
            : 'other',
        area: {
          status: areaStatus,
          label:
            requestedArea && areaStatus === 'match'
              ? requestedArea
              : labels.length > 3
                ? `${labels.slice(0, 3).join(', ')} (+${labels.length - 3})`
                : labels.join(', ') || undefined,
          source: areaSource,
        },
        period: { status: periodStatus, start, end, source: periodSource },
      };
      return { result: { ...result, searchMatch: match }, score };
    })
    .filter(entry => entry.score > 0)
    .sort(
      (a, b) =>
        Number(b.result.searchMatch.group === 'matching') -
          Number(a.result.searchMatch.group === 'matching') ||
        b.score - a.score ||
        ['match', 'unknown', 'different'].indexOf(a.result.searchMatch.area.status) -
          ['match', 'unknown', 'different'].indexOf(b.result.searchMatch.area.status) ||
        ['match', 'unknown', 'different'].indexOf(a.result.searchMatch.period.status) -
          ['match', 'unknown', 'different'].indexOf(b.result.searchMatch.period.status) ||
        a.result.title.localeCompare(b.result.title, 'de') ||
        a.result.id.localeCompare(b.result.id)
    )
    .map(entry => entry.result);
}
