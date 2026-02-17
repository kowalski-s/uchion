-- Add startedAt and completedAt to generations table for lifecycle tracking
ALTER TABLE generations ADD COLUMN started_at timestamptz;
ALTER TABLE generations ADD COLUMN completed_at timestamptz;
