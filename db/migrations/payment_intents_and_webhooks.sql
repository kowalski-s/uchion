-- Migration: Add payment_intents and webhook_events tables for Prodamus integration
-- Created: 2026-01-17

-- Create payment_intent_status enum
DO $$ BEGIN
  CREATE TYPE "payment_intent_status" AS ENUM ('created', 'paid', 'failed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_intents table
CREATE TABLE IF NOT EXISTS "payment_intents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_code" varchar(100) NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'RUB' NOT NULL,
  "status" "payment_intent_status" DEFAULT 'created' NOT NULL,
  "provider" varchar(50) DEFAULT 'prodamus' NOT NULL,
  "provider_order_id" varchar(255) NOT NULL UNIQUE,
  "provider_payment_id" varchar(255),
  "metadata" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);

-- Create payment_intents indexes
CREATE INDEX IF NOT EXISTS "payment_intents_user_id_idx" ON "payment_intents" ("user_id");
CREATE INDEX IF NOT EXISTS "payment_intents_status_idx" ON "payment_intents" ("status");
CREATE INDEX IF NOT EXISTS "payment_intents_provider_order_id_idx" ON "payment_intents" ("provider_order_id");
CREATE INDEX IF NOT EXISTS "payment_intents_created_at_idx" ON "payment_intents" ("created_at");

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(50) NOT NULL,
  "event_key" varchar(255) NOT NULL,
  "raw_payload_hash" varchar(64) NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create webhook_events indexes
CREATE INDEX IF NOT EXISTS "webhook_events_provider_event_key_idx" ON "webhook_events" ("provider", "event_key");
CREATE INDEX IF NOT EXISTS "webhook_events_processed_at_idx" ON "webhook_events" ("processed_at");

-- Add unique constraint for idempotency check (prevents race conditions)
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_provider_event_key_unique" UNIQUE ("provider", "event_key");
