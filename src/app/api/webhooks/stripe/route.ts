import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/billing/stripe';
import { processStripeEvent } from '@/lib/billing/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!secret || !signature) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 400 });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  try {
    await processStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed', { eventId: event.id, type: event.type, error });
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
