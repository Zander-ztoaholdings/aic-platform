-- Event-Driven Integrity System (S1-03)
-- This enables real-time updates from the database to the application layer

-- 1. Create the Notification Function
CREATE OR REPLACE FUNCTION notify_audit_log_update()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload = jsonb_build_object(
        'id', NEW.id,
        'org_id', NEW.org_id,
        'status', NEW.status,
        'event_type', NEW.event_type,
        'system_name', NEW.system_name,
        'updated_at', NOW()
    );
    
    -- Channel name: audit_log_updates
    PERFORM pg_notify('audit_log_updates', payload::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach Trigger to audit_logs table
DROP TRIGGER IF EXISTS audit_log_update_trigger ON audit_logs;
CREATE TRIGGER audit_log_update_trigger
AFTER INSERT OR UPDATE OF status ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION notify_audit_log_update();

-- 3. Create Notification Function for Incidents
CREATE OR REPLACE FUNCTION notify_incident_update()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload = jsonb_build_object(
        'id', NEW.id,
        'org_id', NEW.org_id,
        'status', NEW.status,
        'citizen_email', NEW.citizen_email,
        'updated_at', NOW()
    );
    
    PERFORM pg_notify('incident_updates', payload::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach Trigger to incidents table
DROP TRIGGER IF EXISTS incident_update_trigger ON incidents;
CREATE TRIGGER incident_update_trigger
AFTER INSERT OR UPDATE OF status ON incidents
FOR EACH ROW
EXECUTE FUNCTION notify_incident_update();
