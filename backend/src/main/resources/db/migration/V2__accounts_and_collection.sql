-- All objects live in the application's configured benefit_alert schema.
ALTER TABLE benefit ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE benefit ADD COLUMN source_kind varchar(20) NOT NULL DEFAULT 'manual';
ALTER TABLE benefit ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE benefit ADD COLUMN last_seen_run uuid;
ALTER TABLE benefit ADD COLUMN source_payload jsonb;
CREATE INDEX idx_benefit_active_updated ON benefit(updated_at DESC, id) WHERE active;
CREATE INDEX idx_benefit_category ON benefit(category) WHERE active;

CREATE TABLE member_profile (
 user_id uuid PRIMARY KEY,
 region varchar(100) NOT NULL DEFAULT '전체',
 category varchar(50) NOT NULL DEFAULT '전체',
 notifications_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE member_saved (
 user_id uuid NOT NULL REFERENCES member_profile(user_id) ON DELETE CASCADE,
 benefit_id varchar(100) NOT NULL REFERENCES benefit(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,benefit_id)
);
CREATE TABLE member_notification (
 id bigserial PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES member_profile(user_id) ON DELETE CASCADE,
 benefit_id varchar(100) NOT NULL REFERENCES benefit(id) ON DELETE CASCADE,
 kind varchar(20) NOT NULL CHECK(kind IN ('new','closing')),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(user_id,benefit_id,kind)
);
CREATE INDEX idx_notification_user ON member_notification(user_id,created_at DESC);
-- Personal data is accessible only through the authenticated Spring API.
ALTER TABLE member_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_saved ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notification ENABLE ROW LEVEL SECURITY;

CREATE TABLE collection_run (
 id uuid PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status varchar(20) NOT NULL,
 fetched_count integer NOT NULL DEFAULT 0,
 rejected_count integer NOT NULL DEFAULT 0,
 error_code varchar(80)
);
CREATE TABLE collection_lock (
 id integer PRIMARY KEY CHECK(id=1),
 owner_id uuid,
 lease_until timestamptz NOT NULL DEFAULT now()
);
INSERT INTO collection_lock(id) VALUES(1);
