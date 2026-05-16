-- Comments (polymorphic)
CREATE TABLE comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'deliverable')),
  entity_id          UUID NOT NULL,
  author_profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body               TEXT NOT NULL,
  is_client_visible  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL,
  entity_type          TEXT,
  entity_id            UUID,
  title                TEXT NOT NULL,
  body                 TEXT NOT NULL,
  is_read              BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_profile_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Activity log
CREATE TABLE activity_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  action           TEXT NOT NULL,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
