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
import anomalyRoutes from './routes/anomalyRoutes.js';
import smartCmdbRoutes from './routes/smartCmdbRoutes.js';
import autoTicketingRoutes from './routes/autoTicketingRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { loadSettings } from './services/settingsService.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import { voiceMessage } from './controllers/chatbotController.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import sentimentRoutes from './routes/sentimentRoutes.js';
import qrCodeRoutes from './routes/qrCodeRoutes.js';
import smartAssistantRoutes from './routes/smartAssistantRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { runQRCodeMigration } from './services/qrCodeMigration.js';
import languageMiddleware from './middlewares/languageMiddleware.js';
import { startMLService, stopMLService } from './services/startMLService.js';
import { runSmartAssistantMigration } from './services/smartAssistantMigration.js';
import { t } from './utils/i18n.js';
import pool from './db.js';

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

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
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
// Route pour upload audio avec multer
app.post('/api/chatbot/voice', upload.single('audio'), voiceMessage);

app.use('/api/chatbot', chatbotRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/qr', qrCodeRoutes);
app.use('/api/smart-assistant', smartAssistantRoutes);
app.use('/api/reports', reportRoutes);
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


// Migration automatique pour le Smart Assistant
runSmartAssistantMigration().then(() => {
  console.log('[Migration] Tables Smart Assistant vérifiées/créées avec succès.');
}).catch(err => {
  console.error('[Migration] Erreur lors de la création des tables Smart Assistant:', err.message);
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


app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Serveur ITSM démarré sur http://localhost:${PORT}`);
  // Migration QR Code
  runQRCodeMigration();
  // Démarrage automatique du service ML en arrière-plan (aucune commande terminal requise)
  startMLService().catch((err) =>
    console.warn('[ML-Launcher] Démarrage ML ignoré (mode dégradé):', err.message)
  );
});
startNetworkDiscovery(); //demarrer la decouverte reseau automatique

// Arrêt propre du service ML à la fermeture du serveur
process.on('SIGINT', () => {
  stopMLService();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopMLService();
  process.exit(0);
});

export default app;
