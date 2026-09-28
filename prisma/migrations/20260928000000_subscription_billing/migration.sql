ALTER TABLE "User"
ADD COLUMN "stripeCustomerId" TEXT;

CREATE UNIQUE INDEX "User_stripeCustomerId_key"
ON "User"("stripeCustomerId");

CREATE TABLE "BillingSubscription" (
  "id" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "currentPeriodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingSubscription_stripeSubscriptionId_key"
ON "BillingSubscription"("stripeSubscriptionId");
CREATE INDEX "BillingSubscription_userId_status_idx"
ON "BillingSubscription"("userId", "status");
CREATE INDEX "BillingSubscription_stripeCustomerId_idx"
ON "BillingSubscription"("stripeCustomerId");

ALTER TABLE "BillingSubscription"
ADD CONSTRAINT "BillingSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeWebhookEvent_type_processedAt_idx"
ON "StripeWebhookEvent"("type", "processedAt");
