import { createFileRoute } from '@tanstack/react-router';
import { FRANKFURTER_FALLBACK_CURRENCY_CODES } from '@/features/shared/logic/currency';
import { getFrankfurterCurrencies } from '@/server/currency/frankfurter';

export const Route = createFileRoute('/api/currency/currencies')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json({
            currencies: await getFrankfurterCurrencies(),
            source: 'frankfurter',
          });
        } catch (error) {
          console.error('Frankfurter currency catalogue fetch failed:', error);
          return Response.json({
            currencies: FRANKFURTER_FALLBACK_CURRENCY_CODES,
            source: 'fallback',
          });
        }
      },
    },
  },
});
