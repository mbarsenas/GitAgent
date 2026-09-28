import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getAppUrl, getStripe } from '@/lib/billing/stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { stripeCustomerId: true } });
    if (!account?.stripeCustomerId) return NextResponse.redirect(new URL('/billing?error=no_billing_account', request.url), 303);
    const portal = await getStripe().billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${getAppUrl(request.url)}/billing`,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHENTICATED') return NextResponse.redirect(new URL('/signin', request.url), 303);
    console.error('POST /api/billing/portal failed', error);
    return NextResponse.redirect(new URL('/billing?error=portal_unavailable', request.url), 303);
  }
}
