-- Deliverables
CREATE TABLE deliverables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type          deliverable_type NOT NULL,
  title         TEXT NOT NULL,
  dropbox_url   TEXT NOT NULL,
  thumbnail_url TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  status        deliverable_status NOT NULL DEFAULT 'draft',
  submitted_by  UUID NOT NULL REFERENCES profiles(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER deliverables_updated_at BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;

-- Deliverable revisions (approval / revision requests)
CREATE TABLE deliverable_revisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id    UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  actor_profile_id  UUID NOT NULL REFERENCES profiles(id),
  action            revision_action NOT NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deliverable_revisions ENABLE ROW LEVEL SECURITY;

-- Auto-update deliverable status when a revision is inserted
CREATE OR REPLACE FUNCTION handle_deliverable_revision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE deliverables
  SET status = CASE NEW.action
    WHEN 'approve' THEN 'approved'::deliverable_status
    WHEN 'request_revision' THEN 'revision_requested'::deliverable_status
  END,
  updated_at = now()
  WHERE id = NEW.deliverable_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_revision_inserted
  AFTER INSERT ON deliverable_revisions
  FOR EACH ROW EXECUTE FUNCTION handle_deliverable_revision();
