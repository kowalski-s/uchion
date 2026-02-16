-- AI Usage tracking table for cost analytics
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(36) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type VARCHAR(30) NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_kopecks INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  subject VARCHAR(20),
  grade INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_usage_session_id_idx ON ai_usage(session_id);
CREATE INDEX ai_usage_user_id_idx ON ai_usage(user_id);
CREATE INDEX ai_usage_created_at_idx ON ai_usage(created_at);
CREATE INDEX ai_usage_model_idx ON ai_usage(model);
