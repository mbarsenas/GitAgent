import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getAppUrl, getPriceId, getStripe, type PaidPlan } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const form = await request.formData();
    const planValue = form.get('plan');
    if (planValue !== 'pro' && planValue !== 'team') return NextResponse.json({ error: 'Choose a valid plan.' }, { status: 400 });
    const plan: PaidPlan = planValue;
    const priceId = getPriceId(plan);
    if (!priceId || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Paid checkout is not configured yet.' }, { status: 503 });
    }

    const existingSubscription = await prisma.billingSubscription.findFirst({
      where: { userId: user.userId, status: { in: ['active', 'trialing', 'past_due', 'incomplete'] } },
      select: { id: true },
    });
    if (existingSubscription) return NextResponse.redirect(new URL('/billing?error=subscription_exists', request.url), 303);

    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const expectedAmount = plan === 'pro' ? 2900 : 7900;
    if (!price.active || price.type !== 'recurring' || price.currency !== 'usd' || price.unit_amount !== expectedAmount || price.recurring?.interval !== 'month') {
      return NextResponse.json({ error: 'This plan is not available for purchase yet.' }, { status: 409 });
    }

    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, email: true, name: true, stripeCustomerId: true } });
    if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    let customerId = account.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: account.email,
        name: account.name ?? undefined,
        metadata: { gitagent_user_id: account.id },
      }, { idempotencyKey: `gitagent_customer_${account.id}` });
      customerId = customer.id;
      await prisma.user.update({ where: { id: account.id }, data: { stripeCustomerId: customerId } });
    }

    const origin = getAppUrl(request.url);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: account.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      subscription_data: { metadata: { gitagent_user_id: account.id, plan } },
      metadata: { gitagent_user_id: account.id, plan },
    }, { idempotencyKey: `gitagent_checkout_${account.id}_${crypto.randomUUID()}` });
    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.redirect(new URL('/signin', request.url), 303);
    console.error('POST /api/billing/checkout failed', error);
    return NextResponse.json({ error: 'Unable to start checkout. Please try again.' }, { status: 500 });
  }
}
