import Stripe from 'stripe';

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Stripe billing is not configured.');
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export type PaidPlan = 'pro' | 'team';

export function getPriceId(plan: PaidPlan) {
  return plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_TEAM;
}

export function getPlanForPrice(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team';
  return null;
}

export async function isPlanAvailable(plan: PaidPlan) {
  const priceId = getPriceId(plan);
  const missingConfiguration = [
    !priceId && `STRIPE_PRICE_${plan.toUpperCase()}`,
    !process.env.STRIPE_SECRET_KEY && 'STRIPE_SECRET_KEY',
    !process.env.STRIPE_WEBHOOK_SECRET && 'STRIPE_WEBHOOK_SECRET',
    process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL && 'NEXT_PUBLIC_APP_URL',
  ].filter((value): value is string => Boolean(value));

  if (missingConfiguration.length > 0) {
    console.warn('Stripe plan unavailable: missing production configuration', { plan, missingConfiguration });
    return false;
  }

  try {
    const price = await getStripe().prices.retrieve(priceId!);
    const expectedAmount = plan === 'pro' ? 2900 : 7900;
    const available = price.active
      && price.type === 'recurring'
      && price.currency === 'usd'
      && price.unit_amount === expectedAmount
      && price.recurring?.interval === 'month';

    if (!available) {
      console.warn('Stripe plan unavailable: price does not match published plan', {
        plan,
        active: price.active,
        type: price.type,
        currency: price.currency,
        unitAmount: price.unit_amount,
        interval: price.recurring?.interval,
      });
    }
    return available;
  } catch (error) {
    const stripeError = error as { type?: string; statusCode?: number; code?: string; requestId?: string };
    console.error('Stripe plan unavailable: price lookup failed', {
      plan,
      errorType: stripeError.type,
      statusCode: stripeError.statusCode,
      code: stripeError.code,
      requestId: stripeError.requestId,
    });
    return false;
  }
}

export function getAppUrl(requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === 'production' && !configured) throw new Error('NEXT_PUBLIC_APP_URL must be configured in production.');
  const candidate = configured || requestUrl;
  const url = new URL(candidate);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS in production.');
  }
  return url.origin;
}
