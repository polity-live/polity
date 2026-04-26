import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

const geoapifyReverseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  language: z.string().min(2),
});

const geoapifyReverseResponseSchema = z.object({
  results: z.array(geoResolvedAddressSchema).optional(),
});

type GeoResolvedAddress = z.infer<typeof geoResolvedAddressSchema>;

function getGeoapifyApiKey(): string {
  const apiKey = process.env.GEOAPIFY_API_KEY ?? process.env.VITE_GEOAPIFY_API_KEY;

  if (!apiKey) {
    throw new Error('Geoapify API key is not configured');
  }

  return apiKey;
}

function buildGeoapifyReverseUrl(
  latitude: number,
  longitude: number,
  language: string,
  apiKey: string
): string {
  const params = new URLSearchParams({
    apiKey,
    format: 'json',
    lat: String(latitude),
    lon: String(longitude),
    lang: language,
  });

  return `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`;
}

export const geoapifyReverseFn = createServerFn({ method: 'POST' })
  .validator(geoapifyReverseSchema.parse)
  .handler(async ({ data }) => {
    const response = await fetch(
      buildGeoapifyReverseUrl(data.latitude, data.longitude, data.language, getGeoapifyApiKey()),
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geoapify reverse request failed with status ${response.status}`);
    }

    const payload = geoapifyReverseResponseSchema.parse(await response.json()) as {
      results?: GeoResolvedAddress[];
    };

    return {
      result: payload.results?.[0] ?? null,
    };
  });
