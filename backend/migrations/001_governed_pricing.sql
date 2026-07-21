BEGIN;

CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pricing_organizations(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pricing_memberships(tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),user_id INTEGER NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN('pricing_analyst','pricing_approver','channel_operator','auditor','admin')),active BOOLEAN NOT NULL DEFAULT TRUE,PRIMARY KEY(tenant_id,user_id));

CREATE TABLE IF NOT EXISTS pricing_snapshots(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),idempotency_key TEXT NOT NULL,snapshot_ref TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),sku TEXT NOT NULL,as_of TIMESTAMPTZ NOT NULL,currency CHAR(3) NOT NULL,snapshot JSONB NOT NULL,snapshot_digest CHAR(64) NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,idempotency_key),UNIQUE(tenant_id,snapshot_ref,version),UNIQUE(tenant_id,snapshot_digest)
);
CREATE TABLE IF NOT EXISTS pricing_source_evidence(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),snapshot_id BIGINT NOT NULL REFERENCES pricing_snapshots(id),source_type TEXT NOT NULL CHECK(source_type IN('transactions','inventory','promotions','costs','competitors','demand','customer_constraints')),source_system TEXT NOT NULL,source_version TEXT NOT NULL,source_digest CHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,snapshot_id,source_type)
);
CREATE TABLE IF NOT EXISTS pricing_recommendations(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),idempotency_key TEXT NOT NULL,snapshot_id BIGINT NOT NULL REFERENCES pricing_snapshots(id),sku TEXT NOT NULL,engine_status TEXT NOT NULL CHECK(engine_status IN('review_required','insufficient_data','constraint_conflict')),workflow_state TEXT NOT NULL CHECK(workflow_state IN('blocked','draft','review_pending','approved','scheduled','sync_pending','synced','monitoring','rollback_pending','rolled_back','completed','failed','rejected','cancelled')),revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),current_price_minor BIGINT NOT NULL CHECK(current_price_minor>0),recommended_price_minor BIGINT,currency CHAR(3) NOT NULL,effective_at TIMESTAMPTZ NOT NULL,recommendation JSONB NOT NULL,recommendation_digest CHAR(64) NOT NULL,created_by INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,idempotency_key),UNIQUE(tenant_id,recommendation_digest)
);
CREATE TABLE IF NOT EXISTS pricing_approvals(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),recommendation_id BIGINT NOT NULL REFERENCES pricing_recommendations(id),actor_id INTEGER NOT NULL REFERENCES users(id),decision TEXT NOT NULL CHECK(decision IN('approve','reject')),attestation_digest CHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,recommendation_id,actor_id)
);
CREATE TABLE IF NOT EXISTS pricing_channel_outbox(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),recommendation_id BIGINT NOT NULL REFERENCES pricing_recommendations(id),channel TEXT NOT NULL CHECK(channel IN('commerce','pos','erp','inventory','crm','market_data')),operation TEXT NOT NULL CHECK(operation IN('apply','rollback')),idempotency_key TEXT NOT NULL,payload JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','retry','delivered','dead_letter')),attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),external_version TEXT,evidence_digest CHAR(64),last_error_code TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS pricing_experiments(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),recommendation_id BIGINT NOT NULL REFERENCES pricing_recommendations(id),experiment_ref TEXT NOT NULL,experiment JSONB NOT NULL,experiment_digest CHAR(64) NOT NULL,status TEXT NOT NULL CHECK(status IN('planned','running','awaiting_outcomes','evaluated','cancelled')),created_by INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,experiment_ref),UNIQUE(tenant_id,experiment_digest)
);
CREATE TABLE IF NOT EXISTS pricing_experiment_evaluations(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),experiment_id BIGINT NOT NULL REFERENCES pricing_experiments(id),outcomes JSONB NOT NULL,evaluation JSONB NOT NULL,evaluation_digest CHAR(64) NOT NULL,evaluated_by INTEGER NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,experiment_id,evaluation_digest)
);
CREATE TABLE IF NOT EXISTS pricing_experiment_assignments(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),experiment_id BIGINT NOT NULL REFERENCES pricing_experiments(id),unit_digest CHAR(64) NOT NULL,bucket INTEGER NOT NULL CHECK(bucket>=0 AND bucket<10000),arm TEXT NOT NULL CHECK(arm IN('control','treatment')),assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(tenant_id,experiment_id,unit_digest)
);
CREATE TABLE IF NOT EXISTS pricing_integration_failures(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),recommendation_id BIGINT REFERENCES pricing_recommendations(id),provider TEXT NOT NULL,operation TEXT NOT NULL,retryable BOOLEAN NOT NULL,error_code TEXT NOT NULL,sanitized_detail TEXT,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS pricing_events(
 id BIGSERIAL PRIMARY KEY,tenant_id BIGINT NOT NULL REFERENCES pricing_organizations(id),recommendation_id BIGINT REFERENCES pricing_recommendations(id),actor_id INTEGER REFERENCES users(id),event_type TEXT NOT NULL,payload JSONB NOT NULL DEFAULT '{}'::jsonb,evidence_digest CHAR(64),occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pricing_snapshot_sku_idx ON pricing_snapshots(tenant_id,sku,as_of);
CREATE INDEX IF NOT EXISTS pricing_recommendation_state_idx ON pricing_recommendations(tenant_id,workflow_state,updated_at);
CREATE INDEX IF NOT EXISTS pricing_outbox_ready_idx ON pricing_channel_outbox(status,next_attempt_at);

CREATE OR REPLACE FUNCTION prevent_pricing_evidence_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'pricing evidence is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pricing_snapshots_append_only ON pricing_snapshots;CREATE TRIGGER pricing_snapshots_append_only BEFORE UPDATE OR DELETE ON pricing_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();
DROP TRIGGER IF EXISTS pricing_sources_append_only ON pricing_source_evidence;CREATE TRIGGER pricing_sources_append_only BEFORE UPDATE OR DELETE ON pricing_source_evidence FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();
DROP TRIGGER IF EXISTS pricing_approvals_append_only ON pricing_approvals;CREATE TRIGGER pricing_approvals_append_only BEFORE UPDATE OR DELETE ON pricing_approvals FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();
DROP TRIGGER IF EXISTS pricing_evaluations_append_only ON pricing_experiment_evaluations;CREATE TRIGGER pricing_evaluations_append_only BEFORE UPDATE OR DELETE ON pricing_experiment_evaluations FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();
DROP TRIGGER IF EXISTS pricing_assignments_append_only ON pricing_experiment_assignments;CREATE TRIGGER pricing_assignments_append_only BEFORE UPDATE OR DELETE ON pricing_experiment_assignments FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();
DROP TRIGGER IF EXISTS pricing_events_append_only ON pricing_events;CREATE TRIGGER pricing_events_append_only BEFORE UPDATE OR DELETE ON pricing_events FOR EACH ROW EXECUTE FUNCTION prevent_pricing_evidence_mutation();

CREATE OR REPLACE FUNCTION guard_pricing_recommendation_evidence() RETURNS trigger AS $$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.snapshot_id IS DISTINCT FROM OLD.snapshot_id OR NEW.sku IS DISTINCT FROM OLD.sku OR NEW.engine_status IS DISTINCT FROM OLD.engine_status OR NEW.current_price_minor IS DISTINCT FROM OLD.current_price_minor OR NEW.recommended_price_minor IS DISTINCT FROM OLD.recommended_price_minor OR NEW.currency IS DISTINCT FROM OLD.currency OR NEW.effective_at IS DISTINCT FROM OLD.effective_at OR NEW.recommendation IS DISTINCT FROM OLD.recommendation OR NEW.recommendation_digest IS DISTINCT FROM OLD.recommendation_digest OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'recommendation evidence cannot be rewritten'; END IF;
 RETURN NEW;
END;$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pricing_recommendation_evidence_guard ON pricing_recommendations;CREATE TRIGGER pricing_recommendation_evidence_guard BEFORE UPDATE ON pricing_recommendations FOR EACH ROW EXECUTE FUNCTION guard_pricing_recommendation_evidence();

CREATE OR REPLACE FUNCTION guard_pricing_experiment_evidence() RETURNS trigger AS $$ BEGIN IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.recommendation_id IS DISTINCT FROM OLD.recommendation_id OR NEW.experiment_ref IS DISTINCT FROM OLD.experiment_ref OR NEW.experiment IS DISTINCT FROM OLD.experiment OR NEW.experiment_digest IS DISTINCT FROM OLD.experiment_digest OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'experiment evidence cannot be rewritten'; END IF;RETURN NEW;END;$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pricing_experiment_evidence_guard ON pricing_experiments;CREATE TRIGGER pricing_experiment_evidence_guard BEFORE UPDATE ON pricing_experiments FOR EACH ROW EXECUTE FUNCTION guard_pricing_experiment_evidence();

COMMIT;
