-- Rollback for migration 002_transparency (SQLite dialect)
-- Drops every object created by up.sqlite.sql in reverse order. Indexes
-- attached to dropped tables are removed automatically.

DROP TABLE IF EXISTS transparency_parameter_changes;
DROP TABLE IF EXISTS transparency_lock_activity;
DROP TABLE IF EXISTS transparency_protocol_metrics;
