import { handleStripeWebhook, StripeWebhookHttpError } from './stripe-service';

export async function handleStripeWebhookRequest(request: Request) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const result = await handleStripeWebhook({ rawBody, signature });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe webhook failed';
    const status = error instanceof StripeWebhookHttpError ? error.status : 500;

    console.error('Stripe webhook route error:', message);
    return new Response(message, { status });
  }
}
