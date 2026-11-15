-- One row per device per user. A user with a phone and an iPad has two.
CREATE TABLE IF NOT EXISTS push_tokens (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'ios',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_profile ON push_tokens(profile_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- A user may only ever touch their own device tokens. Deliberately no
-- executive override: one employee reading another's push tokens would let
-- them impersonate that device's notification stream.
DROP POLICY IF EXISTS push_tokens_select ON push_tokens;
CREATE POLICY push_tokens_select ON push_tokens
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_insert ON push_tokens;
CREATE POLICY push_tokens_insert ON push_tokens
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_update ON push_tokens;
CREATE POLICY push_tokens_update ON push_tokens
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS push_tokens_delete ON push_tokens;
CREATE POLICY push_tokens_delete ON push_tokens
  FOR DELETE USING (profile_id = auth.uid());

DROP TRIGGER IF EXISTS push_tokens_updated_at ON push_tokens;
CREATE TRIGGER push_tokens_updated_at BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE push_tokens IS
  'Expo push tokens, one row per device. Written by the app after sign-in, deleted on sign-out.';
