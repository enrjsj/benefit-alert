CREATE TABLE correction_request (
 id bigserial PRIMARY KEY,
 user_id uuid NOT NULL,
 client_id uuid NOT NULL,
 benefit_id varchar(100) NOT NULL REFERENCES benefit(id),
 category varchar(20) NOT NULL CHECK(category IN ('deadline','eligibility','region','link','other')),
 message varchar(1000) NOT NULL CHECK(length(trim(message)) > 0),
 status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','resolved','rejected')),
 reply varchar(1000) NOT NULL DEFAULT '',
 revision bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,client_id)
);
CREATE INDEX correction_owner ON correction_request(user_id,id DESC);
CREATE INDEX correction_queue ON correction_request(status,id DESC);
ALTER TABLE correction_request ENABLE ROW LEVEL SECURITY;
-- Private backend schema: no browser/Data API grants; the backend owner accesses it.
CREATE TABLE correction_review (
 id bigserial PRIMARY KEY,
 request_id bigint NOT NULL REFERENCES correction_request(id),
 reviewer_id uuid NOT NULL,
 status varchar(20) NOT NULL,
 reply varchar(1000) NOT NULL,
 revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE correction_review ENABLE ROW LEVEL SECURITY;
