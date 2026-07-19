--
-- PostgreSQL database dump
--

\restrict marFl4568r5KgO2AgtOTpWzlm4bfOzzlXiTRqr9uh9oH6y0TgZPKxPwUX65RMzP

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: update_calendar_events_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_calendar_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_smart_assistant_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_smart_assistant_metrics() RETURNS trigger
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: security_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_incidents (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    incident_type character varying(100) NOT NULL,
    severity character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying,
    affected_assets jsonb DEFAULT '[]'::jsonb,
    indicators jsonb DEFAULT '{}'::jsonb,
    actions_taken text,
    resolution_notes text,
    admins_notified boolean DEFAULT false,
    security_team_notified boolean DEFAULT false,
    detected_at timestamp without time zone DEFAULT now(),
    acknowledged_at timestamp without time zone,
    resolved_at timestamp without time zone,
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT security_incidents_severity_check CHECK (((severity)::text = ANY ((ARRAY['high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT security_incidents_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: TABLE security_incidents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.security_incidents IS 'Incidents de sécurité détectés par le Smart Assistant';


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    priority character varying(20) DEFAULT 'Normal'::character varying,
    status character varying(20) DEFAULT 'Nouveau'::character varying,
    created_by integer,
    assigned_to integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    due_date timestamp without time zone,
    resolved_at timestamp without time zone,
    asset_id integer,
    sla_notified boolean DEFAULT false,
    is_auto_generated boolean DEFAULT false,
    auto_trigger_type character varying(50),
    remote_session_id character varying(255),
    remote_session_tool character varying(50),
    remote_session_url text,
    remote_session_at timestamp without time zone,
    remote_session_by integer,
    sentiment character varying(20) DEFAULT 'neutre'::character varying,
    sentiment_score integer DEFAULT 0,
    sentiment_emotions jsonb DEFAULT '[]'::jsonb,
    sentiment_intensity integer DEFAULT 0,
    sentiment_is_critical boolean DEFAULT false,
    sentiment_analyzed_at timestamp without time zone,
    CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['Nouveau'::character varying, 'Assigné'::character varying, 'En cours'::character varying, 'En attente'::character varying, 'Résolu'::character varying, 'Clôturé'::character varying, 'Rouvert'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(255) NOT NULL,
    role_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    language character varying(5) DEFAULT 'fr'::character varying,
    date_format character varying(20) DEFAULT 'DD/MM/YYYY'::character varying,
    email_notifications boolean DEFAULT true,
    direction character varying(200),
    division character varying(200),
    service character varying(200),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: active_security_incidents; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_security_incidents AS
 SELECT si.id,
    si.ticket_id,
    t.title AS ticket_title,
    t.description AS ticket_description,
    t.priority AS ticket_priority,
    t.status AS ticket_status,
    si.incident_type,
    si.severity,
    si.status AS incident_status,
    si.affected_assets,
    si.actions_taken,
    si.detected_at,
    si.acknowledged_at,
    si.resolved_at,
    u.username AS created_by,
    u.email AS created_by_email
   FROM ((public.security_incidents si
     JOIN public.tickets t ON ((t.id = si.ticket_id)))
     LEFT JOIN public.users u ON ((u.id = t.created_by)))
  WHERE ((si.status)::text = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::text[]))
  ORDER BY
        CASE si.severity
            WHEN 'critical'::text THEN 1
            WHEN 'high'::text THEN 2
            ELSE NULL::integer
        END, si.detected_at DESC;


--
-- Name: VIEW active_security_incidents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.active_security_incidents IS 'Incidents de sécurité actifs nécessitant une attention';


--
-- Name: asset_anomalies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_anomalies (
    id integer NOT NULL,
    asset_id integer,
    anomaly_type character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    description text NOT NULL,
    details jsonb,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    detected_at timestamp without time zone DEFAULT now(),
    resolved_at timestamp without time zone,
    resolved_by integer
);


--
-- Name: asset_anomalies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_anomalies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_anomalies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_anomalies_id_seq OWNED BY public.asset_anomalies.id;


--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_assignments (
    id integer NOT NULL,
    asset_id integer,
    user_id integer,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unassigned_at timestamp without time zone
);


--
-- Name: asset_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_assignments_id_seq OWNED BY public.asset_assignments.id;


--
-- Name: asset_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_history (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    user_id integer,
    action_type character varying(50) DEFAULT 'modified'::character varying NOT NULL,
    action text NOT NULL,
    old_value text,
    new_value text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: asset_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_history_id_seq OWNED BY public.asset_history.id;


--
-- Name: asset_live_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_live_state (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    is_online boolean DEFAULT false,
    cpu_usage numeric(5,2),
    ram_usage numeric(5,2),
    ram_total_mb integer,
    disk_free_gb numeric(8,2),
    disk_total_gb numeric(8,2),
    uptime_hours numeric(10,2),
    logged_in_user character varying(100),
    last_checked_at timestamp without time zone DEFAULT now(),
    manufacturer character varying(100),
    model character varying(100),
    serial_number character varying(100),
    bios_manufacturer character varying(100),
    bios_version character varying(100),
    windows_version character varying(50),
    windows_build character varying(20),
    architecture character varying(10),
    cpu_count integer,
    cpu_frequency_mhz integer,
    ram_total_gb numeric(8,2),
    ip_address character varying(50),
    mac_address character varying(50),
    firewall_enabled boolean,
    defender_enabled boolean,
    defender_status character varying(50),
    disks_json jsonb,
    ram_free_mb integer
);


--
-- Name: asset_live_state_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_live_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_live_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_live_state_id_seq OWNED BY public.asset_live_state.id;


--
-- Name: asset_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_relations (
    id integer NOT NULL,
    source_asset_id integer NOT NULL,
    target_asset_id integer NOT NULL,
    relation_type character varying(50) NOT NULL,
    detected_at timestamp without time zone DEFAULT now(),
    confidence character varying(20) DEFAULT 'auto'::character varying
);


--
-- Name: asset_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_relations_id_seq OWNED BY public.asset_relations.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    asset_tag character varying(100) NOT NULL,
    type character varying(50),
    brand character varying(100),
    model character varying(100),
    serial_number character varying(100),
    status character varying(50) DEFAULT 'En service'::character varying,
    location character varying(150),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    numero_inventaire_unique character varying(100),
    numero_serie_fabricant character varying(100),
    adresse_ip character varying(50),
    adresse_mac character varying(50),
    date_acquisition date,
    date_fin_garantie date,
    department character varying(100),
    office character varying(100),
    purchase_date date,
    warranty_end date,
    assigned_at timestamp without time zone,
    assigned_to integer,
    updated_at timestamp without time zone DEFAULT now(),
    last_seen_at timestamp without time zone,
    discovery_method character varying(50),
    qr_token character varying(64) DEFAULT NULL::character varying,
    hostname character varying(100),
    service character varying(200),
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['En service'::character varying, 'En panne'::character varying, 'Hors service'::character varying, 'En stock'::character varying, 'En maintenance'::character varying, 'Retiré'::character varying])::text[])))
);


--
-- Name: asset_reliability; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.asset_reliability AS
 SELECT a.id AS asset_id,
    a.asset_tag,
    a.brand,
    a.model,
    a.status,
    a.created_at AS in_service_since,
    count(t.id) AS total_tickets,
    count(t.id) FILTER (WHERE (((t.category)::text = 'Matériel'::text) AND (t.created_at > (now() - '6 mons'::interval)))) AS pannes_6mois,
    count(t.id) FILTER (WHERE ((t.status)::text = ANY ((ARRAY['Résolu'::character varying, 'Clôturé'::character varying])::text[]))) AS tickets_resolus,
    round(((count(t.id))::numeric / NULLIF((EXTRACT(epoch FROM (now() - (a.created_at)::timestamp with time zone)) / (((30 * 24) * 3600))::numeric), (0)::numeric)), 2) AS pannes_par_mois,
    (EXTRACT(day FROM (now() - (a.created_at)::timestamp with time zone)))::integer AS jours_en_service
   FROM (public.assets a
     LEFT JOIN public.tickets t ON ((t.asset_id = a.id)))
  GROUP BY a.id, a.asset_tag, a.brand, a.model, a.status, a.created_at;


--
-- Name: asset_risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_risk_scores (
    asset_id integer NOT NULL,
    risk_score numeric(5,1) DEFAULT 0 NOT NULL,
    risk_level character varying(20) DEFAULT 'faible'::character varying NOT NULL,
    computed_at timestamp without time zone DEFAULT now()
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(255) NOT NULL,
    entity character varying(100),
    entity_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: auto_ticket_cooldown; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auto_ticket_cooldown (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    trigger_type character varying(50) NOT NULL,
    last_ticket_id integer,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: auto_ticket_cooldown_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auto_ticket_cooldown_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auto_ticket_cooldown_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auto_ticket_cooldown_id_seq OWNED BY public.auto_ticket_cooldown.id;


--
-- Name: calendar_event_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_event_participants (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(50) DEFAULT 'attendee'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    notified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE calendar_event_participants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.calendar_event_participants IS 'Participants aux événements';


--
-- Name: calendar_event_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_event_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_event_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_event_participants_id_seq OWNED BY public.calendar_event_participants.id;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    event_type character varying(50) DEFAULT 'autre'::character varying NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    all_day boolean DEFAULT false,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    color character varying(7),
    ticket_id integer,
    asset_id integer,
    assigned_to integer,
    created_by integer NOT NULL,
    department character varying(100),
    site character varying(150),
    reminder_1h boolean DEFAULT true,
    reminder_1d boolean DEFAULT true,
    reminder_start boolean DEFAULT false,
    is_recurring boolean DEFAULT false,
    recurrence_pattern jsonb,
    location character varying(255),
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT calendar_events_end_after_start CHECK ((end_date >= start_date))
);


--
-- Name: TABLE calendar_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.calendar_events IS 'Événements du calendrier ITSM';


--
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- Name: calendar_maintenance_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_maintenance_config (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    maintenance_type character varying(20) NOT NULL,
    interval_months integer DEFAULT 1,
    start_date timestamp without time zone,
    next_due timestamp without time zone DEFAULT now() NOT NULL,
    last_generated timestamp without time zone,
    notes text,
    assigned_to integer,
    enabled boolean DEFAULT true,
    auto_generated boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: calendar_maintenance_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_maintenance_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_maintenance_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_maintenance_config_id_seq OWNED BY public.calendar_maintenance_config.id;


--
-- Name: calendar_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_notifications (
    id integer NOT NULL,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    notification_type character varying(20) NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    channel character varying(20) DEFAULT 'in_app'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE calendar_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.calendar_notifications IS 'Notifications et rappels pour les événements';


--
-- Name: calendar_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calendar_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calendar_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calendar_notifications_id_seq OWNED BY public.calendar_notifications.id;


--
-- Name: calendar_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.calendar_stats AS
 SELECT (date_trunc('month'::text, calendar_events.start_date))::date AS month,
    calendar_events.event_type,
    calendar_events.status,
    count(*) AS count
   FROM public.calendar_events
  GROUP BY ((date_trunc('month'::text, calendar_events.start_date))::date), calendar_events.event_type, calendar_events.status
  ORDER BY ((date_trunc('month'::text, calendar_events.start_date))::date) DESC, calendar_events.event_type;


--
-- Name: calendar_upcoming_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.calendar_upcoming_events AS
SELECT
    NULL::integer AS id,
    NULL::character varying(255) AS title,
    NULL::text AS description,
    NULL::character varying(50) AS event_type,
    NULL::timestamp without time zone AS start_date,
    NULL::timestamp without time zone AS end_date,
    NULL::boolean AS all_day,
    NULL::character varying(20) AS status,
    NULL::character varying(7) AS color,
    NULL::integer AS ticket_id,
    NULL::integer AS asset_id,
    NULL::integer AS assigned_to,
    NULL::integer AS created_by,
    NULL::character varying(100) AS department,
    NULL::character varying(150) AS site,
    NULL::boolean AS reminder_1h,
    NULL::boolean AS reminder_1d,
    NULL::boolean AS reminder_start,
    NULL::boolean AS is_recurring,
    NULL::jsonb AS recurrence_pattern,
    NULL::character varying(255) AS location,
    NULL::text AS notes,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS updated_at,
    NULL::character varying(100) AS created_by_name,
    NULL::character varying(150) AS created_by_email,
    NULL::character varying(255) AS ticket_title,
    NULL::character varying(20) AS ticket_status,
    NULL::character varying(100) AS asset_tag,
    NULL::character varying(50) AS asset_type,
    NULL::bigint AS participants_count;


--
-- Name: chatbot_learned_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_learned_cases (
    id integer NOT NULL,
    problem_keywords text[] NOT NULL,
    problem_summary text NOT NULL,
    solution_text text NOT NULL,
    source_type character varying(20) DEFAULT 'ticket'::character varying,
    source_id integer,
    hit_count integer DEFAULT 0,
    confidence_score numeric(4,3) DEFAULT 1.0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: chatbot_learned_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chatbot_learned_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chatbot_learned_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chatbot_learned_cases_id_seq OWNED BY public.chatbot_learned_cases.id;


--
-- Name: chatbot_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_logs (
    id integer NOT NULL,
    user_id integer,
    user_message text,
    bot_response text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    session_key character varying(64),
    intent character varying(50),
    confidence numeric(4,3),
    ticket_id integer,
    case_id integer,
    query text,
    response text
);


--
-- Name: chatbot_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chatbot_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chatbot_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chatbot_logs_id_seq OWNED BY public.chatbot_logs.id;


--
-- Name: chatbot_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_messages (
    id integer NOT NULL,
    session_id integer,
    role character varying(10) NOT NULL,
    content text NOT NULL,
    intent character varying(50),
    confidence numeric(4,3),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chatbot_messages_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'bot'::character varying])::text[])))
);


--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chatbot_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chatbot_messages_id_seq OWNED BY public.chatbot_messages.id;


--
-- Name: chatbot_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatbot_sessions (
    id integer NOT NULL,
    user_id integer,
    session_key character varying(64) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_active timestamp without time zone DEFAULT now()
);


--
-- Name: chatbot_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chatbot_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chatbot_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chatbot_sessions_id_seq OWNED BY public.chatbot_sessions.id;


--
-- Name: chatbot_top_cases; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.chatbot_top_cases AS
 SELECT lc.id,
    lc.problem_summary,
    lc.solution_text,
    lc.source_type,
    lc.hit_count,
    lc.confidence_score,
    lc.created_at
   FROM public.chatbot_learned_cases lc
  ORDER BY lc.hit_count DESC, lc.confidence_score DESC;


--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_articles (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    summary text NOT NULL,
    content text NOT NULL,
    category character varying(100) DEFAULT 'Général'::character varying,
    author_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    keywords text[],
    views_count integer DEFAULT 0,
    is_published boolean DEFAULT true
);


--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_articles_id_seq OWNED BY public.knowledge_articles.id;


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    category character varying(100),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_base_id_seq OWNED BY public.knowledge_base.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email_ticket_created boolean DEFAULT true,
    email_status_change boolean DEFAULT true,
    email_assigned boolean DEFAULT true,
    email_comment boolean DEFAULT true,
    email_sla_breach boolean DEFAULT true,
    email_closed boolean DEFAULT true,
    web_notifications boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title character varying(255),
    ticket_id integer,
    asset_id integer
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id integer NOT NULL,
    report_type character varying(20) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    generated_by integer,
    generated_at timestamp without time zone DEFAULT now(),
    file_path character varying(500),
    status character varying(20) DEFAULT 'generating'::character varying,
    error_message text,
    CONSTRAINT reports_report_type_check CHECK (((report_type)::text = ANY ((ARRAY['monthly'::character varying, 'weekly'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT reports_status_check CHECK (((status)::text = ANY ((ARRAY['generating'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: TABLE reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reports IS 'Stores generated AI reports metadata';


--
-- Name: COLUMN reports.report_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.report_type IS 'Type of report: monthly, weekly, or custom';


--
-- Name: COLUMN reports.file_path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.file_path IS 'Path to the generated PDF file';


--
-- Name: COLUMN reports.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.status IS 'Generation status: generating, completed, or failed';


--
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: scan_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scan_history (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    scanned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: scan_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scan_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scan_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scan_history_id_seq OWNED BY public.scan_history.id;


--
-- Name: security_incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_incidents_id_seq OWNED BY public.security_incidents.id;


--
-- Name: settings_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings_history (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    old_value text,
    new_value text,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE settings_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.settings_history IS 'Historique des modifications de configuration';


--
-- Name: COLUMN settings_history.setting_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings_history.setting_key IS 'Nom du paramètre modifié';


--
-- Name: COLUMN settings_history.old_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings_history.old_value IS 'Ancienne valeur';


--
-- Name: COLUMN settings_history.new_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings_history.new_value IS 'Nouvelle valeur';


--
-- Name: COLUMN settings_history.changed_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings_history.changed_by IS 'ID de l''utilisateur ayant effectué la modification';


--
-- Name: COLUMN settings_history.changed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.settings_history.changed_at IS 'Date et heure de la modification';


--
-- Name: settings_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_history_id_seq OWNED BY public.settings_history.id;


--
-- Name: smart_assistant_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_assistant_logs (
    id integer NOT NULL,
    user_id integer,
    session_key character varying(64) NOT NULL,
    user_message text NOT NULL,
    intent character varying(50),
    confidence numeric(4,3),
    sentiment character varying(20),
    sentiment_score integer,
    sentiment_emotions jsonb DEFAULT '[]'::jsonb,
    sentiment_intensity integer,
    sentiment_is_critical boolean DEFAULT false,
    entities jsonb DEFAULT '{}'::jsonb,
    asset_id integer,
    asset_confidence numeric(4,3),
    asset_identification_method character varying(50),
    ticket_category character varying(100),
    ticket_priority character varying(20),
    ticket_classification_confidence numeric(4,3),
    ml_risk_score numeric(5,1),
    ml_risk_level character varying(20),
    recommended_technician_id integer,
    technician_score numeric(5,1),
    is_security_incident boolean DEFAULT false,
    security_incident_type character varying(100),
    security_incident_severity character varying(20),
    ticket_created_id integer,
    processing_time_ms integer,
    bot_response text,
    sources jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE smart_assistant_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.smart_assistant_logs IS 'Logs complets des analyses du Smart IT Assistant';


--
-- Name: smart_assistant_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smart_assistant_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smart_assistant_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smart_assistant_logs_id_seq OWNED BY public.smart_assistant_logs.id;


--
-- Name: smart_assistant_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_assistant_metrics (
    id integer NOT NULL,
    metric_date date DEFAULT CURRENT_DATE NOT NULL,
    hour integer NOT NULL,
    total_messages integer DEFAULT 0,
    tickets_created integer DEFAULT 0,
    security_incidents_detected integer DEFAULT 0,
    avg_processing_time_ms integer,
    avg_confidence numeric(4,3),
    category_breakdown jsonb DEFAULT '{}'::jsonb,
    avg_sentiment_score integer,
    critical_messages integer DEFAULT 0,
    assets_identified integer DEFAULT 0,
    ml_predictions_made integer DEFAULT 0,
    high_risk_assets integer DEFAULT 0,
    technicians_recommended integer DEFAULT 0,
    kb_articles_served integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT smart_assistant_metrics_hour_check CHECK (((hour >= 0) AND (hour <= 23)))
);


--
-- Name: TABLE smart_assistant_metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.smart_assistant_metrics IS 'Métriques de performance du Smart Assistant (agrégées par heure)';


--
-- Name: smart_assistant_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.smart_assistant_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: smart_assistant_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.smart_assistant_metrics_id_seq OWNED BY public.smart_assistant_metrics.id;


--
-- Name: smart_assistant_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.smart_assistant_stats AS
 SELECT date(smart_assistant_logs.created_at) AS date,
    count(*) AS total_messages,
    count(DISTINCT smart_assistant_logs.user_id) AS unique_users,
    count(DISTINCT smart_assistant_logs.session_key) AS sessions,
    count(smart_assistant_logs.ticket_created_id) AS tickets_created,
    count(DISTINCT smart_assistant_logs.ticket_created_id) AS unique_tickets,
    count(
        CASE
            WHEN smart_assistant_logs.is_security_incident THEN 1
            ELSE NULL::integer
        END) AS security_incidents,
    count(
        CASE
            WHEN ((smart_assistant_logs.security_incident_severity)::text = 'critical'::text) THEN 1
            ELSE NULL::integer
        END) AS critical_security_incidents,
    avg(smart_assistant_logs.sentiment_score) AS avg_sentiment_score,
    count(
        CASE
            WHEN smart_assistant_logs.sentiment_is_critical THEN 1
            ELSE NULL::integer
        END) AS critical_sentiments,
    count(
        CASE
            WHEN (smart_assistant_logs.asset_id IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS assets_identified,
    count(
        CASE
            WHEN (smart_assistant_logs.ml_risk_score IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS ml_predictions,
    count(
        CASE
            WHEN (((smart_assistant_logs.ml_risk_level)::text = 'élevé'::text) OR ((smart_assistant_logs.ml_risk_level)::text = 'critique'::text)) THEN 1
            ELSE NULL::integer
        END) AS high_risk_detections,
    count(
        CASE
            WHEN (smart_assistant_logs.recommended_technician_id IS NOT NULL) THEN 1
            ELSE NULL::integer
        END) AS technician_recommendations,
    avg(smart_assistant_logs.processing_time_ms) AS avg_processing_time_ms,
    max(smart_assistant_logs.processing_time_ms) AS max_processing_time_ms,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'ticket_create'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_ticket_create,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'kb_search'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_kb_search,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'asset_locate'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_asset_locate,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'asset_status'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_asset_status,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'security_incident'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_security_incident,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'greeting'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_greeting,
    count(
        CASE
            WHEN ((smart_assistant_logs.intent)::text = 'general'::text) THEN 1
            ELSE NULL::integer
        END) AS intent_general
   FROM public.smart_assistant_logs
  GROUP BY (date(smart_assistant_logs.created_at))
  ORDER BY (date(smart_assistant_logs.created_at)) DESC;


--
-- Name: VIEW smart_assistant_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.smart_assistant_stats IS 'Statistiques quotidiennes du Smart Assistant';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id integer NOT NULL,
    ticket_id integer,
    user_id integer,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_internal boolean DEFAULT false,
    sentiment character varying(20) DEFAULT 'neutre'::character varying,
    sentiment_score integer DEFAULT 0,
    sentiment_emotions jsonb DEFAULT '[]'::jsonb,
    sentiment_intensity integer DEFAULT 0,
    sentiment_is_critical boolean DEFAULT false
);


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_comments_id_seq OWNED BY public.ticket_comments.id;


--
-- Name: ticket_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_history (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    user_id integer NOT NULL,
    action character varying(100) NOT NULL,
    old_value text,
    new_value text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ticket_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_history_id_seq OWNED BY public.ticket_history.id;


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: unknown_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unknown_devices (
    id integer NOT NULL,
    ip_address character varying(45),
    mac_address character varying(50),
    hostname character varying(255),
    first_seen timestamp without time zone DEFAULT now(),
    last_seen timestamp without time zone DEFAULT now(),
    seen_count integer DEFAULT 1,
    status character varying(20) DEFAULT 'unresolved'::character varying
);


--
-- Name: unknown_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.unknown_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unknown_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.unknown_devices_id_seq OWNED BY public.unknown_devices.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: asset_anomalies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_anomalies ALTER COLUMN id SET DEFAULT nextval('public.asset_anomalies_id_seq'::regclass);


--
-- Name: asset_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments ALTER COLUMN id SET DEFAULT nextval('public.asset_assignments_id_seq'::regclass);


--
-- Name: asset_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history ALTER COLUMN id SET DEFAULT nextval('public.asset_history_id_seq'::regclass);


--
-- Name: asset_live_state id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_live_state ALTER COLUMN id SET DEFAULT nextval('public.asset_live_state_id_seq'::regclass);


--
-- Name: asset_relations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations ALTER COLUMN id SET DEFAULT nextval('public.asset_relations_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: auto_ticket_cooldown id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_ticket_cooldown ALTER COLUMN id SET DEFAULT nextval('public.auto_ticket_cooldown_id_seq'::regclass);


--
-- Name: calendar_event_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants ALTER COLUMN id SET DEFAULT nextval('public.calendar_event_participants_id_seq'::regclass);


--
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- Name: calendar_maintenance_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_maintenance_config ALTER COLUMN id SET DEFAULT nextval('public.calendar_maintenance_config_id_seq'::regclass);


--
-- Name: calendar_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications ALTER COLUMN id SET DEFAULT nextval('public.calendar_notifications_id_seq'::regclass);


--
-- Name: chatbot_learned_cases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_learned_cases ALTER COLUMN id SET DEFAULT nextval('public.chatbot_learned_cases_id_seq'::regclass);


--
-- Name: chatbot_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_logs ALTER COLUMN id SET DEFAULT nextval('public.chatbot_logs_id_seq'::regclass);


--
-- Name: chatbot_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_messages ALTER COLUMN id SET DEFAULT nextval('public.chatbot_messages_id_seq'::regclass);


--
-- Name: chatbot_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_sessions ALTER COLUMN id SET DEFAULT nextval('public.chatbot_sessions_id_seq'::regclass);


--
-- Name: knowledge_articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles ALTER COLUMN id SET DEFAULT nextval('public.knowledge_articles_id_seq'::regclass);


--
-- Name: knowledge_base id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base ALTER COLUMN id SET DEFAULT nextval('public.knowledge_base_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: scan_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_history ALTER COLUMN id SET DEFAULT nextval('public.scan_history_id_seq'::regclass);


--
-- Name: security_incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents ALTER COLUMN id SET DEFAULT nextval('public.security_incidents_id_seq'::regclass);


--
-- Name: settings_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_history ALTER COLUMN id SET DEFAULT nextval('public.settings_history_id_seq'::regclass);


--
-- Name: smart_assistant_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs ALTER COLUMN id SET DEFAULT nextval('public.smart_assistant_logs_id_seq'::regclass);


--
-- Name: smart_assistant_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_metrics ALTER COLUMN id SET DEFAULT nextval('public.smart_assistant_metrics_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: ticket_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments ALTER COLUMN id SET DEFAULT nextval('public.ticket_comments_id_seq'::regclass);


--
-- Name: ticket_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history ALTER COLUMN id SET DEFAULT nextval('public.ticket_history_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: unknown_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unknown_devices ALTER COLUMN id SET DEFAULT nextval('public.unknown_devices_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: asset_anomalies asset_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_pkey PRIMARY KEY (id);


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_history asset_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_pkey PRIMARY KEY (id);


--
-- Name: asset_live_state asset_live_state_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_asset_id_key UNIQUE (asset_id);


--
-- Name: asset_live_state asset_live_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_pkey PRIMARY KEY (id);


--
-- Name: asset_relations asset_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_pkey PRIMARY KEY (id);


--
-- Name: asset_relations asset_relations_source_asset_id_target_asset_id_relation_ty_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_source_asset_id_target_asset_id_relation_ty_key UNIQUE (source_asset_id, target_asset_id, relation_type);


--
-- Name: asset_relations asset_relations_source_target_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_source_target_type_key UNIQUE (source_asset_id, target_asset_id, relation_type);


--
-- Name: asset_risk_scores asset_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_risk_scores
    ADD CONSTRAINT asset_risk_scores_pkey PRIMARY KEY (asset_id);


--
-- Name: assets assets_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);


--
-- Name: assets assets_numero_inventaire_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_numero_inventaire_unique_key UNIQUE (numero_inventaire_unique);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_qr_token_key UNIQUE (qr_token);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_asset_id_trigger_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_asset_id_trigger_type_key UNIQUE (asset_id, trigger_type);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_participants calendar_event_participants_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: calendar_event_participants calendar_event_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: calendar_maintenance_config calendar_maintenance_config_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_maintenance_config
    ADD CONSTRAINT calendar_maintenance_config_asset_id_key UNIQUE (asset_id);


--
-- Name: calendar_maintenance_config calendar_maintenance_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_maintenance_config
    ADD CONSTRAINT calendar_maintenance_config_pkey PRIMARY KEY (id);


--
-- Name: calendar_notifications calendar_notifications_event_id_user_id_notification_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_event_id_user_id_notification_type_key UNIQUE (event_id, user_id, notification_type);


--
-- Name: calendar_notifications calendar_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_pkey PRIMARY KEY (id);


--
-- Name: chatbot_learned_cases chatbot_learned_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_learned_cases
    ADD CONSTRAINT chatbot_learned_cases_pkey PRIMARY KEY (id);


--
-- Name: chatbot_logs chatbot_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_pkey PRIMARY KEY (id);


--
-- Name: chatbot_messages chatbot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_pkey PRIMARY KEY (id);


--
-- Name: chatbot_sessions chatbot_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_pkey PRIMARY KEY (id);


--
-- Name: chatbot_sessions chatbot_sessions_session_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_session_key_key UNIQUE (session_key);


--
-- Name: knowledge_articles knowledge_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scan_history scan_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_pkey PRIMARY KEY (id);


--
-- Name: security_incidents security_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_pkey PRIMARY KEY (id);


--
-- Name: settings_history settings_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_history
    ADD CONSTRAINT settings_history_pkey PRIMARY KEY (id);


--
-- Name: smart_assistant_logs smart_assistant_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs
    ADD CONSTRAINT smart_assistant_logs_pkey PRIMARY KEY (id);


--
-- Name: smart_assistant_metrics smart_assistant_metrics_metric_date_hour_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_metrics
    ADD CONSTRAINT smart_assistant_metrics_metric_date_hour_key UNIQUE (metric_date, hour);


--
-- Name: smart_assistant_metrics smart_assistant_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_metrics
    ADD CONSTRAINT smart_assistant_metrics_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_history ticket_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: unknown_devices unknown_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unknown_devices
    ADD CONSTRAINT unknown_devices_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_anomalies_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomalies_asset ON public.asset_anomalies USING btree (asset_id);


--
-- Name: idx_anomalies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomalies_status ON public.asset_anomalies USING btree (status);


--
-- Name: idx_anomalies_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_anomalies_type ON public.asset_anomalies USING btree (anomaly_type);


--
-- Name: idx_asset_history_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_history_asset ON public.asset_history USING btree (asset_id);


--
-- Name: idx_assets_hostname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_hostname ON public.assets USING btree (hostname);


--
-- Name: idx_assets_mac_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assets_mac_unique ON public.assets USING btree (adresse_mac) WHERE ((adresse_mac IS NOT NULL) AND ((adresse_mac)::text <> ''::text));


--
-- Name: idx_assets_qr_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_qr_token ON public.assets USING btree (qr_token);


--
-- Name: idx_assets_serial_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_assets_serial_unique ON public.assets USING btree (serial_number) WHERE ((serial_number IS NOT NULL) AND ((serial_number)::text <> ''::text));


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_warranty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_warranty ON public.assets USING btree (warranty_end);


--
-- Name: idx_calendar_events_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_asset ON public.calendar_events USING btree (asset_id) WHERE (asset_id IS NOT NULL);


--
-- Name: idx_calendar_events_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_assigned ON public.calendar_events USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);


--
-- Name: idx_calendar_events_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_assigned_to ON public.calendar_events USING btree (assigned_to);


--
-- Name: idx_calendar_events_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_composite ON public.calendar_events USING btree (start_date, status, event_type) WHERE ((status)::text <> ALL ((ARRAY['cancelled'::character varying, 'completed'::character varying])::text[]));


--
-- Name: idx_calendar_events_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_created_by ON public.calendar_events USING btree (created_by);


--
-- Name: idx_calendar_events_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_dates ON public.calendar_events USING btree (start_date, end_date);


--
-- Name: idx_calendar_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_event_type ON public.calendar_events USING btree (event_type);


--
-- Name: idx_calendar_events_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_start_date ON public.calendar_events USING btree (start_date);


--
-- Name: idx_calendar_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_status ON public.calendar_events USING btree (status);


--
-- Name: idx_calendar_events_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_ticket ON public.calendar_events USING btree (ticket_id) WHERE (ticket_id IS NOT NULL);


--
-- Name: idx_calendar_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_events_type ON public.calendar_events USING btree (event_type);


--
-- Name: idx_calendar_notifications_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_notifications_event ON public.calendar_notifications USING btree (event_id, notification_type);


--
-- Name: idx_calendar_notifications_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_notifications_scheduled ON public.calendar_notifications USING btree (scheduled_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_calendar_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_notifications_user ON public.calendar_notifications USING btree (user_id);


--
-- Name: idx_calendar_participants_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_participants_event ON public.calendar_event_participants USING btree (event_id);


--
-- Name: idx_calendar_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calendar_participants_user ON public.calendar_event_participants USING btree (user_id);


--
-- Name: idx_chatbot_messages_sess; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_messages_sess ON public.chatbot_messages USING btree (session_id);


--
-- Name: idx_chatbot_sessions_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_sessions_key ON public.chatbot_sessions USING btree (session_key);


--
-- Name: idx_chatbot_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chatbot_sessions_user ON public.chatbot_sessions USING btree (user_id);


--
-- Name: idx_knowledge_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_category ON public.knowledge_articles USING btree (category);


--
-- Name: idx_knowledge_keywords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_keywords ON public.knowledge_articles USING gin (keywords);


--
-- Name: idx_knowledge_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_search ON public.knowledge_articles USING gin (to_tsvector('french'::regconfig, (((((title)::text || ' '::text) || summary) || ' '::text) || content)));


--
-- Name: idx_learned_cases_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_cases_fts ON public.chatbot_learned_cases USING gin (to_tsvector('french'::regconfig, ((problem_summary || ' '::text) || solution_text)));


--
-- Name: idx_learned_cases_keywords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learned_cases_keywords ON public.chatbot_learned_cases USING gin (problem_keywords);


--
-- Name: idx_live_state_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_state_asset ON public.asset_live_state USING btree (asset_id);


--
-- Name: idx_maint_config_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maint_config_asset ON public.calendar_maintenance_config USING btree (asset_id);


--
-- Name: idx_maint_config_next_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maint_config_next_due ON public.calendar_maintenance_config USING btree (next_due) WHERE (enabled = true);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_relations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_source ON public.asset_relations USING btree (source_asset_id);


--
-- Name: idx_relations_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relations_target ON public.asset_relations USING btree (target_asset_id);


--
-- Name: idx_reports_generated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_generated_at ON public.reports USING btree (generated_at DESC);


--
-- Name: idx_reports_generated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_generated_by ON public.reports USING btree (generated_by);


--
-- Name: idx_reports_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_type ON public.reports USING btree (report_type);


--
-- Name: idx_scan_history_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scan_history_asset_id ON public.scan_history USING btree (asset_id);


--
-- Name: idx_scan_history_scanned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scan_history_scanned_at ON public.scan_history USING btree (scanned_at);


--
-- Name: idx_security_incidents_detected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_detected ON public.security_incidents USING btree (detected_at DESC);


--
-- Name: idx_security_incidents_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_severity ON public.security_incidents USING btree (severity);


--
-- Name: idx_security_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_status ON public.security_incidents USING btree (status);


--
-- Name: idx_security_incidents_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_security_incidents_ticket ON public.security_incidents USING btree (ticket_id);


--
-- Name: idx_settings_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_history_changed_at ON public.settings_history USING btree (changed_at DESC);


--
-- Name: idx_settings_history_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_history_changed_by ON public.settings_history USING btree (changed_by);


--
-- Name: idx_settings_history_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settings_history_key ON public.settings_history USING btree (setting_key);


--
-- Name: idx_smart_assistant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_created_at ON public.smart_assistant_logs USING btree (created_at DESC);


--
-- Name: idx_smart_assistant_metrics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_metrics_date ON public.smart_assistant_metrics USING btree (metric_date DESC);


--
-- Name: idx_smart_assistant_security; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_security ON public.smart_assistant_logs USING btree (is_security_incident) WHERE (is_security_incident = true);


--
-- Name: idx_smart_assistant_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_session ON public.smart_assistant_logs USING btree (session_key);


--
-- Name: idx_smart_assistant_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_ticket ON public.smart_assistant_logs USING btree (ticket_created_id);


--
-- Name: idx_smart_assistant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_assistant_user ON public.smart_assistant_logs USING btree (user_id);


--
-- Name: idx_ticket_comments_internal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_internal ON public.ticket_comments USING btree (is_internal);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id);


--
-- Name: idx_ticket_history_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_history_ticket ON public.ticket_history USING btree (ticket_id);


--
-- Name: idx_tickets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_asset ON public.tickets USING btree (asset_id);


--
-- Name: idx_tickets_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assigned_to ON public.tickets USING btree (assigned_to);


--
-- Name: idx_tickets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_created_by ON public.tickets USING btree (created_by);


--
-- Name: idx_tickets_sentiment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sentiment ON public.tickets USING btree (sentiment, sentiment_score);


--
-- Name: idx_tickets_sentiment_critical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sentiment_critical ON public.tickets USING btree (sentiment_is_critical) WHERE (sentiment_is_critical = true);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_unknown_devices_mac; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unknown_devices_mac ON public.unknown_devices USING btree (mac_address) WHERE (mac_address IS NOT NULL);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: calendar_upcoming_events _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.calendar_upcoming_events AS
 SELECT ce.id,
    ce.title,
    ce.description,
    ce.event_type,
    ce.start_date,
    ce.end_date,
    ce.all_day,
    ce.status,
    ce.color,
    ce.ticket_id,
    ce.asset_id,
    ce.assigned_to,
    ce.created_by,
    ce.department,
    ce.site,
    ce.reminder_1h,
    ce.reminder_1d,
    ce.reminder_start,
    ce.is_recurring,
    ce.recurrence_pattern,
    ce.location,
    ce.notes,
    ce.created_at,
    ce.updated_at,
    u.username AS created_by_name,
    u.email AS created_by_email,
    t.title AS ticket_title,
    t.status AS ticket_status,
    a.asset_tag,
    a.type AS asset_type,
    count(DISTINCT ep.id) AS participants_count
   FROM ((((public.calendar_events ce
     JOIN public.users u ON ((ce.created_by = u.id)))
     LEFT JOIN public.tickets t ON ((ce.ticket_id = t.id)))
     LEFT JOIN public.assets a ON ((ce.asset_id = a.id)))
     LEFT JOIN public.calendar_event_participants ep ON ((ce.id = ep.event_id)))
  WHERE ((ce.start_date >= now()) AND (ce.start_date <= (now() + '7 days'::interval)) AND ((ce.status)::text <> ALL ((ARRAY['cancelled'::character varying, 'completed'::character varying])::text[])))
  GROUP BY ce.id, u.username, u.email, t.title, t.status, a.asset_tag, a.type
  ORDER BY ce.start_date;


--
-- Name: calendar_events trigger_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_calendar_events_updated_at();


--
-- Name: smart_assistant_logs trigger_update_smart_assistant_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_smart_assistant_metrics AFTER INSERT ON public.smart_assistant_logs FOR EACH ROW EXECUTE FUNCTION public.update_smart_assistant_metrics();


--
-- Name: asset_anomalies asset_anomalies_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_anomalies asset_anomalies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: asset_history asset_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: asset_live_state asset_live_state_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_relations asset_relations_source_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_source_asset_id_fkey FOREIGN KEY (source_asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_relations asset_relations_target_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_target_asset_id_fkey FOREIGN KEY (target_asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_risk_scores asset_risk_scores_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_risk_scores
    ADD CONSTRAINT asset_risk_scores_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: assets assets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_last_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_last_ticket_id_fkey FOREIGN KEY (last_ticket_id) REFERENCES public.tickets(id);


--
-- Name: calendar_event_participants calendar_event_participants_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_participants calendar_event_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_event_participants
    ADD CONSTRAINT calendar_event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: calendar_maintenance_config calendar_maintenance_config_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_maintenance_config
    ADD CONSTRAINT calendar_maintenance_config_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: calendar_maintenance_config calendar_maintenance_config_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_maintenance_config
    ADD CONSTRAINT calendar_maintenance_config_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: calendar_notifications calendar_notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_notifications calendar_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_notifications
    ADD CONSTRAINT calendar_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chatbot_logs chatbot_logs_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.chatbot_learned_cases(id);


--
-- Name: chatbot_logs chatbot_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: chatbot_logs chatbot_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chatbot_messages chatbot_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE;


--
-- Name: chatbot_sessions chatbot_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_articles knowledge_articles_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_base knowledge_base_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reports reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: scan_history scan_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: scan_history scan_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: security_incidents security_incidents_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_incidents
    ADD CONSTRAINT security_incidents_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: settings_history settings_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings_history
    ADD CONSTRAINT settings_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: smart_assistant_logs smart_assistant_logs_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs
    ADD CONSTRAINT smart_assistant_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: smart_assistant_logs smart_assistant_logs_recommended_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs
    ADD CONSTRAINT smart_assistant_logs_recommended_technician_id_fkey FOREIGN KEY (recommended_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: smart_assistant_logs smart_assistant_logs_ticket_created_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs
    ADD CONSTRAINT smart_assistant_logs_ticket_created_id_fkey FOREIGN KEY (ticket_created_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: smart_assistant_logs smart_assistant_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_assistant_logs
    ADD CONSTRAINT smart_assistant_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_comments ticket_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ticket_history ticket_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tickets tickets_remote_session_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_remote_session_by_fkey FOREIGN KEY (remote_session_by) REFERENCES public.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict marFl4568r5KgO2AgtOTpWzlm4bfOzzlXiTRqr9uh9oH6y0TgZPKxPwUX65RMzP

