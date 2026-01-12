-- Telegram Alerts Migration
-- Adds fields for admin alert subscriptions via Telegram

-- 1. Add telegram_chat_id column to users
-- Stores the Telegram chat ID for sending alerts
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);

-- 2. Add wants_alerts flag to users
-- Indicates whether the admin wants to receive alerts
ALTER TABLE users ADD COLUMN IF NOT EXISTS wants_alerts BOOLEAN NOT NULL DEFAULT false;
