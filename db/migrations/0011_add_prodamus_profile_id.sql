-- Migration: Add prodamus_profile_id to subscriptions table
-- Stores the Prodamus subscriber profile ID for subscription management

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "prodamus_profile_id" varchar(50);
