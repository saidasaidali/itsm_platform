-- ============================================================
-- ITSM Platform — Schéma PostgreSQL complet
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Rôles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('Admin'), ('Technicien'), ('Agent')
  ON CONFLICT (name) DO NOTHING;

-- ─── Utilisateurs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(100) UNIQUE NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,
  role_id    INTEGER             NOT NULL REFERENCES roles(id),
  is_active  BOOLEAN             DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Tickets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL,
  status      VARCHAR(50)  NOT NULL DEFAULT 'Nouveau'
                CHECK (status IN ('Nouveau', 'En cours', 'Résolu', 'Clôturé')),
  priority    VARCHAR(50)  NOT NULL DEFAULT 'Moyenne'
                CHECK (priority IN ('Haute', 'Moyenne', 'Basse')),
  category    VARCHAR(100),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date    TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Commentaires de tickets
CREATE TABLE IF NOT EXISTS ticket_comments (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Cycle de vie complet des tickets ────────────────────────
-- Mettre à jour le CHECK de status
ALTER TABLE tickets 
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets 
  ADD CONSTRAINT tickets_status_check 
  CHECK (status IN ('Nouveau', 'Assigné', 'En cours', 'En attente', 'Résolu', 'Clôturé', 'Rouvert'));

-- ─── Historique immuable des tickets ─────────────────────────
CREATE TABLE IF NOT EXISTS ticket_history (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  action     VARCHAR(100) NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Notes internes dans les commentaires ────────────────────
ALTER TABLE ticket_comments 
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

-- ─── Index supplémentaires ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_internal ON ticket_comments(is_internal);
-- ─── Assets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id          SERIAL PRIMARY KEY,
  asset_tag   VARCHAR(100) UNIQUE NOT NULL,
  type        VARCHAR(100)        NOT NULL,
  brand       VARCHAR(100)        NOT NULL,
  model       VARCHAR(100)        NOT NULL,
  status      VARCHAR(50)         NOT NULL DEFAULT 'En service'
                CHECK (status IN ('En service', 'En panne', 'En maintenance', 'Retiré')),
  location    VARCHAR(255),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Historique des assets
CREATE TABLE IF NOT EXISTS asset_history (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action     TEXT    NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Base de connaissance ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  summary    TEXT         NOT NULL,
  content    TEXT         NOT NULL,
  category   VARCHAR(100) DEFAULT 'Général',
  author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  read       BOOLEAN      DEFAULT FALSE,
  user_id    INTEGER      REFERENCES users(id) ON DELETE CASCADE,  -- NULL = globale
  created_at TIMESTAMP    DEFAULT NOW()
);

-- ─── Index de performance ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_status      ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by  ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_status       ON assets(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_category  ON knowledge_articles(category);



-- ─── Colonnes supplémentaires pour les assets ────────────────
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS serial_number  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department     VARCHAR(100),   -- direction/service
  ADD COLUMN IF NOT EXISTS office         VARCHAR(100),   -- bureau
  ADD COLUMN IF NOT EXISTS purchase_date  DATE,
  ADD COLUMN IF NOT EXISTS warranty_end   DATE,           -- fin de garantie
  ADD COLUMN IF NOT EXISTS assigned_at    TIMESTAMP;      -- horodatage affectation

-- ─── Historique enrichi des assets ───────────────────────────
-- Remplacer la table asset_history existante
DROP TABLE IF EXISTS asset_history;
CREATE TABLE asset_history (
  id          SERIAL PRIMARY KEY,
  asset_id    INTEGER     NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id     INTEGER     REFERENCES users(id),           -- qui a fait l'action
  action_type VARCHAR(50) NOT NULL,                       -- 'created','assigned','unassigned','status_change','modified'
  action      TEXT        NOT NULL,                       -- description lisible
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_warranty     ON assets(warranty_end);



-- Ajouter mots-clés et vues à la table existante
ALTER TABLE knowledge_articles
  ADD COLUMN IF NOT EXISTS keywords    TEXT[],        -- mots-clés (tableau PostgreSQL)
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;

-- Index full-text pour la recherche
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_articles
  USING gin(to_tsvector('french', title || ' ' || summary || ' ' || content));

CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_articles USING gin(keywords);


-- Préférences de notification par utilisateur
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_ticket_created  BOOLEAN DEFAULT TRUE,
  email_status_change   BOOLEAN DEFAULT TRUE,
  email_assigned        BOOLEAN DEFAULT TRUE,
  email_comment         BOOLEAN DEFAULT TRUE,
  email_sla_breach      BOOLEAN DEFAULT TRUE,
  email_closed          BOOLEAN DEFAULT TRUE,
  web_notifications     BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Créer les préférences par défaut pour tous les utilisateurs existants
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ─── Données de démo ─────────────────────────────────────────
-- Mot de passe : Admin@1234 (bcrypt hash — à générer avec votre propre hash)
-- Exécuter depuis Node.js : await bcrypt.hash('Admin@1234', 12)
-- et remplacer le hash ci-dessous

-- INSERT INTO users (username, email, password, role_id) VALUES
--   ('admin', 'admin@ministere.ma', '$2b$12$VOTRE_HASH_ICI', 1);
