-- Migration: Add subscription v2 (recurring payments via Prodamus)
-- 1. Add subscriptionPlan varchar to users
-- 2. Redesign subscriptions table with new columns for Prodamus recurring billing

-- Step 1: Add subscriptionPlan to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_plan" varchar(20) NOT NULL DEFAULT 'free';

-- Step 2: Add new columns to subscriptions table
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "prodamus_subscription_id" varchar(50);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan_v2" varchar(20) NOT NULL DEFAULT 'free';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "status_v2" varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "generations_per_period" integer NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp with time zone;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp with time zone;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "customer_email" varchar(255);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "customer_phone" varchar(20);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;

-- Step 3: Migrate existing data from old columns to new
UPDATE "subscriptions" SET "plan_v2" = "plan"::text WHERE "plan" IS NOT NULL;
UPDATE "subscriptions" SET "status_v2" = CASE
  WHEN "status"::text = 'canceled' THEN 'cancelled'
  ELSE "status"::text
END WHERE "status" IS NOT NULL;
UPDATE "subscriptions" SET "current_period_end" = "expires_at" WHERE "expires_at" IS NOT NULL;

-- Step 4: Create indexes for new columns
CREATE INDEX IF NOT EXISTS "subscriptions_status_v2_idx" ON "subscriptions" ("status_v2");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_v2_idx" ON "subscriptions" ("plan_v2");
