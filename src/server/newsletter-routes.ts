import {
  authorizeNewsletterSync,
  executeNewsletterSync,
  handleResendWebhook,
  NewsletterHttpError,
} from './newsletter-service';

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof NewsletterHttpError ? error.status : 500;
  console.error(`${fallback}:`, message);
  return new Response(message, { status });
}

export async function handleNewsletterSyncRequest(request: Request) {
  try {
    authorizeNewsletterSync(request);
    return Response.json(await executeNewsletterSync());
  } catch (error) {
    return errorResponse(error, 'Newsletter sync failed');
  }
}

export async function handleResendWebhookRequest(request: Request) {
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing Resend signature headers', { status: 400 });
  }

  try {
    const rawBody = await request.text();
    return Response.json(
      await handleResendWebhook({ rawBody, svixId, svixTimestamp, svixSignature })
    );
  } catch (error) {
    return errorResponse(error, 'Resend webhook failed');
  }
}
