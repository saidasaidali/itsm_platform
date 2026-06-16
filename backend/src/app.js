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
import './services/ticketMonitor.js';

import { startNetworkDiscovery } from './services/networkDiscovery/scheduler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
});

app.use((err, req, res, next) => {
  console.error('[ERREUR GLOBALE]', err);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur ITSM démarré sur http://localhost:${PORT}`);
});
startNetworkDiscovery(); //demarrer la decouverte reseau automatique
export default app;