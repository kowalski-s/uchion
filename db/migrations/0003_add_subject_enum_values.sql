-- Add 'algebra' and 'geometry' to subject enum
ALTER TYPE "subject" ADD VALUE IF NOT EXISTS 'algebra' BEFORE 'russian';
ALTER TYPE "subject" ADD VALUE IF NOT EXISTS 'geometry' BEFORE 'russian';
