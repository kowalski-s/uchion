-- Add folder support to presentations
ALTER TABLE "presentations" ADD COLUMN "folder_id" uuid;
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "presentations_folder_id_idx" ON "presentations" ("folder_id");
