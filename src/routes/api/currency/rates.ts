import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { currencyCodeSchema } from '@/features/shared/logic/currency';
import { getExchangeRates, validateExchangeRateDate } from '@/server/currency/frankfurter';

export const currencyRateRequestSchema = z.object({
  requests: z
    .array(
      z.object({
        base: currencyCodeSchema,
        quote: currencyCodeSchema,
        date: z.string().optional().transform(validateExchangeRateDate),
      })
    )
    .max(100),
});

export const Route = createFileRoute('/api/currency/rates')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = currencyRateRequestSchema.parse(await request.json());
          return Response.json({ rates: await getExchangeRates(body.requests) });
        } catch (error) {
          const isValidation = error instanceof z.ZodError;
          return Response.json(
            { error: error instanceof Error ? error.message : 'Currency rates are unavailable' },
            { status: isValidation ? 400 : 502 }
          );
        }
      },
    },
  },
});
