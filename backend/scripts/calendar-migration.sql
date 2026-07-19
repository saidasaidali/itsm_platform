-- Migration script for calendar module
-- This script can be run on an existing database without conflicts

-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_update_smart_assistant_metrics ON public.smart_assistant_logs;

-- Drop existing function
DROP FUNCTION IF EXISTS public.update_smart_assistant_metrics();

-- Recreate the function
CREATE OR REPLACE FUNCTION public.update_smart_assistant_metrics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
          INSERT INTO smart_assistant_metrics (
              metric_date, hour, total_messages, tickets_created,
              security_incidents_detected, avg_processing_time_ms,
              avg_confidence, avg_sentiment_score, critical_messages,
              assets_identified, ml_predictions_made, high_risk_assets,
              technicians_recommended, kb_articles_served
          )
          VALUES (
              DATE(NEW.created_at), EXTRACT(HOUR FROM NEW.created_at),
              1,
              CASE WHEN NEW.ticket_created_id IS NOT NULL THEN 1 ELSE 0 END,
              CASE WHEN NEW.is_security_incident THEN 1 ELSE 0 END,
              NEW.processing_time_ms, NEW.confidence, NEW.sentiment_score,
              CASE WHEN NEW.sentiment_is_critical THEN 1 ELSE 0 END,
              CASE WHEN NEW.asset_id IS NOT NULL THEN 1 ELSE 0 END,
              CASE WHEN NEW.ml_risk_score IS NOT NULL THEN 1 ELSE 0 END,
              CASE WHEN NEW.ml_risk_level IN ('élevé', 'critique') THEN 1 ELSE 0 END,
              CASE WHEN NEW.recommended_technician_id IS NOT NULL THEN 1 ELSE 0 END,
              0
          )
          ON CONFLICT (metric_date, hour) DO UPDATE SET
              total_messages = smart_assistant_metrics.total_messages + 1,
              tickets_created = smart_assistant_metrics.tickets_created + 
                               CASE WHEN NEW.ticket_created_id IS NOT NULL THEN 1 ELSE 0 END,
              security_incidents_detected = smart_assistant_metrics.security_incidents_detected + 
                                           CASE WHEN NEW.is_security_incident THEN 1 ELSE 0 END,
              avg_processing_time_ms = (smart_assistant_metrics.avg_processing_time_ms + NEW.processing_time_ms) / 2,
              avg_confidence = (smart_assistant_metrics.avg_confidence + NEW.confidence) / 2,
              avg_sentiment_score = (smart_assistant_metrics.avg_sentiment_score + NEW.sentiment_score) / 2,
              critical_messages = smart_assistant_metrics.critical_messages + 
                                 CASE WHEN NEW.sentiment_is_critical THEN 1 ELSE 0 END,
              assets_identified = smart_assistant_metrics.assets_identified + 
                                 CASE WHEN NEW.asset_id IS NOT NULL THEN 1 ELSE 0 END,
              ml_predictions_made = smart_assistant_metrics.ml_predictions_made + 
                                    CASE WHEN NEW.ml_risk_score IS NOT NULL THEN 1 ELSE 0 END,
              high_risk_assets = smart_assistant_metrics.high_risk_assets + 
                                CASE WHEN NEW.ml_risk_level IN ('élevé', 'critique') THEN 1 ELSE 0 END,
              technicians_recommended = smart_assistant_metrics.technicians_recommended + 
                                       CASE WHEN NEW.recommended_technician_id IS NOT NULL THEN 1 ELSE 0 END;
          
          RETURN NEW;
      END;
      $$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_smart_assistant_metrics 
    AFTER INSERT ON public.smart_assistant_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_smart_assistant_metrics();

-- Create calendar_events table if not exists
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    event_type character varying(50) DEFAULT 'autre'::character varying,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    all_day boolean DEFAULT false,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    color character varying(20),
    ticket_id integer,
    asset_id integer,
    assigned_to integer,
    created_by integer,
    department character varying(100),
    site character varying(100),
    location character varying(100),
    notes text,
    reminder_1w boolean DEFAULT false,
    reminder_1d boolean DEFAULT true,
    reminder_1h boolean DEFAULT true,
    reminder_start boolean DEFAULT false,
    is_recurring boolean DEFAULT false,
    recurrence_type character varying(20),
    recurrence_interval integer DEFAULT 1,
    recurrence_end_date date,
    recurrence_count integer,
    is_auto_generated boolean DEFAULT false,
    auto_source character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

-- Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Set default for id column
ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;
ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);

-- Add primary key if not exists (using DO block for conditional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_pkey' 
        AND conrelid = 'public.calendar_events'::regclass
    ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- Create calendar_event_participants table if not exists
CREATE TABLE IF NOT EXISTS public.calendar_event_participants (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(20) DEFAULT 'attendee'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    notified_at timestamp without time zone
);

-- Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS public.calendar_event_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Set default for id column
ALTER SEQUENCE public.calendar_event_participants_id_seq OWNED BY public.calendar_event_participants.id;
ALTER TABLE ONLY public.calendar_event_participants ALTER COLUMN id SET DEFAULT nextval('public.calendar_event_participants_id_seq'::regclass);

-- Add constraints if not exists (using DO block for conditional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_event_participants_pkey' 
        AND conrelid = 'public.calendar_event_participants'::regclass
    ) THEN
        ALTER TABLE public.calendar_event_participants ADD CONSTRAINT calendar_event_participants_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_event_participants_event_id_user_id_key' 
        AND conrelid = 'public.calendar_event_participants'::regclass
    ) THEN
        ALTER TABLE public.calendar_event_participants ADD CONSTRAINT calendar_event_participants_event_id_user_id_key UNIQUE (event_id, user_id);
    END IF;
END $$;

-- Add foreign keys if not exists (using DO block for conditional)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_assigned_to_fkey' 
        AND conrelid = 'public.calendar_events'::regclass
    ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_created_by_fkey' 
        AND conrelid = 'public.calendar_events'::regclass
    ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_ticket_id_fkey' 
        AND conrelid = 'public.calendar_events'::regclass
    ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_events_asset_id_fkey' 
        AND conrelid = 'public.calendar_events'::regclass
    ) THEN
        ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_event_participants_event_id_fkey' 
        AND conrelid = 'public.calendar_event_participants'::regclass
    ) THEN
        ALTER TABLE public.calendar_event_participants ADD CONSTRAINT calendar_event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'calendar_event_participants_user_id_fkey' 
        AND conrelid = 'public.calendar_event_participants'::regclass
    ) THEN
        ALTER TABLE public.calendar_event_participants ADD CONSTRAINT calendar_event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for calendar events
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON public.calendar_events USING btree (start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON public.calendar_events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON public.calendar_events USING btree (assigned_to);

-- Migration complete
SELECT 'Calendar migration completed successfully' as message;