import { prisma } from '@/lib/db/prisma';

export type BillingPlan = 'free' | 'pro' | 'team';
export const REPOSITORY_LIMITS: Record<BillingPlan, number> = { free: 1, pro: 10, team: 50 };

export async function getBillingPlan(userId: string): Promise<BillingPlan> {
  const subscriptions = await prisma.billingSubscription.findMany({
    where: { userId, status: { in: ['active', 'trialing'] } },
    select: { plan: true },
  });
  if (subscriptions.some((subscription) => subscription.plan === 'team')) return 'team';
  if (subscriptions.some((subscription) => subscription.plan === 'pro')) return 'pro';
  return 'free';
}

export async function getBillingSummary(userId: string) {
  const [plan, subscriptions, repositoryCount] = await Promise.all([
    getBillingPlan(userId),
    prisma.billingSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { plan: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, stripeCustomerId: true },
    }),
    prisma.repository.count({ where: { userId, provider: 'github' } }),
  ]);
  const current = subscriptions.find((item) => item.status === 'active' || item.status === 'trialing') ?? subscriptions[0] ?? null;
  return { plan, repositoryLimit: REPOSITORY_LIMITS[plan], repositoryCount, subscription: current };
}

export async function assertRepositoryCapacity(userId: string, additionalRepositories: number) {
  if (additionalRepositories <= 0) return;
  const [plan, repositoryCount] = await Promise.all([
    getBillingPlan(userId),
    prisma.repository.count({ where: { userId, provider: 'github' } }),
  ]);
  if (repositoryCount + additionalRepositories > REPOSITORY_LIMITS[plan]) {
    throw new Error(`PLAN_REPOSITORY_LIMIT:${plan}:${REPOSITORY_LIMITS[plan]}`);
  }
}

export async function assertRepositoryEntitled(userId: string, repositoryId: string) {
  const plan = await getBillingPlan(userId);
  const repositories = await prisma.repository.findMany({
    where: { userId, provider: 'github' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const position = repositories.findIndex((repository) => repository.id === repositoryId);
  if (position >= REPOSITORY_LIMITS[plan]) throw new Error(`PLAN_REPOSITORY_LIMIT:${plan}:${REPOSITORY_LIMITS[plan]}`);
}
