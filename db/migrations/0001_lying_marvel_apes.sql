ALTER TABLE "users" ALTER COLUMN "generations_left" SET DEFAULT 5;--> statement-breakpoint
-- Add family_id with default for existing rows, then make NOT NULL
ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" varchar(255);--> statement-breakpoint
UPDATE "refresh_tokens" SET "family_id" = "jti" WHERE "family_id" IS NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");
