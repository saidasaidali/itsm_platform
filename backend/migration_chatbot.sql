-- ============================================================
-- MIGRATION : Mémoire du chatbot ITSM
-- À exécuter UNE SEULE FOIS sur votre base itsm_db
-- ============================================================
-- 1. Sessions de conversation (mémoire court-terme)
CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW()
);

-- 2. Messages d'une session (historique de la conversation)
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user','bot')),
    content TEXT NOT NULL,
    intent VARCHAR(50),
    confidence NUMERIC(4,3),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Base de cas mémorisés (mémoire long-terme = apprentissage)
CREATE TABLE IF NOT EXISTS chatbot_learned_cases (
    id SERIAL PRIMARY KEY,
    problem_keywords TEXT[] NOT NULL,
    problem_summary TEXT NOT NULL,
    solution_text TEXT NOT NULL,
    source_type VARCHAR(20) DEFAULT 'ticket',
    source_id INTEGER,
    hit_count INTEGER DEFAULT 0,
    confidence_score NUMERIC(4,3) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Logs enrichis (créer la table si elle n'existe pas)
CREATE TABLE IF NOT EXISTS chatbot_logs (
    id SERIAL PRIMARY KEY,
    query TEXT,
    response TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS session_key VARCHAR(64);
ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3);
ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES tickets(id);
ALTER TABLE chatbot_logs ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES chatbot_learned_cases(id);

-- 5. Index pour les recherches full-text sur les cas mémorisés
CREATE INDEX IF NOT EXISTS idx_learned_cases_keywords ON chatbot_learned_cases USING GIN (problem_keywords);
CREATE INDEX IF NOT EXISTS idx_learned_cases_fts ON chatbot_learned_cases USING GIN (to_tsvector('french', problem_summary || ' ' || solution_text));

-- 6. Index sessions
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON chatbot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_key ON chatbot_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_sess ON chatbot_messages(session_id);

-- 7. Vue : top problèmes résolus (pour le dashboard)
CREATE OR REPLACE VIEW chatbot_top_cases AS
SELECT lc.id, lc.problem_summary, lc.solution_text, lc.source_type, lc.hit_count, lc.confidence_score, lc.created_at
FROM chatbot_learned_cases lc
ORDER BY lc.hit_count DESC, lc.confidence_score DESC;

SELECT 'Migration chatbot terminée avec succès.' AS status;
