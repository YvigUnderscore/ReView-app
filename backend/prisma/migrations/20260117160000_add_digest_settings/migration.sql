-- Add digest settings columns to Team
ALTER TABLE "Team" ADD COLUMN "digestFps" INTEGER;
ALTER TABLE "Team" ADD COLUMN "digestTransition" REAL;
ALTER TABLE "Team" ADD COLUMN "digestPause" REAL;

-- Seed default SystemSettings for digest video
INSERT INTO "SystemSetting" (key, value) VALUES 
  ('digest_fps_max', '24'),
  ('digest_fps_default', '18'),
  ('digest_transition_max', '3'),
  ('digest_transition_default', '1'),
  ('digest_pause_max', '10'),
  ('digest_pause_default', '2')
ON CONFLICT (key) DO NOTHING;
