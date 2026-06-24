// src/app.js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

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
import suggestionRoutes from './routes/suggestionRoutes.js';
import languageMiddleware from './middlewares/languageMiddleware.js';
import { startMLService, stopMLService } from './services/startMLService.js';
import { t } from './utils/i18n.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use('/api/chatbot', chatbotRoutes);
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


app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Serveur ITSM démarré sur http://localhost:${PORT}`);
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
