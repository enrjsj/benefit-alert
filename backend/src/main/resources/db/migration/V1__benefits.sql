-- 공급기관 원본 식별자를 유일 키로 보관해 중복 적재를 방지합니다.
CREATE TABLE benefit (
 id varchar(100) PRIMARY KEY,
 title text NOT NULL,
 organization text NOT NULL,
 region varchar(100) NOT NULL,
 category varchar(50) NOT NULL,
 summary text NOT NULL,
 eligibility text NOT NULL,
 support text NOT NULL,
 application_method text NOT NULL,
 deadline date,
 period_label text NOT NULL,
 source_url text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_benefit_region ON benefit(region);
CREATE INDEX idx_benefit_deadline ON benefit(deadline);
