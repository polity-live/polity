import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const geoAddressFieldSchema = z.enum([
  'country',
  'region',
  'city',
  'post_code',
  'street',
  'house_number',
]);

const geoResolvedAddressSchema = z.object({
  place_id: z.string(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  street: z.string().optional(),
  housenumber: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  formatted: z.string().optional(),
  result_type: z.string().optional(),
  rank: z
    .object({
      confidence: z.number().optional(),
      confidence_city_level: z.number().optional(),
      confidence_street_level: z.number().optional(),
      confidence_building_level: z.number().optional(),
    })
    .optional(),
});

const geoAddressValuesSchema = z.object({
  country: z.string(),
  region: z.string(),
  city: z.string(),
  post_code: z.string(),
  street: z.string(),
  house_number: z.string(),
});

const geoAddressContextSchema = z.object({
  country: geoResolvedAddressSchema.nullable(),
  region: geoResolvedAddressSchema.nullable(),
  city: geoResolvedAddressSchema.nullable(),
  post_code: geoResolvedAddressSchema.nullable(),
  street: geoResolvedAddressSchema.nullable(),
});

const geoapifySearchSchema = z.object({
  field: geoAddressFieldSchema,
  query: z.string(),
  values: geoAddressValuesSchema,
  context: geoAddressContextSchema,
  language: z.string().min(2),
});

type GeoAddressField = z.infer<typeof geoAddressFieldSchema>;
type GeoResolvedAddress = z.infer<typeof geoResolvedAddressSchema>;
type GeoAddressValues = z.infer<typeof geoAddressValuesSchema>;
type GeoAddressContext = z.infer<typeof geoAddressContextSchema>;

const FIELD_TYPES: Record<Exclude<GeoAddressField, 'house_number'>, string> = {
  country: 'country',
  region: 'state',
  city: 'city',
  post_code: 'postcode',
  street: 'street',
};

function getGeoapifyApiKey(): string {
  const apiKey = process.env.GEOAPIFY_API_KEY ?? process.env.VITE_GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error('Geoapify API key is not configured');
  }

  return apiKey;
}

function buildFilter(field: GeoAddressField, context: GeoAddressContext): string | null {
  const filters: string[] = [];

  if (context.country?.country_code) {
    filters.push(`countrycode:${context.country.country_code}`);
  }

  if (field === 'city' && context.region?.place_id) {
    filters.push(`place:${context.region.place_id}`);
  }

  if (field === 'post_code') {
    const placeId = context.city?.place_id ?? context.region?.place_id;
    if (placeId) {
      filters.push(`place:${placeId}`);
    }
  }

  if (field === 'street') {
    const placeId =
      context.post_code?.place_id ?? context.city?.place_id ?? context.region?.place_id;
    if (placeId) {
      filters.push(`place:${placeId}`);
    }
  }

  return filters.length > 0 ? filters.join('|') : null;
}

function buildBias(field: GeoAddressField, context: GeoAddressContext): string | null {
  if (field === 'country' || field === 'region') {
    return field === 'country' ? 'countrycode:none' : null;
  }

  const source = context.post_code ?? context.city ?? context.region ?? context.country;

  if (source?.lon != null && source.lat != null) {
    return `proximity:${source.lon},${source.lat}`;
  }

  return null;
}

function buildHouseNumberText(query: string, values: GeoAddressValues): string {
  return [
    [query.trim(), values.street.trim()].filter(Boolean).join(' '),
    values.post_code.trim(),
    values.city.trim(),
    values.region.trim(),
    values.country.trim(),
  ]
    .filter(Boolean)
    .join(', ');
}

function buildGeoapifyUrl(
  field: GeoAddressField,
  query: string,
  values: GeoAddressValues,
  context: GeoAddressContext,
  language: string,
  apiKey: string
): string {
  const params = new URLSearchParams({
    apiKey,
    format: 'json',
    lang: language,
    limit: '6',
  });

  if (field === 'house_number') {
    params.set('text', buildHouseNumberText(query, values));
  } else {
    params.set('text', query);
    params.set('type', FIELD_TYPES[field]);

    const filter = buildFilter(field, context);
    if (filter) {
      params.set('filter', filter);
    }

    const bias = buildBias(field, context);
    if (bias) {
      params.set('bias', bias);
    }
  }

  return `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`;
}

export const geoapifySearchFn = createServerFn({ method: 'POST' })
  .validator(geoapifySearchSchema.parse)
  .handler(async ({ data }) => {
    const response = await fetch(
      buildGeoapifyUrl(
        data.field,
        data.query,
        data.values,
        data.context,
        data.language,
        getGeoapifyApiKey()
      ),
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geoapify request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { results?: GeoResolvedAddress[] };
    return {
      results: payload.results ?? [],
    };
  });
