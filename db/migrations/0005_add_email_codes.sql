-- Add email_codes table for passwordless OTP authentication
CREATE TABLE IF NOT EXISTS "email_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "code" varchar(6) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_codes_email_idx" ON "email_codes" USING btree ("email");
CREATE INDEX IF NOT EXISTS "email_codes_expires_at_idx" ON "email_codes" USING btree ("expires_at");
