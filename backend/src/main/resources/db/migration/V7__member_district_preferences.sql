-- Additive change: existing members retain province-wide preferences.
ALTER TABLE member_profile ADD COLUMN district varchar(50) NOT NULL DEFAULT '';
