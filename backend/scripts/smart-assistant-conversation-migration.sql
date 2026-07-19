-- Migration pour la table smart_assistant_conversations
-- Cette table stocke l'état conversationnel du Smart Assistant

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS smart_assistant_conversations (
  id SERIAL PRIMARY KEY,
  session_key VARCHAR(255) NOT NULL UNIQUE,
  pending_action VARCHAR(100),
  last_intent VARCHAR(100),
  last_question TEXT,
  last_response TEXT,
  last_knowledge JSONB DEFAULT '[]',
  last_articles JSONB DEFAULT '[]',
  last_documents JSONB DEFAULT '[]',
  last_category VARCHAR(100),
  last_priority VARCHAR(50),
  last_asset JSONB,
  last_technician JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer un index sur session_key pour des requêtes plus rapides
CREATE INDEX IF NOT EXISTS idx_smart_assistant_conversations_session_key 
ON smart_assistant_conversations(session_key);

-- Créer un index sur created_at pour le nettoyage des anciennes sessions
CREATE INDEX IF NOT EXISTS idx_smart_assistant_conversations_created_at 
ON smart_assistant_conversations(created_at);

-- Commentaire sur la table
COMMENT ON TABLE smart_assistant_conversations IS 'Stocke l''état conversationnel du Smart Assistant pour maintenir le contexte entre les messages';

-- Nettoyage automatique des sessions anciennes (optionnel, à exécuter périodiquement)
-- DELETE FROM smart_assistant_conversations WHERE created_at < NOW() - INTERVAL '30 days';