// src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import './services/ticketMonitor.js';
import './services/slaMonitor.js';

import { startNetworkDiscovery } from './services/networkDiscovery/scheduler.js';
import pdfIndexer from './services/pdfIndexer.js';
import anomalyRoutes from './routes/anomalyRoutes.js';
import smartCmdbRoutes from './routes/smartCmdbRoutes.js';
import autoTicketingRoutes from './routes/autoTicketingRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { getPublicConfig } from './controllers/settingsController.js';
import { loadSettings, getSettings } from './services/settingsService.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import { voiceMessage } from './controllers/chatbotController.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import sentimentRoutes from './routes/sentimentRoutes.js';
import qrCodeRoutes from './routes/qrCodeRoutes.js';
import smartAssistantRoutes from './routes/smartAssistantRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import reportStatsRoutes from './routes/reportStatsRoutes.js';
import { runQRCodeMigration } from './services/qrCodeMigration.js';
import languageMiddleware from './middlewares/languageMiddleware.js';
import { startMLService, stopMLService } from './services/startMLService.js';
import { runSmartAssistantMigration } from './services/smartAssistantMigration.js';
import { createSettingsHistoryTable } from './services/settingsHistoryService.js';
import { t } from './utils/i18n.js';
import pool from './db.js';
import calendarRoutes from './routes/calendarRoutes.js';
import calendarDashboardRoutes from './routes/calendarDashboardRoutes.js';
import planningRoutes from './routes/planningRoutes.js';
import maintenanceRoutes from './routes/maintenanceRoutes.js';
import './services/calendarReminderService.js';
import documentRoutes from './routes/documentRoutes.js';
import { initStorageDir } from './services/documentService.js';
import { runPdfMigration } from './services/pdfMigration.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration multer pour l'upload de fichiers audio
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter tous les fichiers audio (mimetype commence par 'audio/')
    // ou les types courants même sans codec spécifié
    const isAudio = file.mimetype.startsWith('audio/') || 
                    ['application/octet-stream'].includes(file.mimetype);
    if (isAudio) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé. Seuls les fichiers audio sont acceptés.'));
    }
  }
});

// Configuration manuelle du CSP pour éviter les conflits avec Helmet
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3000 ws://localhost:3000; frame-ancestors 'self' http://localhost:3001;");
  next();
});
app.use(cors({
  origin: (origin, cb) => {
    try {
      // En développement: permettre localhost:3001 (frontend Vite)
      // En production: utiliser les paramètres CORS_ORIGIN des settings
const allowed = (getSettings().cors_origin || 'http://localhost:3001')
  .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      // Autoriser les requêtes sans origin (ex: curl, same-origin)
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    } catch (err) {
      return cb(null, true);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(languageMiddleware);
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use('/api/cmdb', smartCmdbRoutes);
app.use('/api/auto-ticketing', autoTicketingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Expose a root-level config.json for static frontends/CDNs to consume at deploy time
app.get('/config.json', getPublicConfig);
// Route pour upload audio avec multer
app.post('/api/chatbot/voice', upload.single('audio'), voiceMessage);

app.use('/api/chatbot', chatbotRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/qr', qrCodeRoutes);
app.use('/api/smart-assistant', smartAssistantRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reports', reportStatsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/calendar/dashboard', calendarDashboardRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/documents', documentRoutes);
app.use((req, res) => {
  res.status(404).json({ success: false, message: t(req, 'route_not_found') });
});

app.use((err, req, res, next) => {
  console.error('[ERREUR GLOBALE]', err);
  res.status(500).json({ success: false, message: t(req, 'internal_server_error') });
});

loadSettings().then(() => {
  console.log('[Settings] Paramètres système chargés depuis la base.');
});

// Migration automatique pour les colonnes de sentiment
pool.query(`
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutre';
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 0;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_emotions JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_intensity INTEGER DEFAULT 0;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_is_critical BOOLEAN DEFAULT FALSE;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment_analyzed_at TIMESTAMP;
  ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutre';
  ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 0;
  ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_emotions JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_intensity INTEGER DEFAULT 0;
  ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS sentiment_is_critical BOOLEAN DEFAULT FALSE;
`).then(() => {
  console.log('[Migration] Colonnes de sentiment ajoutées avec succès.');
}).catch(err => {
  console.error('[Migration] Erreur lors de l\'ajout des colonnes de sentiment:', err.message);
});

// Migration pour créer la table d'historique des paramètres
createSettingsHistoryTable();


// Migration automatique pour le Smart Assistant
runSmartAssistantMigration().then(() => {
  console.log('[Migration] Tables Smart Assistant vérifiées/créées avec succès.');
}).catch(err => {
  console.error('[Migration] Erreur lors de la création des tables Smart Assistant:', err.message);
});

// Migration automatique pour le module de fiches d'intervention PDF
runPdfMigration().then(() => {
  console.log('[Migration] Tables PDF vérifiées/créées avec succès.');
}).catch(err => {
  console.error('[Migration] Erreur lors de la création des tables PDF:', err.message);
});

// Migration automatique pour ajouter la colonne hostname dans assets
pool.query(`
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS hostname VARCHAR(100);
`).then(() => {
  console.log('[Migration] Colonne hostname ajoutée à la table assets.');
}).catch(err => {
  console.error('[Migration] Erreur lors de l\'ajout de hostname:', err.message);
});

// Migration automatique pour les rapports
pool.query(`
  CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('monthly', 'weekly', 'custom')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP DEFAULT NOW(),
    file_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    error_message TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
  CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON reports(generated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports(generated_by);
`).then(() => {
  console.log('[Migration] Table reports vérifiée/créée avec succès.');
}).catch(err => {
  console.error('[Migration] Erreur lors de la création de la table reports:', err.message);
});

// Migration automatique pour direction, division, service dans users
pool.query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS direction VARCHAR(200);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS division VARCHAR(200);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS service VARCHAR(200);
`).then(() => {
  console.log('[Migration] Colonnes direction/division/service ajoutées à la table users.');
}).catch(err => {
  console.error('[Migration] Erreur lors de l\'ajout des colonnes utilisateur:', err.message);
});

// Migration automatique pour service dans assets
pool.query(`
  ALTER TABLE assets ADD COLUMN IF NOT EXISTS service VARCHAR(200);
`).then(() => {
  console.log('[Migration] Colonne service ajoutée à la table assets.');
}).catch(err => {
  console.error('[Migration] Erreur lors de l\'ajout de service dans assets:', err.message);
});

app.listen(PORT, "0.0.0.0", async () => {
  // Initialisation du dossier de stockage des PDFs
  await initStorageDir();

  // Migration Calendrier synchrone
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_type VARCHAR(50) NOT NULL DEFAULT 'autre',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        all_day BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'scheduled',
        color VARCHAR(7),
        ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department VARCHAR(100),
        site VARCHAR(150),
        reminder_1h BOOLEAN DEFAULT TRUE,
        reminder_1d BOOLEAN DEFAULT TRUE,
        reminder_1w BOOLEAN DEFAULT FALSE,
        reminder_start BOOLEAN DEFAULT FALSE,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern JSONB,
        location VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT calendar_events_end_after_start CHECK (end_date >= start_date)
      );
      CREATE TABLE IF NOT EXISTS calendar_event_participants (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'attendee',
        status VARCHAR(20) DEFAULT 'pending',
        notified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS calendar_notifications (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(20) NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        sent_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        channel VARCHAR(20) DEFAULT 'in_app',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, user_id, notification_type)
      );
      -- Index optimisés pour les requêtes fréquentes
      CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_ticket ON calendar_events(ticket_id) WHERE ticket_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_calendar_events_asset ON calendar_events(asset_id) WHERE asset_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned ON calendar_events(assigned_to) WHERE assigned_to IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_composite ON calendar_events(start_date, status, event_type) WHERE status NOT IN ('cancelled', 'completed');
      CREATE INDEX IF NOT EXISTS idx_calendar_participants_user ON calendar_event_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_participants_event ON calendar_event_participants(event_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_notifications_scheduled ON calendar_notifications(scheduled_at) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_calendar_notifications_user ON calendar_notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_notifications_event ON calendar_notifications(event_id, notification_type);
    `);
    // Table de configuration des maintenances préventives
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_maintenance_config (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
        maintenance_type VARCHAR(20) NOT NULL,
        interval_months INTEGER DEFAULT 1,
        start_date TIMESTAMP,
        next_due TIMESTAMP NOT NULL DEFAULT NOW(),
        last_generated TIMESTAMP,
        notes TEXT,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        enabled BOOLEAN DEFAULT true,
        auto_generated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_maint_config_asset ON calendar_maintenance_config(asset_id);
      CREATE INDEX IF NOT EXISTS idx_maint_config_next_due ON calendar_maintenance_config(next_due) WHERE enabled = true;
    `);
    console.log('[Migration] Module Calendrier vérifié/créé avec succès.');
  } catch (err) {
    console.error('[Migration] Erreur lors de la création du module Calendrier:', err.message);
  }
  console.log(`✅ Serveur ITSM démarré sur http://localhost:${PORT}`);
  // Migration QR Code
  runQRCodeMigration();
  // Démarrage automatique du service ML en arrière-plan
  // La valeur de enable_ml_service vient de la DB (string 'true'/'false') ou du .env
  const s = getSettings();
  const enableML = s.enable_ml_service === true || s.enable_ml_service === 'true';
  if (enableML) {
    startMLService().catch((err) =>
      console.warn('[ML-Launcher] Démarrage ML ignoré (mode dégradé):', err.message)
    );
  } else {
    console.log('[ML-Launcher] Service ML désactivé (ENABLE_ML_SERVICE=false)');
  }
});
startNetworkDiscovery(); //demarrer la decouverte reseau automatique
pdfIndexer.startPdfIndexingScheduler();

// Arrêt propre du service ML à la fermeture du serveur
process.on('SIGINT', () => {
  console.log('[Shutdown] Arrêt propre...');
  stopMLService();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[Shutdown] Arrêt propre...');
  stopMLService();
  process.exit(0);
});

export default app;