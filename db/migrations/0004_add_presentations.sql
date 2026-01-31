-- Create presentation enums
DO $$ BEGIN
  CREATE TYPE "presentation_theme_type" AS ENUM('preset', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "presentation_theme_preset" AS ENUM('professional', 'educational', 'minimal', 'scientific');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create presentations table
CREATE TABLE IF NOT EXISTS "presentations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(300) NOT NULL,
  "subject" "subject" NOT NULL,
  "grade" integer NOT NULL,
  "topic" varchar(500) NOT NULL,
  "theme_type" "presentation_theme_type" NOT NULL,
  "theme_preset" "presentation_theme_preset",
  "theme_custom" varchar(100),
  "slide_count" integer NOT NULL DEFAULT 10,
  "structure" text NOT NULL,
  "pptx_base64" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "presentations_user_id_idx" ON "presentations" ("user_id");
CREATE INDEX IF NOT EXISTS "presentations_subject_idx" ON "presentations" ("subject");
CREATE INDEX IF NOT EXISTS "presentations_created_at_idx" ON "presentations" ("created_at");
