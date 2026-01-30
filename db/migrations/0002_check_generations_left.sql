-- Prevent generations_left from going negative (defense-in-depth for race conditions)
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_generations_left_non_negative" CHECK ("generations_left" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
