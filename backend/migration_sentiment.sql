-- Colonnes sentiment sur tickets (déjà exécuté avec succès)
-- Colonnes sentiment sur ticket_comments (nom correct de votre table)
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutre';
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 0;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_emotions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_intensity INTEGER DEFAULT 0;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_is_critical BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_sentiment_critical
ON tickets(sentiment_is_critical) WHERE sentiment_is_critical = TRUE;

CREATE INDEX IF NOT EXISTS idx_tickets_sentiment
ON tickets(sentiment, sentiment_score);