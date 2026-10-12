import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getSession } from '@/lib/supabase/server';
import { appErrorHttpBody } from '@/features/shared/errors/app-error';
import { plateJsTranslations as de } from '@/i18n/locales/de/plateJs';
import { plateJsTranslations as en } from '@/i18n/locales/en/plateJs';
import {
  datasetProviderErrorResponse,
  DatasetProviderFailure,
} from '@/server/datasets/providerError';
import {
  prepareRawDownload,
  rawDownloadRequestSchema,
  verifyRawDownloadTicket,
  streamRawDownload,
  RawDownloadDenied,
  type RawDownloadTicket,
} from '@/server/datasets/rawDownload';

function escapeHtml(value: string) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character as keyof typeof entities]);
}
/** A failed native transfer stays in its own window; no error document is saved as CSV. */
export function rawDownloadErrorPage(error: unknown, ticket?: RawDownloadTicket) {
  const copy = (ticket?.selection.language === 'de' ? de : en).dataView.rawDownload;
  const denied = error instanceof RawDownloadDenied;
  const background = error instanceof DatasetProviderFailure && error.code === 'too_large';
  const message = denied ? copy.expired : background ? copy.providerBackground : copy.failed;
  const status = denied ? 403 : error instanceof DatasetProviderFailure ? error.httpStatus : 502;
  return new Response(
    `<!doctype html><html lang="${ticket?.selection.language === 'de' ? 'de' : 'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.failed)}</title><style>body{font:16px system-ui;max-width:42rem;margin:10vh auto;padding:1.5rem;background:#f8f6ef;color:#182f2a}a{color:inherit}p{line-height:1.6}</style><main><h1>${escapeHtml(copy.failed)}</h1><p role="alert">${escapeHtml(message)}</p><p>${escapeHtml(copy.retryInDialog)}</p>${ticket?.sourceUrl ? `<a href="${escapeHtml(ticket.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(copy.openSource)}</a>` : ''}</main></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    }
  );
}
export const Route = createFileRoute('/api/datasets/raw-download')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user)
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        try {
          const input = rawDownloadRequestSchema.parse(await request.json());
          return Response.json(await prepareRawDownload(input, session.user.id, request.signal), {
            headers: { 'Cache-Control': 'private, no-store' },
          });
        } catch (error) {
          if (error instanceof RawDownloadDenied)
            return Response.json(appErrorHttpBody('permission_denied'), { status: 403 });
          if (error instanceof z.ZodError)
            return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
          return (
            datasetProviderErrorResponse(error) ??
            Response.json(appErrorHttpBody('dataset_operation_failed'), { status: 502 })
          );
        }
      },
      GET: async ({ request }) => {
        let ticket: RawDownloadTicket | undefined;
        try {
          ticket = verifyRawDownloadTicket(new URL(request.url).searchParams.get('ticket') ?? '');
          return await streamRawDownload(ticket, request.signal);
        } catch (error) {
          return rawDownloadErrorPage(error, ticket);
        }
      },
    },
  },
});
