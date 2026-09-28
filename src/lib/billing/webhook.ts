import type Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { getPlanForPrice, getStripe } from '@/lib/billing/stripe';

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  const plan = priceId ? getPlanForPrice(priceId) : null;
  if (!plan) return;

  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  if (!user) throw new Error('Stripe customer is not linked to a GitAgent account.');

  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      userId: user.id,
      plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    },
    update: {
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      userId: user.id,
      plan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    },
  });
}

export async function processStripeEvent(event: Stripe.Event) {
  if (await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } })) return;

  const stripe = getStripe();
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription);
    }
  } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const eventSubscription = event.data.object as Stripe.Subscription;
    const currentSubscription = await stripe.subscriptions.retrieve(eventSubscription.id);
    await syncSubscription(currentSubscription);
  }

  try {
    await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return;
    throw error;
  }
}
