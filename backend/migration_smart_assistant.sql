-- Migration: Smart IT Assistant
-- Description: Tables et index pour le Smart IT Assistant

-- ============================================================================
-- 1. Table pour stocker les analyses de messages du Smart Assistant
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_assistant_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_key VARCHAR(64) NOT NULL,
    user_message TEXT NOT NULL,
    intent VARCHAR(50),
    confidence NUMERIC(4,3),
    
    -- Analyse de sentiment
    sentiment VARCHAR(20),
    sentiment_score INTEGER,
    sentiment_emotions JSONB DEFAULT '[]'::jsonb,
    sentiment_intensity INTEGER,
    sentiment_is_critical BOOLEAN DEFAULT false,
    
    -- Entités extraites
    entities JSONB DEFAULT '{}'::jsonb,
    
    -- Asset identifié
    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    asset_confidence NUMERIC(4,3),
    asset_identification_method VARCHAR(50),
    
    -- Classification
    ticket_category VARCHAR(100),
    ticket_priority VARCHAR(20),
    ticket_classification_confidence NUMERIC(4,3),
    
    -- Prédiction ML
    ml_risk_score NUMERIC(5,1),
    ml_risk_level VARCHAR(20),
    
    -- Technicien recommandé
    recommended_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    technician_score NUMERIC(5,1),
    
    -- Sécurité
    is_security_incident BOOLEAN DEFAULT false,
    security_incident_type VARCHAR(100),
    security_incident_severity VARCHAR(20),
    
    -- Ticket créé
    ticket_created_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
    
    -- Performance
    processing_time_ms INTEGER,
    
    -- Réponse
    bot_response TEXT,
    sources JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_smart_assistant_user ON smart_assistant_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_assistant_session ON smart_assistant_logs(session_key);
CREATE INDEX IF NOT EXISTS idx_smart_assistant_created_at ON smart_assistant_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_assistant_security ON smart_assistant_logs(is_security_incident) WHERE is_security_incident = true;
CREATE INDEX IF NOT EXISTS idx_smart_assistant_ticket ON smart_assistant_logs(ticket_created_id);

-- ============================================================================
-- 2. Table pour les incidents de sécurité
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_incidents (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    incident_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    
    -- Détails de l'incident
    affected_assets JSONB DEFAULT '[]'::jsonb,
    indicators JSONB DEFAULT '{}'::jsonb,
    
    -- Actions prises
    actions_taken TEXT,
    resolution_notes TEXT,
    
    -- Notifications
    admins_notified BOOLEAN DEFAULT false,
    security_team_notified BOOLEAN DEFAULT false,
    
    -- Timestamps
    detected_at TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_ticket ON security_incidents(ticket_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected ON security_incidents(detected_at DESC);

-- ============================================================================
-- 3. Table pour le suivi des performances du Smart Assistant
-- ============================================================================

CREATE TABLE IF NOT EXISTS smart_assistant_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    
    -- Compteurs
    total_messages INTEGER DEFAULT 0,
    tickets_created INTEGER DEFAULT 0,
    security_incidents_detected INTEGER DEFAULT 0,
    
    -- Performance
    avg_processing_time_ms INTEGER,
    avg_confidence NUMERIC(4,3),
    
    -- Catégories de tickets créés
    category_breakdown JSONB DEFAULT '{}'::jsonb,
    
    -- Sentiment
    avg_sentiment_score INTEGER,
    critical_messages INTEGER DEFAULT 0,
    
    -- Assets
    assets_identified INTEGER DEFAULT 0,
    
    -- ML
    ml_predictions_made INTEGER DEFAULT 0,
    high_risk_assets INTEGER DEFAULT 0,
    
    -- Techniciens
    technicians_recommended INTEGER DEFAULT 0,
    
    -- Knowledge Base
    kb_articles_served INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(metric_date, hour)
);

CREATE INDEX IF NOT EXISTS idx_smart_assistant_metrics_date ON smart_assistant_metrics(metric_date DESC);

-- ============================================================================
-- 4. Vue pour les statistiques du Smart Assistant
-- ============================================================================

CREATE OR REPLACE VIEW smart_assistant_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_key) as sessions,
    
    -- Tickets
    COUNT(ticket_created_id) as tickets_created,
    COUNT(DISTINCT ticket_created_id) as unique_tickets,
    
    -- Sécurité
    COUNT(CASE WHEN is_security_incident THEN 1 END) as security_incidents,
    COUNT(CASE WHEN security_incident_severity = 'critical' THEN 1 END) as critical_security_incidents,
    
    -- Sentiment
    AVG(sentiment_score) as avg_sentiment_score,
    COUNT(CASE WHEN sentiment_is_critical THEN 1 END) as critical_sentiments,
    
    -- Assets
    COUNT(CASE WHEN asset_id IS NOT NULL THEN 1 END) as assets_identified,
    
    -- ML
    COUNT(CASE WHEN ml_risk_score IS NOT NULL THEN 1 END) as ml_predictions,
    COUNT(CASE WHEN ml_risk_level = 'élevé' OR ml_risk_level = 'critique' THEN 1 END) as high_risk_detections,
    
    -- Techniciens
    COUNT(CASE WHEN recommended_technician_id IS NOT NULL THEN 1 END) as technician_recommendations,
    
    -- Performance
    AVG(processing_time_ms) as avg_processing_time_ms,
    MAX(processing_time_ms) as max_processing_time_ms,
    
    -- Intent distribution
    COUNT(CASE WHEN intent = 'ticket_create' THEN 1 END) as intent_ticket_create,
    COUNT(CASE WHEN intent = 'kb_search' THEN 1 END) as intent_kb_search,
    COUNT(CASE WHEN intent = 'asset_locate' THEN 1 END) as intent_asset_locate,
    COUNT(CASE WHEN intent = 'asset_status' THEN 1 END) as intent_asset_status,
    COUNT(CASE WHEN intent = 'security_incident' THEN 1 END) as intent_security_incident,
    COUNT(CASE WHEN intent = 'greeting' THEN 1 END) as intent_greeting,
    COUNT(CASE WHEN intent = 'general' THEN 1 END) as intent_general
    
FROM smart_assistant_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 5. Vue pour les incidents de sécurité actifs
-- ============================================================================

CREATE OR REPLACE VIEW active_security_incidents AS
SELECT 
    si.id,
    si.ticket_id,
    t.title as ticket_title,
    t.description as ticket_description,
    t.priority as ticket_priority,
    t.status as ticket_status,
    si.incident_type,
    si.severity,
    si.status as incident_status,
    si.affected_assets,
    si.actions_taken,
    si.detected_at,
    si.acknowledged_at,
    si.resolved_at,
    u.username as created_by,
    u.email as created_by_email
FROM security_incidents si
JOIN tickets t ON t.id = si.ticket_id
LEFT JOIN users u ON u.id = t.created_by
WHERE si.status IN ('open', 'investigating')
ORDER BY 
    CASE si.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
    END,
    si.detected_at DESC;

-- ============================================================================
-- 6. Fonction pour mettre à jour les métriques
-- ============================================================================

CREATE OR REPLACE FUNCTION update_smart_assistant_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Insérer ou mettre à jour les métriques pour l'heure courante
    INSERT INTO smart_assistant_metrics (
        metric_date,
        hour,
        total_messages,
        tickets_created,
        security_incidents_detected,
        avg_processing_time_ms,
        avg_confidence,
        avg_sentiment_score,
        critical_messages,
        assets_identified,
        ml_predictions_made,
        high_risk_assets,
        technicians_recommended,
        kb_articles_served
    )
    VALUES (
        DATE(NEW.created_at),
        EXTRACT(HOUR FROM NEW.created_at),
        1,
        CASE WHEN NEW.ticket_created_id IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_security_incident THEN 1 ELSE 0 END,
        NEW.processing_time_ms,
        NEW.confidence,
        NEW.sentiment_score,
        CASE WHEN NEW.sentiment_is_critical THEN 1 ELSE 0 END,
        CASE WHEN NEW.asset_id IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN NEW.ml_risk_score IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN NEW.ml_risk_level IN ('élevé', 'critique') THEN 1 ELSE 0 END,
        CASE WHEN NEW.recommended_technician_id IS NOT NULL THEN 1 ELSE 0 END,
        (SELECT COUNT(*) FROM jsonb_array_elements(NEW.sources))
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
                                 CASE WHEN NEW.recommended_technician_id IS NOT NULL THEN 1 ELSE 0 END,
        kb_articles_served = smart_assistant_metrics.kb_articles_served + 
                            (SELECT COUNT(*) FROM jsonb_array_elements(NEW.sources));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_update_smart_assistant_metrics ON smart_assistant_logs;
CREATE TRIGGER trigger_update_smart_assistant_metrics
    AFTER INSERT ON smart_assistant_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_smart_assistant_metrics();

-- ============================================================================
-- 7. Données initiales
-- ============================================================================

-- Insérer des métriques pour les dernières 24 heures (pour les tests)
INSERT INTO smart_assistant_metrics (metric_date, hour, total_messages, tickets_created)
SELECT 
    DATE(NOW() - (i || ' hours')::INTERVAL),
    EXTRACT(HOUR FROM (NOW() - (i || ' hours')::INTERVAL))::INTEGER,
    FLOOR(RANDOM() * 50)::INTEGER,
    FLOOR(RANDOM() * 10)::INTEGER
FROM generate_series(0, 23) AS i
ON CONFLICT (metric_date, hour) DO NOTHING;

-- ============================================================================
-- 8. Commentaires
-- ============================================================================

COMMENT ON TABLE smart_assistant_logs IS 'Logs complets des analyses du Smart IT Assistant';
COMMENT ON TABLE security_incidents IS 'Incidents de sécurité détectés par le Smart Assistant';
COMMENT ON TABLE smart_assistant_metrics IS 'Métriques de performance du Smart Assistant (agrégées par heure)';
COMMENT ON VIEW smart_assistant_stats IS 'Statistiques quotidiennes du Smart Assistant';
COMMENT ON VIEW active_security_incidents IS 'Incidents de sécurité actifs nécessitant une attention';