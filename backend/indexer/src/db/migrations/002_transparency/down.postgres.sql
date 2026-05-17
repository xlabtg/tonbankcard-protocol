-- Rollback for migration 002_transparency (PostgreSQL dialect)
-- Drops every object created by up.postgres.sql in reverse order.

DROP TABLE IF EXISTS transparency_parameter_changes;
DROP TABLE IF EXISTS transparency_lock_activity;
DROP TABLE IF EXISTS transparency_protocol_metrics;
