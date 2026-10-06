CREATE TABLE member_planning (
 user_id uuid PRIMARY KEY REFERENCES member_profile(user_id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 data jsonb NOT NULL DEFAULT '{"version":1,"compareIds":[],"checklists":{}}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Access is through the authenticated Spring API only, matching other member tables.
ALTER TABLE member_planning ENABLE ROW LEVEL SECURITY;
