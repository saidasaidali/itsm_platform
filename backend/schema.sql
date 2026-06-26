--
-- PostgreSQL database dump
--

\restrict zwLarNxS3zAcmvY4GVUO0SN2tdyJAbvWUC7Bd86vdskuBsRhcde8YcvuaKS9fha

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
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_anomalies; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.asset_anomalies OWNER TO postgres;

--
-- Name: asset_anomalies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_anomalies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.asset_anomalies_id_seq OWNER TO postgres;

--
-- Name: asset_anomalies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_anomalies_id_seq OWNED BY public.asset_anomalies.id;


--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_assignments (
    id integer NOT NULL,
    asset_id integer,
    user_id integer,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unassigned_at timestamp without time zone
);


ALTER TABLE public.asset_assignments OWNER TO postgres;

--
-- Name: asset_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.asset_assignments_id_seq OWNER TO postgres;

--
-- Name: asset_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_assignments_id_seq OWNED BY public.asset_assignments.id;


--
-- Name: asset_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.asset_history OWNER TO postgres;

--
-- Name: asset_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.asset_history_id_seq OWNER TO postgres;

--
-- Name: asset_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_history_id_seq OWNED BY public.asset_history.id;


--
-- Name: asset_live_state; Type: TABLE; Schema: public; Owner: postgres
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
    last_checked_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.asset_live_state OWNER TO postgres;

--
-- Name: asset_live_state_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_live_state_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.asset_live_state_id_seq OWNER TO postgres;

--
-- Name: asset_live_state_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_live_state_id_seq OWNED BY public.asset_live_state.id;


--
-- Name: asset_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_relations (
    id integer NOT NULL,
    source_asset_id integer NOT NULL,
    target_asset_id integer NOT NULL,
    relation_type character varying(50) NOT NULL,
    detected_at timestamp without time zone DEFAULT now(),
    confidence character varying(20) DEFAULT 'auto'::character varying
);


ALTER TABLE public.asset_relations OWNER TO postgres;

--
-- Name: asset_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.asset_relations_id_seq OWNER TO postgres;

--
-- Name: asset_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_relations_id_seq OWNED BY public.asset_relations.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['En service'::character varying, 'En panne'::character varying, 'Hors service'::character varying, 'En stock'::character varying, 'En maintenance'::character varying, 'Retir├®'::character varying])::text[])))
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['Nouveau'::character varying, 'Assign├®'::character varying, 'En cours'::character varying, 'En attente'::character varying, 'R├®solu'::character varying, 'Cl├┤tur├®'::character varying, 'Rouvert'::character varying])::text[])))
);


ALTER TABLE public.tickets OWNER TO postgres;

--
-- Name: asset_reliability; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.asset_reliability AS
 SELECT a.id AS asset_id,
    a.asset_tag,
    a.brand,
    a.model,
    a.status,
    a.created_at AS in_service_since,
    count(t.id) AS total_tickets,
    count(t.id) FILTER (WHERE (((t.category)::text = 'Mat├®riel'::text) AND (t.created_at > (now() - '6 mons'::interval)))) AS pannes_6mois,
    count(t.id) FILTER (WHERE ((t.status)::text = ANY ((ARRAY['R├®solu'::character varying, 'Cl├┤tur├®'::character varying])::text[]))) AS tickets_resolus,
    round(((count(t.id))::numeric / NULLIF((EXTRACT(epoch FROM (now() - (a.created_at)::timestamp with time zone)) / (((30 * 24) * 3600))::numeric), (0)::numeric)), 2) AS pannes_par_mois,
    (EXTRACT(day FROM (now() - (a.created_at)::timestamp with time zone)))::integer AS jours_en_service
   FROM (public.assets a
     LEFT JOIN public.tickets t ON ((t.asset_id = a.id)))
  GROUP BY a.id, a.asset_tag, a.brand, a.model, a.status, a.created_at;


ALTER TABLE public.asset_reliability OWNER TO postgres;

--
-- Name: asset_risk_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_risk_scores (
    asset_id integer NOT NULL,
    risk_score numeric(5,1) DEFAULT 0 NOT NULL,
    risk_level character varying(20) DEFAULT 'faible'::character varying NOT NULL,
    computed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.asset_risk_scores OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.assets_id_seq OWNER TO postgres;

--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(255) NOT NULL,
    entity character varying(100),
    entity_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: auto_ticket_cooldown; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_ticket_cooldown (
    id integer NOT NULL,
    asset_id integer NOT NULL,
    trigger_type character varying(50) NOT NULL,
    last_ticket_id integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.auto_ticket_cooldown OWNER TO postgres;

--
-- Name: auto_ticket_cooldown_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.auto_ticket_cooldown_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.auto_ticket_cooldown_id_seq OWNER TO postgres;

--
-- Name: auto_ticket_cooldown_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.auto_ticket_cooldown_id_seq OWNED BY public.auto_ticket_cooldown.id;


--
-- Name: chatbot_learned_cases; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.chatbot_learned_cases OWNER TO postgres;

--
-- Name: chatbot_learned_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_learned_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chatbot_learned_cases_id_seq OWNER TO postgres;

--
-- Name: chatbot_learned_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_learned_cases_id_seq OWNED BY public.chatbot_learned_cases.id;


--
-- Name: chatbot_logs; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.chatbot_logs OWNER TO postgres;

--
-- Name: chatbot_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chatbot_logs_id_seq OWNER TO postgres;

--
-- Name: chatbot_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_logs_id_seq OWNED BY public.chatbot_logs.id;


--
-- Name: chatbot_messages; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.chatbot_messages OWNER TO postgres;

--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chatbot_messages_id_seq OWNER TO postgres;

--
-- Name: chatbot_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_messages_id_seq OWNED BY public.chatbot_messages.id;


--
-- Name: chatbot_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chatbot_sessions (
    id integer NOT NULL,
    user_id integer,
    session_key character varying(64) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_active timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chatbot_sessions OWNER TO postgres;

--
-- Name: chatbot_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chatbot_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chatbot_sessions_id_seq OWNER TO postgres;

--
-- Name: chatbot_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chatbot_sessions_id_seq OWNED BY public.chatbot_sessions.id;


--
-- Name: chatbot_top_cases; Type: VIEW; Schema: public; Owner: postgres
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


ALTER TABLE public.chatbot_top_cases OWNER TO postgres;

--
-- Name: knowledge_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_articles (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    summary text NOT NULL,
    content text NOT NULL,
    category character varying(100) DEFAULT 'G├®n├®ral'::character varying,
    author_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    keywords text[],
    views_count integer DEFAULT 0,
    is_published boolean DEFAULT true
);


ALTER TABLE public.knowledge_articles OWNER TO postgres;

--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knowledge_articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.knowledge_articles_id_seq OWNER TO postgres;

--
-- Name: knowledge_articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knowledge_articles_id_seq OWNED BY public.knowledge_articles.id;


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.knowledge_base (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    category character varying(100),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.knowledge_base OWNER TO postgres;

--
-- Name: knowledge_base_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.knowledge_base_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.knowledge_base_id_seq OWNER TO postgres;

--
-- Name: knowledge_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.knowledge_base_id_seq OWNED BY public.knowledge_base.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_preferences_id_seq OWNER TO postgres;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO postgres;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: scan_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.scan_history OWNER TO postgres;

--
-- Name: scan_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.scan_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.scan_history_id_seq OWNER TO postgres;

--
-- Name: scan_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.scan_history_id_seq OWNED BY public.scan_history.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.ticket_comments OWNER TO postgres;

--
-- Name: ticket_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ticket_comments_id_seq OWNER TO postgres;

--
-- Name: ticket_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_comments_id_seq OWNED BY public.ticket_comments.id;


--
-- Name: ticket_history; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.ticket_history OWNER TO postgres;

--
-- Name: ticket_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ticket_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ticket_history_id_seq OWNER TO postgres;

--
-- Name: ticket_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ticket_history_id_seq OWNED BY public.ticket_history.id;


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tickets_id_seq OWNER TO postgres;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: unknown_devices; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.unknown_devices OWNER TO postgres;

--
-- Name: unknown_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.unknown_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.unknown_devices_id_seq OWNER TO postgres;

--
-- Name: unknown_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.unknown_devices_id_seq OWNED BY public.unknown_devices.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: asset_anomalies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_anomalies ALTER COLUMN id SET DEFAULT nextval('public.asset_anomalies_id_seq'::regclass);


--
-- Name: asset_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments ALTER COLUMN id SET DEFAULT nextval('public.asset_assignments_id_seq'::regclass);


--
-- Name: asset_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history ALTER COLUMN id SET DEFAULT nextval('public.asset_history_id_seq'::regclass);


--
-- Name: asset_live_state id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_live_state ALTER COLUMN id SET DEFAULT nextval('public.asset_live_state_id_seq'::regclass);


--
-- Name: asset_relations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_relations ALTER COLUMN id SET DEFAULT nextval('public.asset_relations_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: auto_ticket_cooldown id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_ticket_cooldown ALTER COLUMN id SET DEFAULT nextval('public.auto_ticket_cooldown_id_seq'::regclass);


--
-- Name: chatbot_learned_cases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_learned_cases ALTER COLUMN id SET DEFAULT nextval('public.chatbot_learned_cases_id_seq'::regclass);


--
-- Name: chatbot_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_logs ALTER COLUMN id SET DEFAULT nextval('public.chatbot_logs_id_seq'::regclass);


--
-- Name: chatbot_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages ALTER COLUMN id SET DEFAULT nextval('public.chatbot_messages_id_seq'::regclass);


--
-- Name: chatbot_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_sessions ALTER COLUMN id SET DEFAULT nextval('public.chatbot_sessions_id_seq'::regclass);


--
-- Name: knowledge_articles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_articles ALTER COLUMN id SET DEFAULT nextval('public.knowledge_articles_id_seq'::regclass);


--
-- Name: knowledge_base id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_base ALTER COLUMN id SET DEFAULT nextval('public.knowledge_base_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: scan_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_history ALTER COLUMN id SET DEFAULT nextval('public.scan_history_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: ticket_comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_comments ALTER COLUMN id SET DEFAULT nextval('public.ticket_comments_id_seq'::regclass);


--
-- Name: ticket_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_history ALTER COLUMN id SET DEFAULT nextval('public.ticket_history_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: unknown_devices id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unknown_devices ALTER COLUMN id SET DEFAULT nextval('public.unknown_devices_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: asset_anomalies asset_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_pkey PRIMARY KEY (id);


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_history asset_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_pkey PRIMARY KEY (id);


--
-- Name: asset_live_state asset_live_state_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_asset_id_key UNIQUE (asset_id);


--
-- Name: asset_live_state asset_live_state_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_pkey PRIMARY KEY (id);


--
-- Name: asset_relations asset_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_pkey PRIMARY KEY (id);


--
-- Name: asset_relations asset_relations_source_asset_id_target_asset_id_relation_ty_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_source_asset_id_target_asset_id_relation_ty_key UNIQUE (source_asset_id, target_asset_id, relation_type);


--
-- Name: asset_risk_scores asset_risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_risk_scores
    ADD CONSTRAINT asset_risk_scores_pkey PRIMARY KEY (asset_id);


--
-- Name: assets assets_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);


--
-- Name: assets assets_numero_inventaire_unique_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_numero_inventaire_unique_key UNIQUE (numero_inventaire_unique);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_qr_token_key UNIQUE (qr_token);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_asset_id_trigger_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_asset_id_trigger_type_key UNIQUE (asset_id, trigger_type);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_pkey PRIMARY KEY (id);


--
-- Name: chatbot_learned_cases chatbot_learned_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_learned_cases
    ADD CONSTRAINT chatbot_learned_cases_pkey PRIMARY KEY (id);


--
-- Name: chatbot_logs chatbot_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_pkey PRIMARY KEY (id);


--
-- Name: chatbot_messages chatbot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_pkey PRIMARY KEY (id);


--
-- Name: chatbot_sessions chatbot_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_pkey PRIMARY KEY (id);


--
-- Name: chatbot_sessions chatbot_sessions_session_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_session_key_key UNIQUE (session_key);


--
-- Name: knowledge_articles knowledge_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: scan_history scan_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_history ticket_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: unknown_devices unknown_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unknown_devices
    ADD CONSTRAINT unknown_devices_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_anomalies_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_asset ON public.asset_anomalies USING btree (asset_id);


--
-- Name: idx_anomalies_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_status ON public.asset_anomalies USING btree (status);


--
-- Name: idx_anomalies_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_type ON public.asset_anomalies USING btree (anomaly_type);


--
-- Name: idx_asset_history_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_history_asset ON public.asset_history USING btree (asset_id);


--
-- Name: idx_assets_mac_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_assets_mac_unique ON public.assets USING btree (adresse_mac) WHERE ((adresse_mac IS NOT NULL) AND ((adresse_mac)::text <> ''::text));


--
-- Name: idx_assets_qr_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_qr_token ON public.assets USING btree (qr_token);


--
-- Name: idx_assets_serial_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_assets_serial_unique ON public.assets USING btree (serial_number) WHERE ((serial_number IS NOT NULL) AND ((serial_number)::text <> ''::text));


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_warranty; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_warranty ON public.assets USING btree (warranty_end);


--
-- Name: idx_chatbot_messages_sess; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chatbot_messages_sess ON public.chatbot_messages USING btree (session_id);


--
-- Name: idx_chatbot_sessions_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chatbot_sessions_key ON public.chatbot_sessions USING btree (session_key);


--
-- Name: idx_chatbot_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chatbot_sessions_user ON public.chatbot_sessions USING btree (user_id);


--
-- Name: idx_knowledge_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_category ON public.knowledge_articles USING btree (category);


--
-- Name: idx_knowledge_keywords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_keywords ON public.knowledge_articles USING gin (keywords);


--
-- Name: idx_knowledge_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_knowledge_search ON public.knowledge_articles USING gin (to_tsvector('french'::regconfig, (((((title)::text || ' '::text) || summary) || ' '::text) || content)));


--
-- Name: idx_learned_cases_fts; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learned_cases_fts ON public.chatbot_learned_cases USING gin (to_tsvector('french'::regconfig, ((problem_summary || ' '::text) || solution_text)));


--
-- Name: idx_learned_cases_keywords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learned_cases_keywords ON public.chatbot_learned_cases USING gin (problem_keywords);


--
-- Name: idx_live_state_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_live_state_asset ON public.asset_live_state USING btree (asset_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_relations_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_relations_source ON public.asset_relations USING btree (source_asset_id);


--
-- Name: idx_relations_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_relations_target ON public.asset_relations USING btree (target_asset_id);


--
-- Name: idx_scan_history_asset_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scan_history_asset_id ON public.scan_history USING btree (asset_id);


--
-- Name: idx_scan_history_scanned_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_scan_history_scanned_at ON public.scan_history USING btree (scanned_at);


--
-- Name: idx_ticket_comments_internal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_comments_internal ON public.ticket_comments USING btree (is_internal);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id);


--
-- Name: idx_ticket_history_ticket; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ticket_history_ticket ON public.ticket_history USING btree (ticket_id);


--
-- Name: idx_tickets_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_asset ON public.tickets USING btree (asset_id);


--
-- Name: idx_tickets_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_assigned_to ON public.tickets USING btree (assigned_to);


--
-- Name: idx_tickets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_created_by ON public.tickets USING btree (created_by);


--
-- Name: idx_tickets_sentiment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_sentiment ON public.tickets USING btree (sentiment, sentiment_score);


--
-- Name: idx_tickets_sentiment_critical; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_sentiment_critical ON public.tickets USING btree (sentiment_is_critical) WHERE (sentiment_is_critical = true);


--
-- Name: idx_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tickets_status ON public.tickets USING btree (status);


--
-- Name: idx_unknown_devices_mac; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_unknown_devices_mac ON public.unknown_devices USING btree (mac_address) WHERE (mac_address IS NOT NULL);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: asset_anomalies asset_anomalies_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_anomalies asset_anomalies_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_anomalies
    ADD CONSTRAINT asset_anomalies_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_assignments asset_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: asset_history asset_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_history asset_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_history
    ADD CONSTRAINT asset_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: asset_live_state asset_live_state_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_live_state
    ADD CONSTRAINT asset_live_state_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_relations asset_relations_source_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_source_asset_id_fkey FOREIGN KEY (source_asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_relations asset_relations_target_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_relations
    ADD CONSTRAINT asset_relations_target_asset_id_fkey FOREIGN KEY (target_asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_risk_scores asset_risk_scores_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_risk_scores
    ADD CONSTRAINT asset_risk_scores_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: assets assets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: auto_ticket_cooldown auto_ticket_cooldown_last_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_ticket_cooldown
    ADD CONSTRAINT auto_ticket_cooldown_last_ticket_id_fkey FOREIGN KEY (last_ticket_id) REFERENCES public.tickets(id);


--
-- Name: chatbot_logs chatbot_logs_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.chatbot_learned_cases(id);


--
-- Name: chatbot_logs chatbot_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);


--
-- Name: chatbot_logs chatbot_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_logs
    ADD CONSTRAINT chatbot_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chatbot_messages chatbot_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE;


--
-- Name: chatbot_sessions chatbot_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: knowledge_articles knowledge_articles_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_articles
    ADD CONSTRAINT knowledge_articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: knowledge_base knowledge_base_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: scan_history scan_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: scan_history scan_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_history
    ADD CONSTRAINT scan_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_comments ticket_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ticket_history ticket_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tickets tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tickets tickets_remote_session_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_remote_session_by_fkey FOREIGN KEY (remote_session_by) REFERENCES public.users(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict zwLarNxS3zAcmvY4GVUO0SN2tdyJAbvWUC7Bd86vdskuBsRhcde8YcvuaKS9fha

